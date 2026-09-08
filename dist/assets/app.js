(() => {
  "use strict";

  const PRESETS = {
    xor: {
      description: "두 스위치의 상태가 다를 때만 전등이 켜지는 패턴입니다.",
      points: [
        [-0.86, -0.82, 0], [-0.66, -0.58, 0], [-0.48, -0.76, 0],
        [0.86, 0.82, 0], [0.64, 0.56, 0], [0.47, 0.78, 0],
        [-0.84, 0.81, 1], [-0.62, 0.56, 1], [-0.46, 0.77, 1],
        [0.84, -0.81, 1], [0.63, -0.56, 1], [0.45, -0.76, 1]
      ]
    },
    and: {
      description: "두 안전 조건이 모두 충족될 때만 장치가 작동하는 패턴입니다.",
      points: [
        [-0.84, -0.81, 0], [-0.62, -0.56, 0], [-0.80, 0.79, 0],
        [-0.56, 0.55, 0], [0.82, -0.78, 0], [0.58, -0.54, 0],
        [0.83, 0.81, 1], [0.62, 0.56, 1], [0.46, 0.76, 1]
      ]
    },
    custom: {
      description: "두 범주의 점을 직접 배치해 신경망이 어떤 경계를 만드는지 관찰합니다.",
      points: []
    }
  };

  const COLORS = {
    zero: "#2463eb",
    one: "#f17a2b",
    positive: "#3f72f1",
    negative: "#f07b47",
    grid: "#dbe1e9",
    ink: "#172033"
  };

  const state = {
    preset: "xor",
    points: clonePoints(PRESETS.xor.points),
    pointClass: 0,
    hidden: 2,
    activation: "tanh",
    learningRate: 0.08,
    epoch: 0,
    epochGoal: 1000,
    weights: null,
    history: [],
    experiments: readExperiments(),
    autoTimer: null,
    view: "decision",
    test: { x: 0, y: 0 }
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function clonePoints(points) {
    return points.map((point) => [...point]);
  }

  function seeded(index) {
    const value = Math.sin((index + 1) * 12.9898 + 4.1414) * 43758.5453;
    return (value - Math.floor(value)) * 2 - 1;
  }

  function initializeModel(showNotice = false) {
    stopAutoTraining();
    const scale = Math.sqrt(2 / (2 + state.hidden));
    state.weights = {
      inputHidden: Array.from({ length: state.hidden }, (_, h) => [
        seeded(h * 7 + 1) * scale,
        seeded(h * 7 + 2) * scale
      ]),
      hiddenBias: Array.from({ length: state.hidden }, (_, h) => seeded(h * 7 + 3) * 0.08),
      hiddenOutput: Array.from({ length: state.hidden }, (_, h) => seeded(h * 7 + 4) * scale),
      outputBias: 0
    };
    state.epoch = 0;
    state.history = [];
    recordHistory();
    render();
    persistSettings();
    if (showNotice) showToast("같은 초기값으로 모델을 다시 만들었습니다.");
  }

  function activate(value) {
    if (state.activation === "relu") return Math.max(0, value);
    if (state.activation === "sigmoid") return sigmoid(value);
    return Math.tanh(value);
  }

  function activationDerivative(z, a) {
    if (state.activation === "relu") return z > 0 ? 1 : 0;
    if (state.activation === "sigmoid") return a * (1 - a);
    return 1 - a * a;
  }

  function sigmoid(value) {
    const safe = Math.max(-40, Math.min(40, value));
    return 1 / (1 + Math.exp(-safe));
  }

  function forward(x, y) {
    const w = state.weights;
    const z = w.inputHidden.map((pair, h) => pair[0] * x + pair[1] * y + w.hiddenBias[h]);
    const hidden = z.map(activate);
    const logit = hidden.reduce((sum, value, h) => sum + value * w.hiddenOutput[h], w.outputBias);
    return { z, hidden, logit, output: sigmoid(logit) };
  }

  function metrics() {
    if (!state.points.length) return { loss: null, accuracy: null, correct: 0 };
    let loss = 0;
    let correct = 0;
    state.points.forEach(([x, y, target]) => {
      const output = forward(x, y).output;
      loss += -(target * Math.log(output + 1e-9) + (1 - target) * Math.log(1 - output + 1e-9));
      if ((output >= 0.5 ? 1 : 0) === target) correct += 1;
    });
    return { loss: loss / state.points.length, accuracy: correct / state.points.length, correct };
  }

  function trainStep() {
    if (!state.points.length) return;
    const w = state.weights;
    const dInputHidden = w.inputHidden.map(() => [0, 0]);
    const dHiddenBias = Array(state.hidden).fill(0);
    const dHiddenOutput = Array(state.hidden).fill(0);
    let dOutputBias = 0;

    state.points.forEach(([x, y, target]) => {
      const result = forward(x, y);
      const dLogit = result.output - target;
      result.hidden.forEach((hiddenValue, h) => {
        dHiddenOutput[h] += dLogit * hiddenValue;
        const dZ = dLogit * w.hiddenOutput[h] * activationDerivative(result.z[h], hiddenValue);
        dInputHidden[h][0] += dZ * x;
        dInputHidden[h][1] += dZ * y;
        dHiddenBias[h] += dZ;
      });
      dOutputBias += dLogit;
    });

    const divisor = state.points.length;
    const rate = state.learningRate;
    w.inputHidden.forEach((pair, h) => {
      pair[0] -= rate * dInputHidden[h][0] / divisor;
      pair[1] -= rate * dInputHidden[h][1] / divisor;
      w.hiddenBias[h] -= rate * dHiddenBias[h] / divisor;
      w.hiddenOutput[h] -= rate * dHiddenOutput[h] / divisor;
    });
    w.outputBias -= rate * dOutputBias / divisor;
    state.epoch += 1;
  }

  function train(count) {
    if (!state.points.length) {
      showToast("먼저 두 범주의 데이터를 추가하세요.");
      return;
    }
    for (let index = 0; index < count; index += 1) trainStep();
    recordHistory();
    render();
  }

  function recordHistory() {
    const current = metrics();
    const last = state.history[state.history.length - 1];
    if (!last || last.epoch !== state.epoch) {
      state.history.push({ epoch: state.epoch, loss: current.loss });
      if (state.history.length > 220) state.history.splice(1, state.history.length - 220);
    }
  }

  function toggleAutoTraining() {
    if (state.autoTimer) {
      stopAutoTraining();
      renderTrainer();
      return;
    }
    if (!state.points.length) {
      showToast("먼저 두 범주의 데이터를 추가하세요.");
      return;
    }
    if (state.epoch >= state.epochGoal) state.epochGoal += 1000;
    state.autoTimer = window.setInterval(() => {
      for (let index = 0; index < 5; index += 1) trainStep();
      recordHistory();
      render();
      if (state.epoch >= state.epochGoal) {
        stopAutoTraining();
        renderTrainer();
      }
    }, 45);
    renderTrainer();
  }

  function stopAutoTraining() {
    if (state.autoTimer) window.clearInterval(state.autoTimer);
    state.autoTimer = null;
  }

  function render() {
    renderControls();
    renderDecisionCanvas();
    renderNeuronCanvases();
    renderNetwork();
    renderMetrics();
    renderTrainer();
    renderLossChart();
    renderPrediction();
    renderExperiments();
  }

  function renderControls() {
    $("#hiddenUnitsOut").value = `${state.hidden}개`;
    $("#learningRateOut").value = state.learningRate.toFixed(2);
    $("#datasetDescription").textContent = PRESETS[state.preset]?.description || PRESETS.custom.description;
    $("#undoPoint").disabled = state.points.length === 0;
  }

  function backgroundColor(probability) {
    const low = [222, 235, 255];
    const middle = [247, 248, 250];
    const high = [255, 228, 210];
    const t = probability < 0.5 ? probability * 2 : (probability - 0.5) * 2;
    const from = probability < 0.5 ? low : middle;
    const to = probability < 0.5 ? middle : high;
    return `rgb(${from.map((value, index) => Math.round(value + (to[index] - value) * t)).join(",")})`;
  }

  function renderDecisionCanvas() {
    const canvas = $("#decisionCanvas");
    const ctx = canvas.getContext("2d");
    const columns = 72;
    const rows = 60;
    const cellWidth = canvas.width / columns;
    const cellHeight = canvas.height / rows;
    const classes = Array.from({ length: rows }, () => Array(columns).fill(0));

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column / (columns - 1) * 2 - 1;
        const y = 1 - row / (rows - 1) * 2;
        const probability = forward(x, y).output;
        classes[row][column] = probability >= 0.5 ? 1 : 0;
        ctx.fillStyle = backgroundColor(probability);
        ctx.fillRect(column * cellWidth, row * cellHeight, cellWidth + 1, cellHeight + 1);
      }
    }

    drawGrid(ctx, canvas);
    ctx.strokeStyle = "rgba(23, 32, 51, .72)";
    ctx.lineWidth = 1.5;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (column < columns - 1 && classes[row][column] !== classes[row][column + 1]) {
          const x = (column + 1) * cellWidth;
          ctx.beginPath(); ctx.moveTo(x, row * cellHeight); ctx.lineTo(x, (row + 1) * cellHeight); ctx.stroke();
        }
        if (row < rows - 1 && classes[row][column] !== classes[row + 1][column]) {
          const y = (row + 1) * cellHeight;
          ctx.beginPath(); ctx.moveTo(column * cellWidth, y); ctx.lineTo((column + 1) * cellWidth, y); ctx.stroke();
        }
      }
    }
    drawPoints(ctx, canvas);
    drawTestMarker(ctx, canvas);
  }

  function drawGrid(ctx, canvas) {
    ctx.save();
    ctx.strokeStyle = "rgba(96, 112, 134, .16)";
    ctx.lineWidth = 1;
    [-0.5, 0, 0.5].forEach((value) => {
      const x = (value + 1) / 2 * canvas.width;
      const y = (1 - value) / 2 * canvas.height;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    });
    ctx.strokeStyle = "rgba(64, 77, 98, .38)";
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
    ctx.restore();
  }

  function drawPoints(ctx, canvas) {
    state.points.forEach(([x, y, target]) => {
      const px = (x + 1) / 2 * canvas.width;
      const py = (1 - y) / 2 * canvas.height;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.fillStyle = target ? COLORS.one : COLORS.zero;
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  function drawTestMarker(ctx, canvas) {
    const x = (state.test.x + 1) / 2 * canvas.width;
    const y = (1 - state.test.y) / 2 * canvas.height;
    ctx.save();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 15, y); ctx.lineTo(x + 15, y); ctx.moveTo(x, y - 15); ctx.lineTo(x, y + 15); ctx.stroke();
    ctx.restore();
  }

  function renderNeuronCanvases() {
    const container = $("#neuronView");
    container.innerHTML = "";
    state.weights.inputHidden.forEach((_, index) => {
      const figure = document.createElement("figure");
      figure.className = "neuron-figure";
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 220;
      canvas.setAttribute("aria-label", `은닉 뉴런 ${index + 1}의 활성화 영역`);
      drawNeuronCanvas(canvas, index);
      const caption = document.createElement("figcaption");
      caption.innerHTML = `<span>h${index + 1}</span><em>w = ${state.weights.inputHidden[index].map((value) => value.toFixed(2)).join(", ")}</em>`;
      figure.append(canvas, caption);
      container.append(figure);
    });
  }

  function drawNeuronCanvas(canvas, index) {
    const ctx = canvas.getContext("2d");
    const columns = 54;
    const rows = 38;
    const width = canvas.width / columns;
    const height = canvas.height / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = column / (columns - 1) * 2 - 1;
        const y = 1 - row / (rows - 1) * 2;
        const result = forward(x, y);
        const activation = result.hidden[index];
        let normalized;
        if (state.activation === "relu") normalized = Math.min(1, activation / 1.5);
        else if (state.activation === "sigmoid") normalized = activation;
        else normalized = (activation + 1) / 2;
        const blue = [222, 235, 255];
        const orange = [255, 228, 210];
        const rgb = blue.map((value, channel) => Math.round(value + (orange[channel] - value) * normalized));
        ctx.fillStyle = `rgb(${rgb.join(",")})`;
        ctx.fillRect(column * width, row * height, width + 1, height + 1);
      }
    }
    drawGrid(ctx, canvas);
    const [w1, w2] = state.weights.inputHidden[index];
    const bias = state.weights.hiddenBias[index];
    ctx.save();
    ctx.strokeStyle = "rgba(23, 32, 51, .85)";
    ctx.lineWidth = 2;
    if (Math.abs(w2) > 1e-6) {
      const yAtLeft = -(w1 * -1 + bias) / w2;
      const yAtRight = -(w1 * 1 + bias) / w2;
      ctx.beginPath();
      ctx.moveTo(0, (1 - yAtLeft) / 2 * canvas.height);
      ctx.lineTo(canvas.width, (1 - yAtRight) / 2 * canvas.height);
      ctx.stroke();
    } else if (Math.abs(w1) > 1e-6) {
      const x = -bias / w1;
      ctx.beginPath(); ctx.moveTo((x + 1) / 2 * canvas.width, 0); ctx.lineTo((x + 1) / 2 * canvas.width, canvas.height); ctx.stroke();
    }
    ctx.restore();
    drawPoints(ctx, canvas);
  }

  function renderNetwork() {
    const svg = $("#networkSvg");
    const inputNodes = [{ x: 46, y: 72, label: "A", value: state.test.x }, { x: 46, y: 162, label: "B", value: state.test.y }];
    const testResult = forward(state.test.x, state.test.y);
    const top = 34;
    const span = 160;
    const hiddenNodes = Array.from({ length: state.hidden }, (_, index) => ({
      x: 164,
      y: state.hidden === 1 ? 110 : top + index * span / (state.hidden - 1),
      label: `h${index + 1}`,
      value: testResult.hidden[index]
    }));
    const outputNode = { x: 286, y: 110, label: "ŷ", value: testResult.output };
    const lines = [];
    inputNodes.forEach((input, inputIndex) => hiddenNodes.forEach((hidden, hiddenIndex) => {
      lines.push(weightLine(input, hidden, state.weights.inputHidden[hiddenIndex][inputIndex]));
    }));
    hiddenNodes.forEach((hidden, index) => lines.push(weightLine(hidden, outputNode, state.weights.hiddenOutput[index])));
    const nodes = [
      ...inputNodes.map((node) => networkNode(node, "input")),
      ...hiddenNodes.map((node) => networkNode(node, "hidden")),
      networkNode(outputNode, "output")
    ];
    svg.innerHTML = `${lines.join("")}${nodes.join("")}<text x="45" y="216" text-anchor="middle" class="layer-label">입력</text><text x="164" y="216" text-anchor="middle" class="layer-label">은닉</text><text x="286" y="216" text-anchor="middle" class="layer-label">출력</text>`;
  }

  function weightLine(from, to, weight) {
    const color = weight >= 0 ? COLORS.positive : COLORS.negative;
    const width = 0.8 + Math.min(5.5, Math.abs(weight) * 3.3);
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="${width}" stroke-opacity=".58"><title>가중치 ${weight.toFixed(4)}</title></line>`;
  }

  function networkNode(node, type) {
    const normalized = type === "output" ? node.value : Math.max(0, Math.min(1, (node.value + 1) / 2));
    const fill = type === "output" ? backgroundColor(normalized) : `rgba(36,99,235,${0.08 + normalized * 0.28})`;
    return `<g><circle cx="${node.x}" cy="${node.y}" r="17" fill="${fill}" stroke="#8c9bb0" stroke-width="1.2"/><text x="${node.x}" y="${node.y + 4}" text-anchor="middle" fill="#24324a" font-size="10" font-family="DM Mono, monospace">${node.label}</text><title>현재 값 ${Number(node.value).toFixed(3)}</title></g>`;
  }

  function renderMetrics() {
    const current = metrics();
    $("#epochMetric").textContent = state.epoch.toLocaleString("ko-KR");
    $("#lossMetric").textContent = current.loss === null ? "—" : current.loss.toFixed(3);
    $("#accuracyMetric").textContent = current.accuracy === null ? "—" : `${Math.round(current.accuracy * 100)}%`;
    $("#dataMetric").textContent = `${state.points.length}개`;
  }

  function renderTrainer() {
    $("#epochNow").textContent = state.epoch.toLocaleString("ko-KR");
    $("#epochGoal").textContent = state.epochGoal.toLocaleString("ko-KR");
    $("#progressBar").style.width = `${Math.min(100, state.epoch / state.epochGoal * 100)}%`;
    const button = $("#autoTrain");
    button.querySelector(".play-icon").textContent = state.autoTimer ? "Ⅱ" : "▶";
    button.querySelector("span:last-child").textContent = state.autoTimer ? "일시정지" : "연속 학습";
  }

  function renderLossChart() {
    const canvas = $("#lossCanvas");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 12, right: 10, bottom: 24, left: 42 };
    ctx.clearRect(0, 0, width, height);
    ctx.font = "10px DM Mono, monospace";
    ctx.fillStyle = "#7a8597";
    ctx.strokeStyle = "#e2e6ec";
    ctx.lineWidth = 1;
    [0, 0.5, 1].forEach((ratio) => {
      const y = padding.top + ratio * (height - padding.top - padding.bottom);
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    });
    const valid = state.history.filter((point) => Number.isFinite(point.loss));
    if (!valid.length) {
      ctx.fillText("데이터를 추가하면 손실이 표시됩니다.", padding.left, height / 2);
      return;
    }
    const maxEpoch = Math.max(1, valid[valid.length - 1].epoch);
    const maxLoss = Math.max(0.8, ...valid.map((point) => point.loss));
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    ctx.fillText(maxLoss.toFixed(2), 4, padding.top + 4);
    ctx.fillText("0", 24, height - padding.bottom + 3);
    ctx.fillText("0", padding.left, height - 5);
    ctx.fillText(`${maxEpoch}회`, width - padding.right - 34, height - 5);
    ctx.beginPath();
    valid.forEach((point, index) => {
      const x = padding.left + point.epoch / maxEpoch * plotWidth;
      const y = padding.top + (1 - point.loss / maxLoss) * plotHeight;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = COLORS.positive;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.stroke();
    const first = valid[0].loss;
    const last = valid[valid.length - 1].loss;
    $("#lossTrend").textContent = state.epoch === 0 ? "학습 전" : last < first ? `${((first - last) / first * 100).toFixed(1)}% 감소` : "감소 없음";
  }

  function renderPrediction() {
    const xInput = Number($("#testX").value);
    const yInput = Number($("#testY").value);
    state.test.x = Number.isFinite(xInput) ? Math.max(-1, Math.min(1, xInput)) : 0;
    state.test.y = Number.isFinite(yInput) ? Math.max(-1, Math.min(1, yInput)) : 0;
    const result = forward(state.test.x, state.test.y);
    const percent = result.output * 100;
    $("#predictionValue").textContent = `${percent.toFixed(1)}%`;
    $("#probabilityBar").style.width = `${percent}%`;
    $("#predictionLabel").textContent = `예측: ${result.output >= 0.5 ? "켜짐 · 범주 1" : "꺼짐 · 범주 0"}`;
    $("#activationValues").innerHTML = result.hidden.map((value, index) => `<span class="activation-pill">h${index + 1} ${value.toFixed(2)}</span>`).join("");
    const formulaLines = result.z.map((z, index) => {
      const [w1, w2] = state.weights.inputHidden[index];
      const bias = state.weights.hiddenBias[index];
      return `h${index + 1} = ${state.activation}(${w1.toFixed(2)}×${state.test.x.toFixed(2)} + ${w2.toFixed(2)}×${state.test.y.toFixed(2)} + ${bias.toFixed(2)})\n   = ${result.hidden[index].toFixed(3)}`;
    });
    formulaLines.push(`ŷ = sigmoid(${result.hidden.map((value, index) => `${state.weights.hiddenOutput[index].toFixed(2)}×${value.toFixed(2)}`).join(" + ")} + ${state.weights.outputBias.toFixed(2)})\n   = ${result.output.toFixed(3)}`);
    $("#formulaPanel").textContent = formulaLines.join("\n");
  }

  function renderExperiments() {
    const body = $("#experimentRows");
    if (!state.experiments.length) {
      body.innerHTML = '<tr class="empty-row"><td colspan="8">기록된 결과가 없습니다.</td></tr>';
      return;
    }
    const bestLoss = Math.min(...state.experiments.map((run) => run.loss));
    body.innerHTML = state.experiments.map((run, index) => `<tr>
      <td>실험 ${index + 1}</td>
      <td>${run.hidden}개</td>
      <td>${run.activation}</td>
      <td>${run.learningRate.toFixed(2)}</td>
      <td>${run.epoch.toLocaleString("ko-KR")}</td>
      <td class="${run.loss === bestLoss ? "best-cell" : ""}">${run.loss.toFixed(3)}</td>
      <td>${Math.round(run.accuracy * 100)}%</td>
      <td><button class="delete-run" type="button" data-delete-run="${index}" aria-label="실험 ${index + 1} 삭제">×</button></td>
    </tr>`).join("");
  }

  function selectPreset(name) {
    state.preset = name;
    state.points = clonePoints(PRESETS[name].points);
    initializeModel();
    showToast(name === "custom" ? "빈 데이터 화면을 만들었습니다." : "활동 데이터를 불러왔습니다.");
  }

  function addPoint(event) {
    const canvas = $("#decisionCanvas");
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    const x = Math.max(-1, Math.min(1, (clientX - rect.left) / rect.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, 1 - (clientY - rect.top) / rect.height * 2));
    state.points.push([x, y, state.pointClass]);
    state.preset = "custom";
    $("#datasetPreset").value = "custom";
    initializeModel();
  }

  function saveExperiment() {
    const current = metrics();
    if (state.epoch === 0 || current.loss === null) {
      showToast("학습을 실행한 뒤 결과를 기록하세요.");
      return;
    }
    state.experiments.push({
      hidden: state.hidden,
      activation: state.activation,
      learningRate: state.learningRate,
      epoch: state.epoch,
      loss: current.loss,
      accuracy: current.accuracy,
      preset: state.preset,
      savedAt: new Date().toISOString()
    });
    if (state.experiments.length > 8) state.experiments.shift();
    window.localStorage.setItem("neuralLabExperiments", JSON.stringify(state.experiments));
    renderExperiments();
    showToast("현재 조건과 결과를 비교표에 기록했습니다.");
  }

  function readExperiments() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem("neuralLabExperiments") || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function persistSettings() {
    try {
      window.localStorage.setItem("neuralLabSettings", JSON.stringify({
        hidden: state.hidden,
        activation: state.activation,
        learningRate: state.learningRate
      }));
    } catch (_) {
      $("#saveStatus").textContent = "현재 세션에서만 유지됨";
    }
  }

  function modelPackage() {
    return {
      format: "neural-lab/model-v2",
      createdAt: new Date().toISOString(),
      task: {
        type: "binary-classification",
        scenario: state.preset,
        inputs: ["switch_A", "switch_B"],
        inputRange: [-1, 1],
        labels: ["off", "on"]
      },
      architecture: {
        inputUnits: 2,
        hiddenUnits: state.hidden,
        hiddenActivation: state.activation,
        outputUnits: 1,
        outputActivation: "sigmoid"
      },
      parameters: JSON.parse(JSON.stringify(state.weights)),
      training: {
        method: "full-batch-gradient-descent",
        learningRate: state.learningRate,
        epochs: state.epoch,
        metrics: metrics()
      },
      trainingData: clonePoints(state.points)
    };
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportJson() {
    download("neural-lab-model.json", JSON.stringify(modelPackage(), null, 2), "application/json");
    showToast("모델 구조와 가중치를 JSON으로 저장했습니다.");
  }

  function exportScratchExtension() {
    const model = modelPackage();
    const embedded = JSON.stringify(model);
    const source = `// Neural Lab에서 생성한 모델 확장\n// TurboWarp: 확장 기능 → 사용자 정의 확장 → 파일 선택\n(function (Scratch) {\n  'use strict';\n  const model = ${embedded};\n  const p = model.parameters;\n  function sigmoid(v) { return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, v)))); }\n  function activate(v) {\n    if (model.architecture.hiddenActivation === 'relu') return Math.max(0, v);\n    if (model.architecture.hiddenActivation === 'sigmoid') return sigmoid(v);\n    return Math.tanh(v);\n  }\n  function predict(x, y) {\n    x = Math.max(-1, Math.min(1, Number(x) || 0));\n    y = Math.max(-1, Math.min(1, Number(y) || 0));\n    const hidden = p.inputHidden.map((w, i) => activate(w[0] * x + w[1] * y + p.hiddenBias[i]));\n    const output = sigmoid(hidden.reduce((sum, value, i) => sum + value * p.hiddenOutput[i], p.outputBias));\n    return { hidden, output };\n  }\n  class NeuralLabModel {\n    getInfo() {\n      return {\n        id: 'neurallabmodel',\n        name: 'Neural Lab 모델',\n        color1: '#2463eb',\n        blocks: [\n          { opcode: 'classify', blockType: Scratch.BlockType.REPORTER, text: '입력 A [X] B [Y] 의 범주', arguments: { X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } } },\n          { opcode: 'probability', blockType: Scratch.BlockType.REPORTER, text: '입력 A [X] B [Y] 의 범주 1 확률', arguments: { X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 } } },\n          { opcode: 'hiddenValue', blockType: Scratch.BlockType.REPORTER, text: '입력 A [X] B [Y] 의 은닉 뉴런 [N] 값', arguments: { X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }, Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }, N: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 } } }\n        ]\n      };\n    }\n    classify(args) { return predict(args.X, args.Y).output >= 0.5 ? '켜짐' : '꺼짐'; }\n    probability(args) { return predict(args.X, args.Y).output; }\n    hiddenValue(args) { const values = predict(args.X, args.Y).hidden; return values[Math.max(0, Math.min(values.length - 1, Math.floor(args.N) - 1))]; }\n  }\n  Scratch.extensions.register(new NeuralLabModel());\n})(Scratch);\n`;
    download("neural-lab-scratch-extension.js", source, "text/javascript");
    showToast("TurboWarp에서 불러올 Scratch 확장 파일을 만들었습니다.");
  }

  function importModel(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const model = JSON.parse(reader.result);
        if (model.format !== "neural-lab/model-v2") throw new Error("지원하지 않는 모델 형식입니다.");
        const hidden = Number(model.architecture.hiddenUnits);
        if (!Number.isInteger(hidden) || hidden < 1 || hidden > 6) throw new Error("은닉 뉴런 정보가 올바르지 않습니다.");
        if (!Array.isArray(model.parameters.inputHidden) || model.parameters.inputHidden.length !== hidden) throw new Error("가중치 크기가 맞지 않습니다.");
        stopAutoTraining();
        state.hidden = hidden;
        state.activation = model.architecture.hiddenActivation;
        state.learningRate = Number(model.training.learningRate);
        state.epoch = Number(model.training.epochs) || 0;
        state.weights = model.parameters;
        state.points = Array.isArray(model.trainingData) ? clonePoints(model.trainingData) : [];
        state.preset = model.task?.scenario && PRESETS[model.task.scenario] ? model.task.scenario : "custom";
        state.history = [];
        recordHistory();
        $("#hiddenUnits").value = state.hidden;
        $("#activation").value = state.activation;
        $("#learningRate").value = state.learningRate;
        $("#datasetPreset").value = state.preset;
        render();
        showToast("모델의 구조와 실제 가중치를 불러왔습니다.");
      } catch (error) {
        showToast(`모델을 불러오지 못했습니다: ${error.message}`);
      }
    };
    reader.readAsText(file);
  }

  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function switchView(view) {
    state.view = view;
    const decision = view === "decision";
    $("#decisionView").hidden = !decision;
    $("#neuronView").hidden = decision;
    $("#decisionTab").classList.toggle("active", decision);
    $("#neuronTab").classList.toggle("active", !decision);
    $("#decisionTab").setAttribute("aria-selected", String(decision));
    $("#neuronTab").setAttribute("aria-selected", String(!decision));
    $("#plotTitle").textContent = decision ? "최종 판단 영역" : "은닉 뉴런별 활성화 경계";
    $("#plotSubtitle").textContent = decision ? "배경색은 범주 1로 예측할 확률을 나타냅니다." : "각 직선은 뉴런의 입력 합이 0이 되는 위치입니다. 최종 분류선과는 다릅니다.";
  }

  function bindEvents() {
    $("#datasetPreset").addEventListener("change", (event) => selectPreset(event.target.value));
    $$("#classPicker button").forEach((button) => button.addEventListener("click", () => {
      state.pointClass = Number(button.dataset.class);
      $$("#classPicker button").forEach((item) => item.classList.toggle("active", item === button));
    }));
    $("#undoPoint").addEventListener("click", () => {
      if (!state.points.length) return;
      state.points.pop();
      state.preset = "custom";
      $("#datasetPreset").value = "custom";
      initializeModel();
    });
    $("#hiddenUnits").addEventListener("input", (event) => {
      state.hidden = Number(event.target.value);
      initializeModel();
    });
    $("#activation").addEventListener("change", (event) => {
      state.activation = event.target.value;
      initializeModel();
    });
    $("#learningRate").addEventListener("input", (event) => {
      state.learningRate = Number(event.target.value);
      $("#learningRateOut").value = state.learningRate.toFixed(2);
      persistSettings();
    });
    $("#resetModel").addEventListener("click", () => initializeModel(true));
    $("#trainOne").addEventListener("click", () => train(1));
    $("#trainTen").addEventListener("click", () => train(10));
    $("#trainHundred").addEventListener("click", () => train(100));
    $("#autoTrain").addEventListener("click", toggleAutoTraining);
    $("#decisionCanvas").addEventListener("click", addPoint);
    $("#decisionTab").addEventListener("click", () => switchView("decision"));
    $("#neuronTab").addEventListener("click", () => switchView("neurons"));
    ["#testX", "#testY"].forEach((selector) => $(selector).addEventListener("input", () => {
      renderPrediction();
      renderNetwork();
      renderDecisionCanvas();
    }));
    $("#toggleFormula").addEventListener("click", () => {
      const panel = $("#formulaPanel");
      panel.hidden = !panel.hidden;
      $("#toggleFormula").textContent = panel.hidden ? "계산식 보기" : "계산식 닫기";
    });
    $("#saveRun").addEventListener("click", saveExperiment);
    $("#experimentRows").addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-run]");
      if (!button) return;
      state.experiments.splice(Number(button.dataset.deleteRun), 1);
      window.localStorage.setItem("neuralLabExperiments", JSON.stringify(state.experiments));
      renderExperiments();
    });
    $("#exportJson").addEventListener("click", exportJson);
    $("#exportScratch").addEventListener("click", exportScratchExtension);
    $("#importJson").addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) importModel(file);
      event.target.value = "";
    });
    $("#openGuide").addEventListener("click", () => $("#guideDialog").showModal());
  }

  function restoreSettings() {
    try {
      const settings = JSON.parse(window.localStorage.getItem("neuralLabSettings") || "null");
      if (!settings) return;
      if (Number.isInteger(settings.hidden) && settings.hidden >= 1 && settings.hidden <= 6) state.hidden = settings.hidden;
      if (["relu", "tanh", "sigmoid"].includes(settings.activation)) state.activation = settings.activation;
      if (Number(settings.learningRate) >= 0.01 && Number(settings.learningRate) <= 0.3) state.learningRate = Number(settings.learningRate);
    } catch (_) {
      // Invalid local settings are ignored.
    }
    $("#hiddenUnits").value = state.hidden;
    $("#activation").value = state.activation;
    $("#learningRate").value = state.learningRate;
  }

  restoreSettings();
  bindEvents();
  initializeModel();
})();
