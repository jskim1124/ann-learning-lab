import "./styles.css";
import { forward, evaluate } from "./core/neuralNetwork";
import { deserializeModel, downloadBlob, downloadText, serializeModel } from "./export/modelJson";
import { generateScratchExtension } from "./export/scratchExtension";
import { createScratchProject } from "./export/scratchProject";
import { PRESETS } from "./data/presets";
import { createInitialStore, type LabState, type LabStore } from "./state/labStore";
import type { ActivationName, Label, PresetName } from "./types";
import { drawDecisionSurface, HIDDEN_COLORS } from "./visualization/decisionSurface";
import { drawNeuronSurface } from "./visualization/neuronSurface";
import { networkGraphMarkup } from "./visualization/networkGraph";
import { drawLossChart } from "./visualization/lossChart";

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`필수 화면 요소를 찾을 수 없습니다: ${selector}`);
  return found;
}

let toastTimer = 0;
export function showToast(message: string): void {
  const toast = element<HTMLDivElement>("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function renderNeuronCards(state: LabState): void {
  const container = element<HTMLDivElement>("#neuronView");
  container.replaceChildren();
  state.model.parameters.inputHidden.forEach((weights, index) => {
    const card = document.createElement("article");
    card.className = "neuron-card";
    const title = document.createElement("h4");
    title.textContent = `은닉 뉴런 H${index + 1}`;
    const canvas = document.createElement("canvas");
    canvas.width = 250; canvas.height = 205;
    canvas.setAttribute("aria-label", `은닉 뉴런 ${index + 1}의 실제 활성화 영역과 중간 경계`);
    const detail = document.createElement("p");
    detail.textContent = `wA ${weights[0].toFixed(3)} · wB ${weights[1].toFixed(3)} · b ${(state.model.parameters.hiddenBias[index] ?? 0).toFixed(3)}`;
    card.append(title, canvas, detail);
    container.append(card);
    drawNeuronSurface(canvas, state.model, index);
  });
  const note = document.createElement("p");
  note.className = "boundary-note";
  note.textContent = "각 검은 직선은 wA·A + wB·B + b = 0인 중간 특징 경계입니다. 최종 분류선이 아니며, 출력층이 모든 은닉 뉴런의 값을 조합해 최종 판단 영역을 만듭니다.";
  container.append(note);
}

function renderExperiments(state: LabState, store: LabStore): void {
  const body = element<HTMLTableSectionElement>("#experimentRows");
  body.replaceChildren();
  if (state.experiments.length === 0) {
    const row = body.insertRow(); row.className = "empty-row";
    const cell = row.insertCell(); cell.colSpan = 8; cell.textContent = "기록된 결과가 없습니다.";
    return;
  }
  const best = Math.min(...state.experiments.map((record) => record.loss));
  state.experiments.forEach((record, index) => {
    const row = body.insertRow();
    const values = [`#${index + 1}`, `${record.hiddenUnits}개`, record.activation, record.learningRate.toFixed(2), `${record.epoch}`, record.loss.toFixed(4), `${(record.accuracy * 100).toFixed(1)}%`];
    values.forEach((value, valueIndex) => {
      const cell = row.insertCell(); cell.textContent = value;
      if (valueIndex === 5 && record.loss === best) { cell.className = "best"; cell.title = "가장 낮은 손실"; }
    });
    const actionCell = row.insertCell();
    const button = document.createElement("button"); button.className = "delete-button"; button.type = "button"; button.textContent = "삭제";
    button.setAttribute("aria-label", `실험 ${index + 1} 삭제`); button.addEventListener("click", () => store.deleteExperiment(record.id));
    actionCell.append(button);
  });
}

function formulaText(state: LabState): string {
  const { x, y } = state.testInput;
  const result = forward(state.model, x, y);
  const lines = result.z.map((z, index) => {
    const weights = state.model.parameters.inputHidden[index] ?? [0, 0];
    const bias = state.model.parameters.hiddenBias[index] ?? 0;
    return `H${index + 1}: ${state.model.config.activation}(${weights[0].toFixed(4)}×${x.toFixed(2)} + ${weights[1].toFixed(4)}×${y.toFixed(2)} + ${bias.toFixed(4)}) = ${(result.hidden[index] ?? 0).toFixed(6)}  [z=${z.toFixed(6)}]`;
  });
  const terms = result.hidden.map((value, index) => `${(state.model.parameters.hiddenOutput[index] ?? 0).toFixed(4)}×${value.toFixed(6)}`).join(" + ");
  lines.push(`출력: sigmoid(${terms} + ${state.model.parameters.outputBias.toFixed(4)})`);
  lines.push(`     = sigmoid(${result.logit.toFixed(6)}) = ${result.probability.toFixed(6)}`);
  return lines.join("\n");
}

function signed(value: number): string { return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(4)}`; }

function renderCausalExplanation(state: LabState, store: LabStore): void {
  const target = element<HTMLDivElement>("#causalExplanation");
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => {
    const active = Number(button.dataset.explanationStep) === state.explanationStep;
    button.classList.toggle("active", active); button.setAttribute("aria-current", active ? "step" : "false");
  });
  const x = state.testInput.x.toFixed(2); const y = state.testInput.y.toFixed(2);
  if (state.explanationStep === 1) {
    target.innerHTML = `<div class="causal-copy"><span class="cause-number">1</span><div><h4>먼저 탐침 입력의 위치를 확인합니다</h4><p>보라색 십자 <strong>A=${x}, B=${y}</strong>는 지금 설명할 한 점입니다. 아직 어떤 경계도 그리지 않았습니다. 좌표를 바꾸면 아래의 모든 계산도 함께 바뀝니다.</p><p class="cause-callout">학습 데이터는 정답의 예시이고, 탐침은 완성된 모델에 질문하는 새 입력입니다.</p></div></div>`;
    return;
  }
  const neuronButtons = result.z.map((z, index) => `<button type="button" class="neuron-choice ${index === state.selectedNeuron ? "active" : ""}" data-neuron="${index}" style="--neuron-color:${HIDDEN_COLORS[index % HIDDEN_COLORS.length]}"><span>H${index + 1}</span><strong>z ${signed(z)}</strong></button>`).join("");
  if (state.explanationStep === 2) {
    const index = state.selectedNeuron; const weights = state.model.parameters.inputHidden[index] ?? [0, 0]; const bias = state.model.parameters.hiddenBias[index] ?? 0;
    target.innerHTML = `<div class="causal-copy"><span class="cause-number">2</span><div><h4>각 은닉 뉴런은 자기만의 ‘중간 기준선’을 만듭니다</h4><p>선을 선택해 실제 식을 추적하세요. 화살표는 <strong>z가 커지는 쪽</strong>입니다. 이 선들은 재료이지 최종 분류선이 아닙니다.</p><div class="neuron-choices">${neuronButtons}</div><div class="equation-box"><span>H${index + 1}의 선형 계산</span><strong>${weights[0].toFixed(3)}×${x} + ${weights[1].toFixed(3)}×${y} ${signed(bias)} = z ${signed(result.z[index] ?? 0)}</strong><p>경계 자체에서는 z=0입니다. 지금 탐침의 활성화값은 ${state.model.config.activation}(z) = <b>${(result.hidden[index] ?? 0).toFixed(4)}</b>입니다.</p></div></div></div>`;
    target.querySelectorAll<HTMLButtonElement>("[data-neuron]").forEach((button) => button.addEventListener("click", () => store.setSelectedNeuron(Number(button.dataset.neuron))));
    return;
  }
  const contributions = result.hidden.map((value, index) => value * (state.model.parameters.hiddenOutput[index] ?? 0));
  const maxMagnitude = Math.max(.0001, ...contributions.map(Math.abs));
  const contributionRows = contributions.map((value, index) => `<div class="contribution-row"><span>H${index + 1}</span><div class="contribution-track"><i class="${value >= 0 ? "positive" : "negative"}" style="width:${Math.max(2, Math.abs(value) / maxMagnitude * 50)}%"></i></div><code>${result.hidden[index]!.toFixed(3)} × ${(state.model.parameters.hiddenOutput[index] ?? 0).toFixed(3)} = ${signed(value)}</code></div>`).join("");
  if (state.explanationStep === 3) {
    target.innerHTML = `<div class="causal-copy"><span class="cause-number">3</span><div><h4>출력층이 중간 특징을 더하고 뺍니다</h4><p>은닉 뉴런 수만큼 선이 생겨도 그대로 답이 되지는 않습니다. 출력 가중치가 각 활성화값의 영향력을 정하고, 모두 더한 값이 <strong>logit</strong>입니다.</p><div class="contribution-list">${contributionRows}</div><div class="sum-line"><span>출력 편향 ${signed(state.model.parameters.outputBias)}</span><strong>모든 기여의 합 = logit ${signed(result.logit)}</strong></div></div></div>`;
    return;
  }
  target.innerHTML = `<div class="causal-copy"><span class="cause-number final">4</span><div><h4>합계가 0이 되는 자리가 최종 검은 경계입니다</h4><p>sigmoid(0)=0.5이므로, 공간의 각 위치에서 <strong>출력 가중합 + 편향 = 0</strong>인 점들을 이은 것이 최종 경계입니다. 그래서 어느 H 선과도 꼭 일치하지 않습니다.</p><div class="final-equation"><span>탐침의 logit</span><strong>${signed(result.logit)}</strong><span>sigmoid 변환</span><strong>${(result.probability * 100).toFixed(2)}%</strong><span>최종 판단</span><strong>범주 ${result.probability >= .5 ? 1 : 0}</strong></div><p class="cause-callout">그림의 색은 같은 계산을 모든 좌표에서 반복한 확률이고, 검은 선은 정확히 50%인 위치입니다.</p></div></div>`;
}

function quizDefinition(state: LabState): { question: string; choices: Array<[string, string]>; correct: string; explanation: string } {
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  if (state.quizIndex === 0) return { question: "H1의 색 선 하나가 곧 최종 분류선일까요?", choices: [["yes", "그렇다"], ["no", "아니다"]], correct: "no", explanation: "각 H 선은 중간 특징의 z=0 기준입니다. 최종선은 모든 H의 출력 기여와 편향을 더한 값이 0인 곳입니다." };
  if (state.quizIndex === 1) {
    const values = result.hidden.map((value, index) => Math.abs(value * (state.model.parameters.hiddenOutput[index] ?? 0)));
    const correctIndex = values.indexOf(Math.max(...values));
    return { question: "현재 탐침에서 출력에 가장 크게 기여한 은닉 뉴런은?", choices: values.map((_, index) => [`h${index}`, `H${index + 1}`]), correct: `h${correctIndex}`, explanation: `|활성화값 × 출력 가중치|가 가장 큰 것은 H${correctIndex + 1}입니다.` };
  }
  const correct = result.logit >= 0 ? "one" : "zero";
  return { question: `현재 logit ${signed(result.logit)}의 예측 범주는?`, choices: [["zero", "범주 0"], ["one", "범주 1"]], correct, explanation: "logit이 0 이상이면 sigmoid 확률이 0.5 이상이므로 범주 1, 음수이면 범주 0입니다." };
}

function renderQuiz(state: LabState, store: LabStore): void {
  const quiz = quizDefinition(state); const answered = state.quizAnswer !== null; const correct = state.quizAnswer === quiz.correct;
  element<HTMLElement>("#quizQuestion").textContent = quiz.question;
  const choices = element<HTMLDivElement>("#quizChoices"); choices.replaceChildren();
  quiz.choices.forEach(([value, label]) => { const button = document.createElement("button"); button.type = "button"; button.className = "quiz-choice"; button.textContent = label; button.disabled = answered; if (answered && value === quiz.correct) button.classList.add("correct"); if (answered && value === state.quizAnswer && !correct) button.classList.add("wrong"); button.addEventListener("click", () => store.answerQuiz(value)); choices.append(button); });
  const feedback = element<HTMLElement>("#quizFeedback"); feedback.hidden = !answered; feedback.className = answered ? `quiz-feedback ${correct ? "correct" : "wrong"}` : "quiz-feedback"; feedback.textContent = answered ? `${correct ? "정답입니다. " : "다시 생각해 봅시다. "}${quiz.explanation}` : "";
  element<HTMLButtonElement>("#nextQuiz").hidden = !answered;
}

function render(state: LabState, store: LabStore): void {
  const metrics = evaluate(state.model, state.data);
  const prediction = forward(state.model, state.testInput.x, state.testInput.y);
  const preset = element<HTMLSelectElement>("#datasetPreset"); preset.value = state.preset;
  element<HTMLElement>("#datasetDescription").textContent = PRESETS[state.preset].description;
  element<HTMLInputElement>("#hiddenUnits").value = String(state.model.config.hiddenUnits);
  element<HTMLOutputElement>("#hiddenUnitsOut").value = `${state.model.config.hiddenUnits}개`;
  element<HTMLSelectElement>("#activation").value = state.model.config.activation;
  element<HTMLInputElement>("#learningRate").value = String(state.model.config.learningRate);
  element<HTMLOutputElement>("#learningRateOut").value = state.model.config.learningRate.toFixed(2);
  element<HTMLButtonElement>("#undoPoint").disabled = state.data.length === 0;
  document.querySelectorAll<HTMLButtonElement>("#classPicker button").forEach((button) => button.classList.toggle("active", Number(button.dataset.class) === state.pointClass));
  const decision = element<HTMLDivElement>("#decisionView"); const neurons = element<HTMLDivElement>("#neuronView");
  decision.hidden = state.view !== "decision"; neurons.hidden = state.view !== "neurons";
  element<HTMLButtonElement>("#decisionTab").classList.toggle("active", state.view === "decision");
  element<HTMLButtonElement>("#neuronTab").classList.toggle("active", state.view === "neurons");
  element<HTMLButtonElement>("#decisionTab").setAttribute("aria-selected", String(state.view === "decision"));
  element<HTMLButtonElement>("#neuronTab").setAttribute("aria-selected", String(state.view === "neurons"));
  const decisionTitles = ["입력과 학습 데이터", "은닉 뉴런의 중간 기준선", "출력층이 조합한 확률 영역", "완성된 최종 판단 경계"];
  const decisionSubtitles = ["탐침점에서 출발합니다. 아직 모델의 선은 표시하지 않습니다.", "색 선은 각 H의 z=0, 화살표는 z가 증가하는 방향입니다.", "배경색은 모든 H의 출력 기여를 합쳐 계산한 범주 1 확률입니다.", "옅은 색 선은 중간 기준, 검은 선은 출력 가중합이 0인 최종 0.5 경계입니다."];
  element<HTMLElement>("#plotTitle").textContent = state.view === "decision" ? decisionTitles[state.explanationStep - 1]! : "은닉 뉴런별 활성화 영역";
  element<HTMLElement>("#plotSubtitle").textContent = state.view === "decision" ? decisionSubtitles[state.explanationStep - 1]! : "색은 실제 활성화값, 검은 직선은 각 뉴런의 선형 결합이 0인 중간 경계입니다.";
  drawDecisionSurface(element<HTMLCanvasElement>("#decisionCanvas"), state.model, state.data, state.testInput, { explanationStep: state.explanationStep, selectedNeuron: state.selectedNeuron });
  renderCausalExplanation(state, store);
  renderQuiz(state, store);
  renderNeuronCards(state);
  drawLossChart(element<HTMLCanvasElement>("#lossCanvas"), state.history);
  element<SVGSVGElement>("#networkSvg").innerHTML = networkGraphMarkup(state.model, prediction.hidden);
  element<HTMLElement>("#epochMetric").textContent = String(state.model.epoch);
  element<HTMLElement>("#lossMetric").textContent = metrics.loss === null ? "—" : metrics.loss.toFixed(4);
  element<HTMLElement>("#accuracyMetric").textContent = metrics.accuracy === null ? "—" : `${(metrics.accuracy * 100).toFixed(1)}%`;
  element<HTMLElement>("#dataMetric").textContent = `${state.data.length}개`;
  element<HTMLElement>("#epochNow").textContent = String(state.model.epoch);
  element<HTMLElement>("#epochGoal").textContent = String(state.epochGoal);
  element<HTMLElement>("#progressBar").style.width = `${Math.min(100, (state.model.epoch / state.epochGoal) * 100)}%`;
  const auto = element<HTMLButtonElement>("#autoTrain"); auto.textContent = state.autoTraining ? "Ⅱ 일시정지" : "▶ 연속 학습";
  element<HTMLElement>("#predictionValue").textContent = `${(prediction.probability * 100).toFixed(1)}%`;
  element<HTMLElement>("#predictionLabel").textContent = `예측: ${prediction.probability >= 0.5 ? "켜짐 · 범주 1" : "꺼짐 · 범주 0"}`;
  element<HTMLInputElement>("#testX").value = String(state.testInput.x); element<HTMLInputElement>("#testY").value = String(state.testInput.y);
  element<HTMLElement>("#probabilityBar").style.width = `${prediction.probability * 100}%`;
  const values = element<HTMLDivElement>("#activationValues"); values.replaceChildren();
  prediction.hidden.forEach((value, index) => { const item = document.createElement("span"); item.textContent = `H${index + 1} ${value.toFixed(4)}`; values.append(item); });
  element<HTMLPreElement>("#formulaPanel").textContent = formulaText(state);
  renderExperiments(state, store);
}

export function mountApp(store = createInitialStore()): LabStore {
  store.subscribe((state) => render(state, store));
  element<HTMLSelectElement>("#datasetPreset").addEventListener("change", (event) => store.setPreset((event.currentTarget as HTMLSelectElement).value as PresetName));
  element<HTMLButtonElement>("#restoreData").addEventListener("click", () => { store.setPreset("xor"); showToast("기본 XOR 데이터를 복원했습니다."); });
  element<HTMLButtonElement>("#undoPoint").addEventListener("click", () => store.undoDataPoint());
  document.querySelectorAll<HTMLButtonElement>("#classPicker button").forEach((button) => button.addEventListener("click", () => store.setPointClass(Number(button.dataset.class) as Label)));
  element<HTMLInputElement>("#hiddenUnits").addEventListener("input", (event) => store.setConfig({ hiddenUnits: Number((event.currentTarget as HTMLInputElement).value) }));
  element<HTMLSelectElement>("#activation").addEventListener("change", (event) => store.setConfig({ activation: (event.currentTarget as HTMLSelectElement).value as ActivationName }));
  element<HTMLInputElement>("#learningRate").addEventListener("change", (event) => store.setConfig({ learningRate: Number((event.currentTarget as HTMLInputElement).value) }));
  element<HTMLButtonElement>("#resetModel").addEventListener("click", () => { store.resetModel(); showToast("같은 초기값으로 모델을 다시 만들었습니다."); });
  element<HTMLButtonElement>("#decisionTab").addEventListener("click", () => store.setView("decision"));
  element<HTMLButtonElement>("#neuronTab").addEventListener("click", () => store.setView("neurons"));
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => button.addEventListener("click", () => store.setExplanationStep(Number(button.dataset.explanationStep) as LabState["explanationStep"])));
  element<HTMLButtonElement>("#nextQuiz").addEventListener("click", () => store.nextQuiz());
  ([["#trainOne", 1], ["#trainTen", 10], ["#trainHundred", 100]] as const).forEach(([selector, epochs]) => element<HTMLButtonElement>(selector).addEventListener("click", () => { const error = store.trainEpochs(epochs); if (error) showToast(error); }));
  element<HTMLButtonElement>("#autoTrain").addEventListener("click", () => { const error = store.toggleAuto(); if (error) showToast(error); });
  const updateInput = () => store.setTestInput(Number(element<HTMLInputElement>("#testX").value), Number(element<HTMLInputElement>("#testY").value));
  element<HTMLInputElement>("#testX").addEventListener("input", updateInput); element<HTMLInputElement>("#testY").addEventListener("input", updateInput);
  element<HTMLCanvasElement>("#decisionCanvas").addEventListener("click", (event) => { const canvas = event.currentTarget as HTMLCanvasElement; const rect = canvas.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 2 - 1; const y = 1 - ((event.clientY - rect.top) / rect.height) * 2; store.addDataPoint(x, y); showToast("점을 추가해 모델을 같은 초기값으로 다시 만들었습니다."); });
  element<HTMLButtonElement>("#toggleFormula").addEventListener("click", (event) => { const panel = element<HTMLPreElement>("#formulaPanel"); panel.hidden = !panel.hidden; (event.currentTarget as HTMLButtonElement).textContent = panel.hidden ? "계산식 보기" : "계산식 닫기"; });
  element<HTMLButtonElement>("#saveRun").addEventListener("click", () => { const error = store.saveExperiment(); showToast(error ?? "현재 조건과 결과를 기록했습니다."); });
  element<HTMLButtonElement>("#exportJson").addEventListener("click", () => { const model = store.exportModel(); if (!model) return showToast("저장할 데이터가 없습니다."); downloadText("neural-lab-model.json", serializeModel(model), "application/json"); });
  element<HTMLButtonElement>("#exportScratch").addEventListener("click", () => downloadText("neural-lab-turbowarp.js", generateScratchExtension(store.snapshot.model), "text/javascript"));
  element<HTMLButtonElement>("#exportScratchProject").addEventListener("click", () => { downloadBlob("neural-lab-scratch.sb3", createScratchProject(store.snapshot.model)); showToast("공식 Scratch용 블록 프로젝트를 만들었습니다."); });
  element<HTMLInputElement>("#importJson").addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { store.importModel(deserializeModel(await file.text())); showToast("모델과 데이터를 복원했습니다."); } catch (error) { showToast(error instanceof Error ? error.message : "모델을 불러오지 못했습니다."); } finally { input.value = ""; } });
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();
