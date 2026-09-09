import "./styles.css";
import { evaluate, forward } from "./core/neuralNetwork";
import { forwardPixels, initializePixelModel, trainPixelModel, type PixelExample, type PixelModel } from "./core/pixelNetwork";
import { constrainPixelModelToProjection, createPixelFeatureProjection, projectPixels, projectionAxisDetails, projectionExtremes } from "./core/pixelProjection";
import { PRESETS } from "./data/presets";
import { PIXEL_TASKS, type PixelTaskName } from "./data/pixelDatasets";
import { deserializeModel, downloadBlob, downloadText, serializeModel } from "./export/modelJson";
import { generateScratchExtension } from "./export/scratchExtension";
import { createScratchProject } from "./export/scratchProject";
import { createPixelScratchProject } from "./export/pixelScratchProject";
import { createInitialStore, type LabState, type LabStore } from "./state/labStore";
import { PixelLabStore, type PixelLabState } from "./state/pixelLabStore";
import type { ActivationName, Label, PresetName } from "./types";
import { drawDecisionSurface, HIDDEN_COLORS } from "./visualization/decisionSurface";
import { drawLossChart } from "./visualization/lossChart";
import { drawMediaSample, mediaSampleText, playSoundSample, toggleMediaPixel } from "./visualization/mediaSample";
import { networkGraphMarkup } from "./visualization/networkGraph";
import { drawOmrInputCanvas, drawPixelCanvas, drawPixelConversionFrame, drawProjectionContribution, pixelIndexAt, pixelLineIndices } from "./visualization/pixelCanvas";
import { drawPixelFeatureMap, drawPixelLatentMap, drawPixelNeuronMovement, pixelFeatureAccuracy, pixelHiddenLineValue, pixelMapExampleAt } from "./visualization/pixelLatentMap";
import { pixelNetworkGraphMarkup } from "./visualization/pixelNetworkGraph";

function element<T extends Element>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`필수 화면 요소를 찾을 수 없습니다: ${selector}`);
  return found;
}

let toastTimer = 0;
export function showToast(message: string): void {
  const toast = element<HTMLDivElement>("#toast");
  toast.textContent = message; toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function signed(value: number): string { return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(3)}`; }
function isPixelPreset(preset: PresetName): preset is PixelTaskName { return preset === "digits" || preset === "omr"; }

let renderedLessonStep = 0;
function renderLessonProgress(state: LabState): void {
  document.querySelectorAll<HTMLElement>("[data-app-page]").forEach((page) => { page.hidden = Number(page.dataset.appPage) !== state.lessonStep; });
  document.querySelectorAll<HTMLButtonElement>("[data-go-step]").forEach((button) => {
    const step = Number(button.dataset.goStep);
    button.classList.toggle("active", step === state.lessonStep);
    button.classList.toggle("done", step < state.lessonStep);
    if (button.closest(".lesson-progress")) button.disabled = step > state.furthestLessonStep;
  });
  if (renderedLessonStep !== state.lessonStep) window.scrollTo({ top: 0, behavior: renderedLessonStep === 0 ? "auto" : "smooth" });
  renderedLessonStep = state.lessonStep;
}

function renderScenario(state: LabState): void {
  const preset = PRESETS[state.preset];
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((card) => {
    const selected = card.dataset.preset === state.preset;
    card.classList.toggle("selected", selected); card.setAttribute("aria-pressed", String(selected));
  });
  element<HTMLElement>("#scenarioDifficulty").textContent = preset.difficulty;
  element<HTMLElement>("#scenarioName").textContent = preset.title;
  element<HTMLElement>("#scenarioStory").textContent = preset.story;
  element<HTMLElement>("#scenarioQuestion").textContent = preset.question;
  element<HTMLElement>("#scenarioAxisX").textContent = preset.axes[0];
  element<HTMLElement>("#scenarioAxisY").textContent = preset.axes[1];
  element<HTMLElement>("#axisSummary").hidden = isPixelPreset(state.preset);
  element<HTMLElement>("#pixelSummary").hidden = !isPixelPreset(state.preset);
  element<HTMLElement>("#scenarioIllustration").dataset.mediaKind = preset.mediaKind;
  element<HTMLElement>("#datasetDescription").textContent = preset.description;
  element<HTMLElement>("#datasetSourceNote").textContent = preset.sourceNote;
  element<HTMLElement>("#classZeroName").textContent = preset.classes[0];
  element<HTMLElement>("#classOneName").textContent = preset.classes[1];
  element<HTMLElement>("#classZeroButton").textContent = preset.classes[0];
  element<HTMLElement>("#classOneButton").textContent = preset.classes[1];
  element<HTMLElement>("#legendZero").textContent = preset.classes[0];
  element<HTMLElement>("#legendOne").textContent = preset.classes[1];
  element<HTMLElement>("#dataAxisX").textContent = preset.axes[0];
  element<HTMLElement>("#dataAxisY").textContent = preset.axes[1];
  document.querySelectorAll<HTMLElement>(".shared-axis-x").forEach((node) => { node.textContent = preset.axes[0]; });
  document.querySelectorAll<HTMLElement>(".shared-axis-y").forEach((node) => { node.textContent = preset.axes[1]; });
  element<HTMLElement>("#dataCountLabel").textContent = `관찰한 사례 ${state.data.length}개`;
  element<HTMLElement>("#probabilityName").textContent = `${preset.classes[1]}일 가능성`;
  element<HTMLElement>("#weightPositive").textContent = preset.classes[1];
  element<HTMLElement>("#weightNegative").textContent = preset.classes[0];
  const mediaTitles = { sound: "소리 파형 한 개", sketch: "8×8 손그림 한 장", digits: "14×14 손글씨 한 장", omr: "14×14 OMR 한 문항", points: "두 힌트 점 지도" };
  element<HTMLElement>("#mediaTitle").textContent = mediaTitles[preset.mediaKind];
  element<HTMLElement>("#mediaSample").hidden = preset.mediaKind === "points";
  element<HTMLElement>("#pointEditor").hidden = preset.mediaKind !== "points";
  element<HTMLButtonElement>("#playMediaSound").hidden = preset.mediaKind !== "sound";
  element<HTMLElement>("#dataGraphTitle").textContent = preset.mediaKind === "points" ? "관찰 자료" : "두 힌트로 펼친 설명 지도";
}

function renderExperiments(state: LabState, store: LabStore): void {
  const body = element<HTMLTableSectionElement>("#experimentRows"); body.replaceChildren();
  if (state.experiments.length === 0) {
    const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = 8; cell.textContent = "아직 기록이 없습니다."; cell.className = "empty-cell"; return;
  }
  const methodNames = { tanh: "양쪽 변화", relu: "큰 쪽 변화", sigmoid: "0~1 범위" };
  state.experiments.forEach((record, index) => {
    const row = body.insertRow();
    [`#${index + 1}`, `${record.hiddenUnits}개`, methodNames[record.activation], record.learningRate.toFixed(2), `${record.epoch}번`, record.loss.toFixed(4), `${(record.accuracy * 100).toFixed(1)}%`].forEach((value) => { const cell = row.insertCell(); cell.textContent = value; });
    const action = row.insertCell(); const button = document.createElement("button"); button.type = "button"; button.className = "delete-button"; button.textContent = "지우기"; button.addEventListener("click", () => store.deleteExperiment(record.id)); action.append(button);
  });
}

function calculationText(state: LabState): string {
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  const lines = result.hidden.map((value, index) => `규칙 ${index + 1}: 중간값 ${value.toFixed(4)} × 마지막 영향 ${(state.model.parameters.hiddenOutput[index] ?? 0).toFixed(4)}`);
  lines.push(`모든 영향을 합친 점수: ${result.logit.toFixed(4)}`);
  lines.push(`${PRESETS[state.preset].classes[1]}일 가능성: ${(result.probability * 100).toFixed(2)}%`);
  return lines.join("\n");
}

function renderCausalExplanation(state: LabState, store: LabStore): void {
  const target = element<HTMLDivElement>("#causalExplanation");
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => {
    const step = Number(button.dataset.explanationStep);
    button.classList.toggle("active", step === state.explanationStep);
    button.disabled = step > state.furthestExplanationStep;
  });
  const x = state.testInput.x.toFixed(2); const y = state.testInput.y.toFixed(2);
  if (state.explanationStep === 1) {
    target.innerHTML = `<span class="scene-no">장면 1</span><h2>같은 높이에서 옆으로만 움직입니다</h2><p>노란 점과 보라색 십자는 세로 위치가 같습니다. 가로 방향의 힌트 하나만 바꾸면 무엇이 달라지는지 살펴봅니다.</p><div class="plain-rule">노란 점 = 바꾸기 전<br>보라색 십자 = 가로 힌트 하나만 바꾼 뒤</div>`;
    return;
  }
  const neuronButtons = result.z.map((value, index) => `<button type="button" class="neuron-choice ${index === state.selectedNeuron ? "active" : ""}" data-neuron="${index}" style="--neuron-color:${HIDDEN_COLORS[index % HIDDEN_COLORS.length]}"><span>규칙 ${index + 1}</span><strong>중간 점수 ${signed(value)}</strong></button>`).join("");
  if (state.explanationStep === 2) {
    const index = state.selectedNeuron; const weights = state.model.parameters.inputHidden[index] ?? [0, 0]; const bias = state.model.parameters.hiddenBias[index] ?? 0;
    target.innerHTML = `<span class="scene-no">장면 2</span><h2>색 선은 작은 질문 하나입니다</h2><p>가로 힌트 하나를 바꾸어 색 선의 어느 쪽에 놓이는지 봅니다. 색 선 하나만으로 최종 답을 정하지는 않습니다.</p><div class="neuron-choices">${neuronButtons}</div><div class="plain-rule"><b>규칙 ${index + 1}</b><br>색 선을 기준으로 양쪽을 다르게 봅니다.<br>지금 십자의 규칙값: <b>${signed(result.z[index] ?? 0)}</b></div>`;
    target.querySelectorAll<HTMLButtonElement>("[data-neuron]").forEach((button) => button.addEventListener("click", () => store.setSelectedNeuron(Number(button.dataset.neuron))));
    return;
  }
  const contributions = result.hidden.map((value, index) => value * (state.model.parameters.hiddenOutput[index] ?? 0));
  const max = Math.max(.0001, ...contributions.map(Math.abs));
  const rows = contributions.map((value, index) => `<div class="contribution-row"><span>규칙 ${index + 1}</span><div class="contribution-track"><i class="${value >= 0 ? "positive" : "negative"}" style="width:${Math.max(3, Math.abs(value) / max * 50)}%"></i></div><b>${signed(value)}</b></div>`).join("");
  if (state.explanationStep === 3) {
    target.innerHTML = `<span class="scene-no">장면 3</span><h2>작은 질문들의 표를 모읍니다</h2><p>오른쪽 막대는 ${PRESETS[state.preset].classes[1]} 쪽, 왼쪽 막대는 ${PRESETS[state.preset].classes[0]} 쪽 표입니다. 긴 막대의 표가 더 셉니다.</p><div class="contribution-list">${rows}</div><div class="sum-line"><span>모든 표를 더하면</span><strong>합친 값 ${signed(result.logit)}</strong></div>`;
    return;
  }
  target.innerHTML = `<span class="scene-no">장면 4</span><h2>표가 똑같아지는 곳이 검은 선입니다</h2><p>검은 선의 양쪽에서는 더 많은 표를 받은 답이 달라집니다. 검은 선은 어느 색 선 하나를 그대로 베낀 것이 아닙니다.</p><div class="final-equation"><span>${PRESETS[state.preset].classes[1]}일 가능성</span><strong>${(result.probability * 100).toFixed(1)}%</strong><span>지금 모델의 답</span><strong>${result.probability >= .5 ? PRESETS[state.preset].classes[1] : PRESETS[state.preset].classes[0]}</strong></div><div class="plain-rule">검은 선 위에서는 두 답이 50%씩<br>선을 건너면 더 많은 표를 받은 답이 바뀜</div>`;
}

function quizDefinition(state: LabState): { question: string; choices: Array<[string, string]>; correct: string; explanation: string } {
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  const previousX = Math.max(-.9, state.testInput.x - .65); const previous = forward(state.model, previousX, state.testInput.y);
  if (state.explanationStep === 1) return { question: "노란 점에서 십자로 갈 때 그대로인 것은?", choices: [["height", "세로 높이"], ["side", "가로 위치"]], correct: "height", explanation: "옆으로만 움직였으므로 세로 높이는 그대로입니다." };
  if (state.explanationStep === 2) return { question: "이번에 우리가 바꾼 힌트는 몇 개일까요?", choices: [["one", "한 개"], ["two", "두 개"]], correct: "one", explanation: "가로 힌트만 바꾸고 세로 힌트는 그대로 두었습니다." };
  if (state.explanationStep === 3) {
    const increased = result.probability >= previous.probability;
    return { question: `가로 힌트 하나를 바꾼 뒤 ${PRESETS[state.preset].classes[1]} 가능성은?`, choices: [["up", "더 커졌다"], ["down", "더 작아졌다"]], correct: increased ? "up" : "down", explanation: `가능성이 ${(previous.probability * 100).toFixed(0)}%에서 ${(result.probability * 100).toFixed(0)}%로 바뀌었습니다.` };
  }
  return { question: "검은 선 바로 위에서는 두 답의 표가?", choices: [["same", "똑같다"], ["one", "한쪽만 있다"]], correct: "same", explanation: "두 답이 같은 만큼 표를 받는 곳을 이은 것이 검은 선입니다." };
}

function renderQuiz(state: LabState, store: LabStore): void {
  const quiz = quizDefinition(state); const correct = state.quizAnswer === quiz.correct;
  element<HTMLElement>("#stepQuiz").hidden = !state.highlightRevealed;
  element<HTMLElement>("#quizQuestion").textContent = quiz.question;
  const choices = element<HTMLDivElement>("#quizChoices"); choices.replaceChildren();
  quiz.choices.forEach(([value, label]) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "quiz-choice"; button.textContent = label;
    if (correct) button.disabled = true;
    if (state.quizAnswer && value === quiz.correct) button.classList.add("correct");
    if (state.quizAnswer === value && !correct) button.classList.add("wrong");
    button.addEventListener("click", () => store.answerQuiz(value)); choices.append(button);
  });
  const feedback = element<HTMLElement>("#quizFeedback");
  feedback.hidden = state.quizAnswer === null; feedback.className = state.quizAnswer ? `quiz-feedback ${correct ? "correct" : "wrong"}` : "quiz-feedback";
  feedback.textContent = state.quizAnswer ? `${correct ? "맞았습니다! " : "그래프를 다시 보고 골라 보세요. "}${quiz.explanation}` : "";
  const next = element<HTMLButtonElement>("#nextQuiz"); next.hidden = !correct; next.textContent = state.explanationStep === 4 ? "직접 연습시키기 →" : "다음 장면 →";
}

function renderHighlightGuide(state: LabState): void {
  const preset = PRESETS[state.preset]; const previousX = Math.max(-.9, state.testInput.x - .65);
  const before = forward(state.model, previousX, state.testInput.y); const after = forward(state.model, state.testInput.x, state.testInput.y);
  element<HTMLElement>("#highlightInstruction").textContent = `${preset.axes[0].replace("설명 지도: ", "")}만 바꾸고 세로 높이는 그대로 둡니다.`;
  const button = element<HTMLButtonElement>("#revealHighlight"); button.disabled = state.highlightRevealed;
  button.textContent = state.highlightRevealed ? "그래프에 변화가 표시되었습니다" : "그래프에서 한 가지만 바꿔 보기";
  element<HTMLElement>("#highlightResult").textContent = state.highlightRevealed
    ? `노란 점 → 보라 십자 · ${preset.classes[1]} 가능성 ${(before.probability * 100).toFixed(0)}% → ${(after.probability * 100).toFixed(0)}%`
    : "버튼을 누르면 노란 점과 이동 화살표가 나타납니다. 그다음 확인 문제가 열립니다.";
}

function renderProbabilityBars(selector: string, state: PixelLabState, probabilities: number[]): void {
  const container = element<HTMLDivElement>(selector); container.replaceChildren();
  PIXEL_TASKS[state.task].classes.forEach((name, index) => {
    const row = document.createElement("div"); row.className = "probability-row";
    const value = probabilities[index] ?? 0;
    row.innerHTML = `<b>${name}</b><div><i style="width:${(value * 100).toFixed(1)}%"></i></div><strong>${(value * 100).toFixed(1)}%</strong>`;
    container.append(row);
  });
}

interface RepresentativePixelUpdate { before: PixelModel; after: PixelModel; example: PixelExample; neuron: number; beforeValue: number; afterValue: number; }
const representativePixelCache = new Map<string, RepresentativePixelUpdate>();
function representativePixelUpdate(state: PixelLabState): RepresentativePixelUpdate {
  const key = `${state.task}:${state.data.length}:${state.model.hiddenUnits}:${state.model.activation}`; const cached = representativePixelCache.get(key); if (cached) return cached;
  const classCount = PIXEL_TASKS[state.task].classes.length; const before = constrainPixelModelToProjection(initializePixelModel(196, state.model.hiddenUnits, classCount, 31, state.model.activation), state.projection); const candidates = state.data.filter((_, index) => index % 2 === 0);
  let bestScore = Number.NEGATIVE_INFINITY; let bestUpdate: RepresentativePixelUpdate | undefined;
  for (const example of candidates) {
    let after = before; for (let epoch = 0; epoch < 60; epoch += 1) after = constrainPixelModelToProjection(trainPixelModel(after, [example], 1, Math.max(.18, state.learningRate)), state.projection);
    const beforeResult = forwardPixels(before, example.pixels); const afterResult = forwardPixels(after, example.pixels); const beforePrediction = beforeResult.probabilities.indexOf(Math.max(...beforeResult.probabilities)); const afterPrediction = afterResult.probabilities.indexOf(Math.max(...afterResult.probabilities));
    for (let neuron = 0; neuron < state.model.hiddenUnits; neuron += 1) {
      const beforeValue = pixelHiddenLineValue(before, example.pixels, neuron); const afterValue = pixelHiddenLineValue(after, example.pixels, neuron); const crossed = beforeValue * afterValue < 0; const probabilityGain = (afterResult.probabilities[example.label] ?? 0) - (beforeResult.probabilities[example.label] ?? 0); const score = (beforePrediction !== example.label ? 3 : 0) + (afterPrediction === example.label ? 5 : 0) + (crossed ? 12 : 0) + Math.min(4, Math.abs(afterValue - beforeValue)) + probabilityGain * 4;
      if (score > bestScore) { bestScore = score; bestUpdate = { before, after, example, neuron, beforeValue, afterValue }; }
    }
  }
  const fallback = { before, after: before, example: state.data[0]!, neuron: 0, beforeValue: pixelHiddenLineValue(before, state.data[0]!.pixels, 0), afterValue: pixelHiddenLineValue(before, state.data[0]!.pixels, 0) }; const result = bestUpdate ?? fallback; representativePixelCache.set(key, result); return result;
}

function renderPixelUnderstanding(state: PixelLabState): void {
  const info = PIXEL_TASKS[state.task]; const step = state.understandStep;
  document.querySelectorAll<HTMLButtonElement>("[data-pixel-step]").forEach((button) => { const value = Number(button.dataset.pixelStep); button.classList.toggle("active", value === step); button.disabled = value > state.furthestUnderstandStep; });
  const whyCanvas = element<HTMLCanvasElement>("#pixelWhyCanvas"); whyCanvas.classList.toggle("pixel-map-demo", step === 4 || (step === 3 && state.highlightRevealed));
  const changed = state.drawing.map((value, index) => value > 0 ? index : -1).filter((index) => index >= 0).slice(0, 1);
  const explanation = element<HTMLDivElement>("#pixelExplanation");
  const point = projectPixels(state.projection, state.drawing);
  const horizontal = projectionAxisDetails(state.projection, state.drawing, "horizontal"); const positive = horizontal.contributions.filter((value) => value > 0).reduce((sum, value) => sum + value, 0); const negative = horizontal.contributions.filter((value) => value < 0).reduce((sum, value) => sum + value, 0);
  const roundedPositive = Number(positive.toFixed(2)); const roundedNegative = Number(negative.toFixed(2)); const roundedSum = Number((roundedPositive + roundedNegative).toFixed(2)); const wrongSum = Number((roundedPositive - roundedNegative).toFixed(2));
  const representative = horizontal.contributions.reduce((best, value, index) => Math.abs(value) > Math.abs(horizontal.contributions[best] ?? 0) ? index : best, 0); const brightness = state.drawing[representative] ?? 0; const average = state.projection.mean[representative] ?? 0; const difference = brightness - average; const axisWeight = state.projection.horizontal[representative] ?? 0; const contribution = horizontal.contributions[representative] ?? 0;
  const scoreReady = step !== 2 || state.scoreCalcStep === 3; const featureReady = step !== 3 || state.exploredFeatures.length === 3; const quizReady = state.highlightRevealed && scoreReady && featureReady;
  if (step < 4 && !(step === 3 && state.highlightRevealed)) drawPixelCanvas(whyCanvas, state.drawing, step === 1 && state.highlightRevealed ? changed : step === 2 && state.highlightRevealed ? [representative] : [], state.task);
  element<HTMLElement>("#pixelWhyTitle").textContent = step === 4 ? "대표 분류선 한 개" : step === 3 && state.highlightRevealed ? "특징을 바꿔 보는 지도" : step === 2 && state.highlightRevealed ? "노란 칸 하나부터 계산" : "14×14 그림";
  if (step === 1) explanation.innerHTML = `<span class="scene-no">1 / 4</span><h2>그림 196칸이 그대로 들어갑니다</h2><p>검을수록 1, 흴수록 0에 가깝습니다. 모델은 ‘둥글다’ 같은 말을 미리 받지 않습니다.</p><div class="plain-rule"><b>14 × 14 = 196개 밝기</b>가 입력입니다.</div>`;
  if (step === 2) {
    const stages = ["먼저 그림에서 노란 칸 하나를 골라 봅니다.", `① 이 칸의 밝기 ${brightness.toFixed(2)} − 여러 그림의 평균 ${average.toFixed(2)} = <b>${signed(difference)}</b>`, `② 차이 ${signed(difference)} × 이 칸의 가로 방향값 ${signed(axisWeight)} = <b>${signed(contribution)}</b>`, `③ 나머지 195칸도 똑같이 계산해 더합니다.<div class="score-sum"><span>+쪽 합 <b>+${roundedPositive.toFixed(2)}</b></span><span>−쪽 합 <b>${roundedNegative.toFixed(2)}</b></span><strong>= ${roundedSum >= 0 ? "+" : ""}${roundedSum.toFixed(2)}</strong><small>전체 합 ${signed(horizontal.rawScore)} ÷ 지도 크기 ${state.projection.horizontalScale.toFixed(2)} = 가로 점수 <b>${signed(point.x)}</b></small></div>`];
    explanation.innerHTML = `<span class="scene-no">2 / 4</span><h2>한 칸부터 가로 점수를 계산해 봅시다</h2><p>노란 칸이 평소보다 진한지 보고, 어느 쪽으로 미는 칸인지 곱합니다.</p><div class="score-walk">${stages[state.scoreCalcStep]}</div>${state.highlightRevealed && state.scoreCalcStep < 3 ? '<button id="scoreCalcNext" class="button secondary full" type="button">다음 계산 →</button>' : ''}${state.scoreCalcStep === 3 ? '<div class="plain-rule">세로 점수도 같은 방법입니다. 두 점수가 그림을 지도 위 한 점에 놓습니다.</div>' : ''}`;
    explanation.querySelector<HTMLButtonElement>("#scoreCalcNext")?.addEventListener("click", () => pixelUiStore?.advanceScoreCalc());
    if (state.scoreCalcStep === 3) drawProjectionContribution(whyCanvas, state.drawing, state.projection, "horizontal");
  }
  if (step === 3) {
    const dots = info.classes.map((name, index) => `<span style="--dot:${["#f17605", "#df466f", "#7446f5", "#1769d2", "#247a63"][index] ?? "#555"}">${name}</span>`).join("");
    const thought = state.task === "omr" ? "다섯 답은 진한 양이 비슷하고, 칠한 위치가 다릅니다. 어떤 차이를 점수로 쓰면 답들이 가장 잘 떨어질까요?" : "숫자는 검은 칸 수가 같아도 모양이 다를 수 있습니다. 어떤 차이를 함께 보면 좋을까요?";
    const modes = ["position", "ink", "learned"] as const; const scores = Object.fromEntries(modes.map((mode) => [mode, pixelFeatureAccuracy(state.data, createPixelFeatureProjection(state.data, state.task, mode), state.task, mode)])) as Record<PixelLabState["featureView"], number>; const visited = (feature: PixelLabState["featureView"]) => state.exploredFeatures.includes(feature) ? "✓ " : ""; const score = (feature: PixelLabState["featureView"]) => `${Math.round(scores[feature] * 100)}%`;
    const honestNote = state.task === "omr" && scores.position >= scores.learned - .03 ? "이 OMR 자료에서는 답 칸의 좌우 위치가 곧 정답이라 ‘진한 곳의 위치’도 거의 똑같이 잘 나눕니다. 196칸 특징은 표시가 더 흐리거나 찌그러진 자료로 넓힐 때 도움이 됩니다." : "좋은 특징은 같은 답을 모으고 다른 답을 떨어뜨립니다.";
    explanation.innerHTML = `<span class="scene-no">3 / 4</span><h2>어떤 특징이 답을 잘 나눌까요?</h2><p>${thought}</p><div class="feature-choice-row" role="group" aria-label="비교할 그림 특징"><button data-feature-view="position" class="${state.featureView === "position" ? "active" : ""}" type="button">${visited("position")}진한 곳의 위치 <small>${score("position")}</small></button><button data-feature-view="ink" class="${state.featureView === "ink" ? "active" : ""}" type="button">${visited("ink")}진한 양·퍼짐 <small>${score("ink")}</small></button><button data-feature-view="learned" class="${state.featureView === "learned" ? "active" : ""}" type="button">${visited("learned")}196칸에서 찾은 차이 <small>${score("learned")}</small></button></div><div class="class-dot-key">${dots}</div><div class="plain-rule">${honestNote} (${state.exploredFeatures.length}/3 확인)</div>`;
    explanation.querySelectorAll<HTMLButtonElement>("[data-feature-view]").forEach((button) => button.addEventListener("click", () => pixelUiStore?.setFeatureView(button.dataset.featureView as PixelLabState["featureView"])));
    if (state.highlightRevealed) drawPixelFeatureMap(whyCanvas, state.data, state.drawing, createPixelFeatureProjection(state.data, state.task, state.featureView), state.task, state.featureView);
  }
  if (step === 4) {
    const update = representativePixelUpdate(state); const beforeResult = forwardPixels(update.before, update.example.pixels); const afterResult = forwardPixels(update.after, update.example.pixels); const predicted = beforeResult.probabilities.indexOf(Math.max(...beforeResult.probabilities)); const afterPredicted = afterResult.probabilities.indexOf(Math.max(...afterResult.probabilities)); const exampleName = `정답 ${info.classes[update.example.label]}`; const crossed = update.beforeValue * update.afterValue < 0;
    drawPixelNeuronMovement(whyCanvas, update.before, state.highlightRevealed ? update.after : update.before, state.data, update.example.pixels, state.projection, exampleName, update.neuron);
    explanation.innerHTML = `<span class="scene-no">4 / 4</span><h2>틀린 그림 한 장을 고친 전후</h2><p>정답 <b>${info.classes[update.example.label]}</b>를 처음에는 <b>${info.classes[predicted]}</b>로 골랐습니다.</p><div class="line-value-flow"><span>연습 전<b>정답 가능성 ${((beforeResult.probabilities[update.example.label] ?? 0) * 100).toFixed(0)}%</b><small>선 기준값 ${signed(update.beforeValue)}</small></span><i>→</i><span>연습 후<b>정답 가능성 ${((afterResult.probabilities[update.example.label] ?? 0) * 100).toFixed(0)}%</b><small>선 기준값 ${signed(update.afterValue)}</small></span></div><div class="plain-rule">${crossed ? "값이 0을 넘으며 이 점이 선 반대편으로 바뀌었습니다. 주황 화살표가 이 점 가까이에서 선이 옮겨진 거리입니다." : `정답 가능성이 커지고 최종 예상도 ${info.classes[afterPredicted]}로 바뀌었습니다. 주황 화살표가 이 점 가까이에서 선이 옮겨진 거리입니다.`}</div>`;
  }
  element<HTMLElement>("#pixelHighlightInstruction").textContent = step === 1 ? "입력 한 칸을 확인합니다." : step === 2 ? "대표 칸 하나부터 계산합니다." : step === 3 ? "세 가지 특징을 직접 바꿔 비교합니다." : "대표 분류선 하나의 방향을 봅니다.";
  const reveal = element<HTMLButtonElement>("#pixelRevealHighlight"); reveal.disabled = state.highlightRevealed;
  element<HTMLElement>("#pixelWhyView .guided-highlight").hidden = step === 4 && state.highlightRevealed;
  reveal.textContent = state.highlightRevealed ? "확인했습니다" : step === 1 ? "입력 한 칸 보기" : step === 2 ? "첫 계산 시작" : step === 3 ? "특징 지도 열기" : "대표 선 움직이기";
  const featureResult = state.featureView === "position" ? (state.task === "omr" ? "칠한 위치를 쓰면 ①~⑤가 좌우로 잘 떨어집니다." : "진한 부분의 중심만으로는 일부 숫자가 아직 겹칩니다.") : state.featureView === "ink" ? "진한 양과 퍼진 정도가 비슷한 그림은 같은 곳에 겹칩니다." : "학습 자료의 196칸을 비교해 같은 답은 모으고 다른 답은 떨어뜨리는 두 차이를 만들었습니다.";
  element<HTMLElement>("#pixelHighlightResult").textContent = state.highlightRevealed ? (step === 1 ? "표시된 한 칸도 196개 입력 중 하나입니다." : step === 2 ? state.scoreCalcStep < 3 ? "위의 ‘다음 계산’을 눌러 한 칸에서 전체 합까지 따라가세요." : `196칸의 힘을 더해 가로 점수 ${signed(point.x)}를 만들었습니다.` : step === 3 ? featureResult : "회색 점선에서 보라 선으로 이동했습니다. 다음 화면에서는 모든 선에 같은 원리가 적용됩니다.") : "버튼을 누르면 한 가지 변화만 나타납니다.";
  const quiz = element<HTMLElement>("#pixelQuiz"); quiz.hidden = !quizReady;
  element<HTMLElement>("#pixelQuizQuestion").textContent = step === 1 ? "14×14 그림에서 들어가는 밝기는 몇 개일까요?" : step === 2 ? `+${roundedPositive.toFixed(2)}와 ${roundedNegative.toFixed(2)}를 더하면 얼마일까요?` : step === 3 ? "분류에 좋은 두 특징은 점들을 어떻게 놓을까요?" : "대표선이 움직인 직접 이유는 무엇일까요?";
  const choices = element<HTMLDivElement>("#pixelQuizChoices"); choices.replaceChildren();
  const options: ReadonlyArray<readonly [string, boolean]> = step === 1 ? [["196개", true], ["2개", false]] : step === 2 ? [[`${roundedSum >= 0 ? "+" : ""}${roundedSum.toFixed(2)}`, true], [`+${wrongSum.toFixed(2)}`, false]] : step === 3 ? [["같은 답은 모으고 다른 답은 떨어뜨린다", true], ["모든 답을 같은 곳에 겹친다", false]] : [["틀린 그림이 정답 쪽에 놓이도록 연결값을 고쳤기 때문", true], ["선은 그림과 상관없이 늘 같은 방향으로 움직이기 때문", false]];
  options.forEach(([label, correct]) => { const button = document.createElement("button"); button.type = "button"; button.className = "quiz-choice"; button.textContent = label; button.disabled = state.quizPassed; button.addEventListener("click", () => { if (correct) pixelUiStore?.passQuiz(); else showToast("강조된 그림과 설명을 한 번 더 살펴보세요."); }); choices.append(button); });
  const feedback = element<HTMLElement>("#pixelQuizFeedback"); feedback.hidden = !state.quizPassed; feedback.className = "quiz-feedback correct"; feedback.textContent = state.quizPassed ? "맞았습니다! 방금 본 변화와 이어집니다." : "";
  const next = element<HTMLButtonElement>("#pixelQuizNext"); next.hidden = !state.quizPassed; next.textContent = step === 4 ? "직접 연습시키기 →" : "다음 장면 →";
}

let pixelUiStore: PixelLabStore | null = null;
let pixelAutoTimer = 0;
let pixelConversionFrame = 0; let pixelConversionProgress = 0; let pixelConversionSignature = "";
function stopPixelAuto(): void { if (pixelAutoTimer) window.clearInterval(pixelAutoTimer); pixelAutoTimer = 0; }
function resetPixelConversion(): void { if (pixelConversionFrame) window.cancelAnimationFrame(pixelConversionFrame); pixelConversionFrame = 0; pixelConversionProgress = 0; document.querySelector(".pixel-convert-strip")?.classList.remove("is-converting"); const button = document.querySelector<HTMLButtonElement>("#pixelConvertStart"); if (button) { button.disabled = false; button.textContent = "크게 변환해 보기 →"; } }

function renderPixelProjectionStory(state: PixelLabState): { pixels: number[]; label: string } {
  const info = PIXEL_TASKS[state.task]; const selected = state.mapExampleIndex === null ? undefined : state.data[state.mapExampleIndex]; const pixels = selected?.pixels ?? state.drawing; const label = selected ? `정답 ${info.classes[selected.label]}` : "내 그림"; const point = projectPixels(state.projection, pixels);
  const horizontal = projectionExtremes(state.projection, state.data, "horizontal"); const vertical = projectionExtremes(state.projection, state.data, "vertical");
  drawPixelCanvas(element<HTMLCanvasElement>("#pixelProjectionSource"), pixels, [], state.task); drawPixelCanvas(element<HTMLCanvasElement>("#pixelHorizontalNegative"), horizontal.negative.pixels, [], state.task); drawPixelCanvas(element<HTMLCanvasElement>("#pixelHorizontalPositive"), horizontal.positive.pixels, [], state.task); drawPixelCanvas(element<HTMLCanvasElement>("#pixelVerticalNegative"), vertical.negative.pixels, [], state.task); drawPixelCanvas(element<HTMLCanvasElement>("#pixelVerticalPositive"), vertical.positive.pixels, [], state.task);
  element<HTMLElement>("#pixelProjectionSourceName").textContent = label; element<HTMLOutputElement>("#pixelProjectionXScore").value = signed(point.x); element<HTMLOutputElement>("#pixelProjectionYScore").value = signed(point.y); element<HTMLElement>("#pixelHorizontalMarker").style.left = `${((point.x + 1) / 2 * 100).toFixed(1)}%`; element<HTMLElement>("#pixelVerticalMarker").style.left = `${((point.y + 1) / 2 * 100).toFixed(1)}%`;
  const layers = [state.showNeuronBoundaries ? "모든 색 분류선" : "", state.showDecisionBoundary ? "검은 최종 경계선" : ""].filter(Boolean);
  element<HTMLElement>("#pixelMapInstruction").textContent = layers.length === 2 ? "모든 색 분류선과 검은 선을 함께 봅니다." : layers.length === 1 ? `${layers[0]}만 봅니다.` : "학습 그림과 판단 영역만 봅니다.";
  const featureName = state.trainingFeatureView === "position" ? "진한 곳의 위치" : state.trainingFeatureView === "ink" ? "진한 양과 퍼진 정도" : "196칸에서 찾은 두 차이";
  element<HTMLElement>("#pixelGraphNote").textContent = selected ? `${label} 그림입니다. ‘${featureName}’로 계산한 두 점수 때문에 이 자리에 놓였습니다.` : `지금은 ‘${featureName}’로 만든 지도에서 분류선을 연습합니다.`;
  return { pixels, label };
}

function renderPixelLab(lab: LabState, state: PixelLabState): void {
  const pixel = isPixelPreset(lab.preset);
  const pairedViews: Array<[string, string]> = [["#boundaryDataView", "#pixelDataView"], ["#boundaryWhyView", "#pixelWhyView"], ["#boundaryTrainingView", "#pixelTrainingView"], ["#boundaryUseView", "#pixelUseView"]];
  pairedViews.forEach(([boundary, pixelView]) => { element<HTMLElement>(boundary).hidden = pixel; element<HTMLElement>(pixelView).hidden = !pixel; });
  if (!pixel) {
    stopPixelAuto();
    element<HTMLElement>("#dataTitle").textContent = "모델이 배울 사례를 먼저 읽어 봅시다"; element<HTMLElement>("#whyTitle").textContent = "왜 구분선이 저기에 생겼을까요?"; element<HTMLElement>("#whySubtitle").textContent = "한 가지만 바꿔 강조해 본 뒤, 짧은 확인 문제를 풉니다."; element<HTMLElement>("#whyFooterNote").textContent = "노란 점에서 보라색 십자로, 가로 한 가지만 바꿉니다."; element<HTMLElement>("#trainTitle").textContent = "이제 모델이 스스로 고치게 해 봅시다"; element<HTMLElement>("#useTitle").textContent = "새 값을 넣어 보고, 만든 모델을 가져가세요";
    return;
  }
  const info = PIXEL_TASKS[state.task];
  if (lab.lessonStep !== 4) stopPixelAuto();
  element<HTMLElement>("#dataTitle").textContent = "그림이 입력값이 되는 모습을 먼저 봅시다";
  element<HTMLElement>("#whyTitle").textContent = "그림을 그대로 넣으면 어떻게 답을 고를까요?";
  element<HTMLElement>("#whySubtitle").textContent = "한 그림의 점수를 직접 더해 보고, 어떤 특징이 분류에 좋은지 지도에서 확인합니다.";
  element<HTMLElement>("#whyFooterNote").textContent = "그림 196칸 → 점수 더하기 → 좋은 특징 찾기 → 경계 움직임 순서로 살펴봅니다.";
  element<HTMLElement>("#trainTitle").textContent = "이제 모델이 스스로 고치게 해 봅시다";
  element<HTMLElement>("#useTitle").textContent = "처음 보는 그림으로 확인해 봅시다";
  ["#pixelDataCanvas", "#pixelUseCanvas"].forEach((selector) => { const canvas = element<HTMLCanvasElement>(selector); if (state.task === "omr") drawOmrInputCanvas(canvas, state.drawing); else drawPixelCanvas(canvas, state.drawing, [], state.task); });
  const conversionSignature = `${state.task}:${state.drawing.map((value) => value.toFixed(2)).join(",")}`; if (conversionSignature !== pixelConversionSignature) { resetPixelConversion(); pixelConversionSignature = conversionSignature; }
  drawPixelConversionFrame(element<HTMLCanvasElement>("#pixelConvertTarget"), state.drawing, state.task, pixelConversionProgress); element<HTMLElement>("#pixelConvertLabel").textContent = pixelConversionProgress >= 1 ? "완료: 밝기 숫자 196개" : pixelConversionProgress > 0 ? "14×14칸으로 읽는 중" : "변환 전";
  element<HTMLElement>("#pixelDrawTitle").textContent = state.task === "digits" ? "14×14칸에 0·1·2를 그려 보세요" : "답 칸 위에 연필로 칠하듯 직접 그려 보세요";
  element<HTMLElement>("#pixelDataView .think-box p").textContent = "왼쪽 선을 14×14칸에 맞춰 줄이면 각 칸의 밝기 196개가 됩니다. 오른쪽 학습 그림은 바로 이 픽셀값입니다.";
  element<HTMLElement>("#pixelDataCount").textContent = `학습 그림 ${state.data.length}장`;
  const picker = element<HTMLDivElement>("#pixelClassPicker"); picker.replaceChildren();
  info.classes.forEach((name, label) => { const button = document.createElement("button"); button.type = "button"; button.className = label === state.selectedLabel ? "active" : ""; button.textContent = `${name} 정답`; button.addEventListener("click", () => pixelUiStore?.selectLabel(label)); picker.append(button); });
  if (lab.lessonStep === 2) {
    const samples = element<HTMLDivElement>("#pixelSamples"); samples.replaceChildren();
    const stride = Math.max(1, Math.floor(state.data.length / 15)); const shown = state.latestAddedIndex === 0 ? [state.data[0]!, ...state.data.filter((_, index) => index > 0 && index % stride === 0)].slice(0, 15) : state.data.filter((_, index) => index % stride === 0).slice(0, 15);
    shown.forEach((example, index) => { const button = document.createElement("button"); button.type = "button"; button.className = state.latestAddedIndex === 0 && index === 0 ? "newest" : ""; const canvas = document.createElement("canvas"); canvas.width = 140; canvas.height = 140; drawPixelCanvas(canvas, example.pixels, [], state.task); const caption = document.createElement("span"); caption.textContent = state.latestAddedIndex === 0 && index === 0 ? `방금 추가 · 정답 ${info.classes[example.label] ?? "?"}` : `정답 ${info.classes[example.label] ?? "?"}`; button.append(canvas, caption); button.addEventListener("click", () => pixelUiStore?.loadDrawing(example.pixels, example.label)); samples.append(button); });
  }
  if (lab.lessonStep === 3) renderPixelUnderstanding(state);
  const probabilities = pixelUiStore?.probabilities() ?? [];
  if (lab.lessonStep === 4) {
    const metrics = pixelUiStore?.metrics();
    element<HTMLElement>("#pixelEpoch").textContent = String(state.model.epoch); element<HTMLElement>("#pixelEpochNow").textContent = String(state.model.epoch); element<HTMLElement>("#pixelProgressBar").style.width = `${Math.min(100, state.model.epoch / 10)}%`;
    const focus = renderPixelProjectionStory(state); const focusForward = forwardPixels(state.model, focus.pixels); renderProbabilityBars("#pixelTrainBars", state, focusForward.probabilities); element<HTMLSelectElement>("#pixelTrainingFeature").value = state.trainingFeatureView; const trainingScore = Math.round(pixelFeatureAccuracy(state.data, state.projection, state.task, state.trainingFeatureView) * 100); element<HTMLElement>("#pixelTrainingFeatureNote").textContent = `이 특징 지도에서 가까운 무리로 읽으면 ${trainingScore}%입니다. 바꾸면 같은 자료로 다시 시작합니다.`; element<HTMLInputElement>("#pixelHiddenUnits").value = String(state.model.hiddenUnits); element<HTMLOutputElement>("#pixelHiddenOut").value = `${state.model.hiddenUnits}개`; element<HTMLSelectElement>("#pixelActivation").value = state.model.activation; element<HTMLInputElement>("#pixelLearningRate").value = String(state.learningRate); element<HTMLOutputElement>("#pixelLearningRateOut").value = state.learningRate.toFixed(2); drawPixelLatentMap(element<HTMLCanvasElement>("#pixelLatentCanvas"), state.model, state.data, focus.pixels, state.projection, { view: "decision", focusLabel: focus.label, showNeuronBoundaries: state.showNeuronBoundaries, showDecisionBoundary: state.showDecisionBoundary });
    element<HTMLInputElement>("#pixelNeuronLayer").checked = state.showNeuronBoundaries; element<HTMLInputElement>("#pixelDecisionLayer").checked = state.showDecisionBoundary;
    drawPixelCanvas(element<HTMLCanvasElement>("#pixelNetworkFocusCanvas"), focus.pixels, [], state.task); element<HTMLElement>("#pixelNetworkFocusLabel").textContent = focus.label; element<SVGSVGElement>("#pixelNetworkSvg").innerHTML = pixelNetworkGraphMarkup(state.model, info.classes, focusForward.hidden, focusForward.probabilities);
    element<HTMLButtonElement>("#pixelAutoTrain").textContent = pixelAutoTimer ? "잠시 멈추기" : "계속 연습";
    element<HTMLElement>("#pixelLoss").textContent = metrics?.loss.toFixed(4) ?? "—"; element<HTMLElement>("#pixelAccuracy").textContent = metrics ? `${(metrics.accuracy * 100).toFixed(1)}%` : "—"; element<HTMLElement>("#pixelTrainCount").textContent = `${state.data.length}장`; drawLossChart(element<HTMLCanvasElement>("#pixelLossCanvas"), state.history);
  }
  if (lab.lessonStep === 5) { renderProbabilityBars("#pixelUseBars", state, probabilities); const best = probabilities.indexOf(Math.max(...probabilities)); element<HTMLElement>("#pixelPredictionAnswer").textContent = state.model.epoch ? `모델의 답: ${info.classes[best]}` : "먼저 모델을 연습시켜 주세요"; element<HTMLElement>("#pixelUseView .think-box p").textContent = "파일에는 지금 그린 196칸이 이미 들어 있습니다. Scratch에서 ‘픽셀 그림 예측하기’ 나의 블록을 실행하면 됩니다."; }
}

function render(state: LabState, store: LabStore, pixelStore: PixelLabStore): void {
  renderLessonProgress(state); renderScenario(state);
  const metrics = evaluate(state.model, state.data); const prediction = forward(state.model, state.testInput.x, state.testInput.y); const preset = PRESETS[state.preset];
  element<HTMLInputElement>("#hiddenUnits").value = String(state.model.config.hiddenUnits);
  element<HTMLOutputElement>("#hiddenUnitsOut").value = `${state.model.config.hiddenUnits}개`;
  element<HTMLSelectElement>("#activation").value = state.model.config.activation;
  element<HTMLInputElement>("#learningRate").value = String(state.model.config.learningRate);
  element<HTMLOutputElement>("#learningRateOut").value = state.model.config.learningRate.toFixed(2);
  element<HTMLButtonElement>("#undoPoint").disabled = state.data.length === 0;
  document.querySelectorAll<HTMLButtonElement>("#classPicker button").forEach((button) => button.classList.toggle("active", Number(button.dataset.class) === state.pointClass));
  element<HTMLInputElement>("#boundaryNeuronLayer").checked = state.showNeuronBoundaries;
  element<HTMLInputElement>("#boundaryDecisionLayer").checked = state.showDecisionBoundary;
  element<HTMLElement>("#boundaryMapInstruction").textContent = state.showNeuronBoundaries && state.showDecisionBoundary ? "모든 색 분류선과 검은 선을 함께 봅니다." : state.showNeuronBoundaries ? "모든 색 분류선을 봅니다." : state.showDecisionBoundary ? "검은 최종 경계선만 봅니다." : "자료 점과 판단 영역만 봅니다.";
  if (state.lessonStep === 2 && !isPixelPreset(state.preset)) {
    drawDecisionSurface(element<HTMLCanvasElement>("#dataCanvas"), state.model, state.data, state.testInput, { explanationStep: 1 });
    if (preset.mediaKind !== "points") {
      drawMediaSample(element<HTMLCanvasElement>("#mediaCanvas"), preset.mediaKind, state.mediaSampleIndex, state.mediaHighlight);
      element<HTMLCanvasElement>("#mediaCanvas").dataset.drawable = String(preset.mediaKind === "sketch" || preset.mediaKind === "digits");
      element<HTMLElement>("#mediaSampleText").textContent = mediaSampleText(preset.mediaKind, state.mediaSampleIndex, state.mediaHighlight);
      element<HTMLButtonElement>("#toggleMediaHighlight").textContent = state.mediaHighlight ? "강조 지우기" : "한 부분만 강조";
    }
  }
  if (state.lessonStep === 4 && !isPixelPreset(state.preset)) {
    drawDecisionSurface(element<HTMLCanvasElement>("#modelCanvas"), state.model, state.data, state.testInput, { explanationStep: 4, selectedNeuron: state.selectedNeuron, showNeuronBoundaries: state.showNeuronBoundaries, showDecisionBoundary: state.showDecisionBoundary });
    drawLossChart(element<HTMLCanvasElement>("#lossCanvas"), state.history);
    element<SVGSVGElement>("#networkSvg").innerHTML = networkGraphMarkup(state.model, prediction.hidden);
  }
  if (state.lessonStep === 3 && !isPixelPreset(state.preset)) {
    drawDecisionSurface(element<HTMLCanvasElement>("#decisionCanvas"), state.model, state.data, state.testInput, { explanationStep: state.explanationStep, selectedNeuron: state.selectedNeuron, highlightRevealed: state.highlightRevealed });
    renderCausalExplanation(state, store); renderHighlightGuide(state); renderQuiz(state, store);
  }
  element<HTMLElement>("#epochMetric").textContent = String(state.model.epoch);
  element<HTMLElement>("#lossMetric").textContent = metrics.loss === null ? "—" : metrics.loss.toFixed(4);
  element<HTMLElement>("#accuracyMetric").textContent = metrics.accuracy === null ? "—" : `${(metrics.accuracy * 100).toFixed(1)}%`;
  element<HTMLElement>("#dataMetric").textContent = `${state.data.length}개`;
  element<HTMLElement>("#epochNow").textContent = String(state.model.epoch); element<HTMLElement>("#epochGoal").textContent = String(state.epochGoal);
  element<HTMLElement>("#progressBar").style.width = `${Math.min(100, (state.model.epoch / state.epochGoal) * 100)}%`;
  element<HTMLButtonElement>("#autoTrain").textContent = state.autoTraining ? "잠시 멈추기" : "계속 연습";
  element<HTMLInputElement>("#testX").value = String(state.testInput.x); element<HTMLInputElement>("#testY").value = String(state.testInput.y);
  element<HTMLElement>("#predictionValue").textContent = `${(prediction.probability * 100).toFixed(1)}%`;
  element<HTMLElement>("#predictionLabel").textContent = `모델의 답: ${prediction.probability >= .5 ? preset.classes[1] : preset.classes[0]}`;
  element<HTMLElement>("#probabilityBar").style.width = `${prediction.probability * 100}%`;
  const values = element<HTMLDivElement>("#activationValues"); values.replaceChildren();
  prediction.hidden.forEach((value, index) => { const item = document.createElement("span"); item.textContent = `규칙 ${index + 1}: ${value.toFixed(3)}`; values.append(item); });
  element<HTMLPreElement>("#formulaPanel").textContent = calculationText(state);
  const titles = ["옆으로 한 가지만 바꾸기", "작은 질문의 색 선", "여러 표를 한데 모으기", "두 답이 같아지는 검은 선"];
  const subtitles = ["노란 점과 보라 십자의 세로 높이를 비교하세요.", "한 번에 가로 힌트 하나만 바꿉니다.", "바꾸기 전과 뒤의 가능성을 비교하세요.", "검은 선 위에서는 두 답이 같은 표를 받습니다."];
  element<HTMLElement>("#plotTitle").textContent = titles[state.explanationStep - 1]!;
  element<HTMLElement>("#plotSubtitle").textContent = subtitles[state.explanationStep - 1]!;
  if (state.lessonStep === 5) renderExperiments(state, store);
  renderPixelLab(state, pixelStore.snapshot);
}

function addPointFromCanvas(event: MouseEvent, store: LabStore): void {
  const canvas = event.currentTarget as HTMLCanvasElement; const rect = canvas.getBoundingClientRect();
  store.addDataPoint(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
  showToast("새 사례를 점으로 추가했습니다.");
}

export function mountApp(store = createInitialStore()): LabStore {
  const pixelStore = new PixelLabStore(isPixelPreset(store.snapshot.preset) ? store.snapshot.preset : "digits"); pixelUiStore = pixelStore;
  const rerender = () => render(store.snapshot, store, pixelStore);
  store.subscribe(rerender); pixelStore.subscribe(rerender);
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((card) => card.addEventListener("click", () => { const preset = card.dataset.preset as PresetName; if (isPixelPreset(preset)) pixelStore.setTask(preset); store.setPreset(preset); }));
  document.querySelectorAll<HTMLButtonElement>("[data-go-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.goStep) as LabState["lessonStep"]; if (step <= store.snapshot.furthestLessonStep) store.setLessonStep(step); }));
  document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => store.previousLesson()));
  element<HTMLButtonElement>("#scenarioNext").addEventListener("click", () => store.setLessonStep(2));
  element<HTMLButtonElement>("#dataNext").addEventListener("click", () => { if (isPixelPreset(store.snapshot.preset)) { pixelStore.resetUnderstanding(); store.setLessonStep(3); return; } if (store.snapshot.data.length < 2) return showToast("서로 다른 결과의 사례를 먼저 두 개 이상 만들어 주세요."); const error = store.prepareExplanationModel(); if (error) return showToast(error); store.setLessonStep(3); });
  element<HTMLButtonElement>("#modelNext").addEventListener("click", () => { if (isPixelPreset(store.snapshot.preset)) { if (pixelStore.snapshot.model.epoch === 0) return showToast("모델을 적어도 한 번 연습시켜 주세요."); store.setLessonStep(5); return; } if (store.snapshot.model.epoch === 0) return showToast("모델을 적어도 한 번 연습시켜 주세요."); store.setLessonStep(5); });
  element<HTMLButtonElement>("#restoreData").addEventListener("click", () => { store.setPreset(store.snapshot.preset); showToast("처음 자료로 되돌렸습니다."); });
  element<HTMLButtonElement>("#undoPoint").addEventListener("click", () => store.undoDataPoint());
  document.querySelectorAll<HTMLButtonElement>("#classPicker button").forEach((button) => button.addEventListener("click", () => store.setPointClass(Number(button.dataset.class) as Label)));
  element<HTMLInputElement>("#hiddenUnits").addEventListener("input", (event) => store.setConfig({ hiddenUnits: Number((event.currentTarget as HTMLInputElement).value) }));
  element<HTMLSelectElement>("#activation").addEventListener("change", (event) => store.setConfig({ activation: (event.currentTarget as HTMLSelectElement).value as ActivationName }));
  element<HTMLInputElement>("#learningRate").addEventListener("change", (event) => store.setConfig({ learningRate: Number((event.currentTarget as HTMLInputElement).value) }));
  element<HTMLButtonElement>("#resetModel").addEventListener("click", () => { store.resetModel(); showToast("연습 전 상태로 되돌렸습니다."); });
  element<HTMLInputElement>("#boundaryNeuronLayer").addEventListener("change", (event) => store.setLayers({ showNeuronBoundaries: (event.currentTarget as HTMLInputElement).checked }));
  element<HTMLInputElement>("#boundaryDecisionLayer").addEventListener("change", (event) => store.setLayers({ showDecisionBoundary: (event.currentTarget as HTMLInputElement).checked }));
  ([["#trainOne", 1], ["#trainTen", 10], ["#trainHundred", 100]] as const).forEach(([selector, count]) => element<HTMLButtonElement>(selector).addEventListener("click", () => { const error = store.trainEpochs(count); if (error) showToast(error); }));
  element<HTMLButtonElement>("#autoTrain").addEventListener("click", () => { const error = store.toggleAuto(); if (error) showToast(error); });
  element<HTMLCanvasElement>("#dataCanvas").addEventListener("click", (event) => addPointFromCanvas(event, store));
  element<HTMLButtonElement>("#nextMediaSample").addEventListener("click", () => store.nextMediaSample());
  element<HTMLButtonElement>("#toggleMediaHighlight").addEventListener("click", () => store.toggleMediaHighlight());
  element<HTMLButtonElement>("#playMediaSound").addEventListener("click", () => playSoundSample(store.snapshot.mediaSampleIndex));
  element<HTMLCanvasElement>("#mediaCanvas").addEventListener("click", (event) => {
    const state = store.snapshot; const kind = PRESETS[state.preset].mediaKind;
    if (toggleMediaPixel(event.currentTarget as HTMLCanvasElement, event, kind, state.mediaSampleIndex, state.mediaHighlight)) showToast("그림 한 칸을 바꿨습니다. 전체 모양이 어떻게 달라지는지 보세요.");
  });
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.explanationStep) as LabState["explanationStep"]; if (step <= store.snapshot.furthestExplanationStep) store.setExplanationStep(step); }));
  element<HTMLButtonElement>("#revealHighlight").addEventListener("click", () => store.revealHighlight());
  element<HTMLButtonElement>("#nextQuiz").addEventListener("click", () => { if (store.snapshot.explanationStep === 4) store.beginPractice(); else store.nextQuiz(); });
  const updateInput = () => store.setTestInput(Number(element<HTMLInputElement>("#testX").value), Number(element<HTMLInputElement>("#testY").value));
  element<HTMLInputElement>("#testX").addEventListener("input", updateInput); element<HTMLInputElement>("#testY").addEventListener("input", updateInput);
  element<HTMLButtonElement>("#toggleFormula").addEventListener("click", (event) => { const panel = element<HTMLPreElement>("#formulaPanel"); panel.hidden = !panel.hidden; (event.currentTarget as HTMLButtonElement).textContent = panel.hidden ? "계산 자세히" : "계산 닫기"; });
  element<HTMLButtonElement>("#saveRun").addEventListener("click", () => { const error = store.saveExperiment(); showToast(error ?? "지금 결과를 기록했습니다."); });
  element<HTMLButtonElement>("#exportJson").addEventListener("click", () => { const model = store.exportModel(); if (model) downloadText("neural-lab-model.json", serializeModel(model), "application/json"); });
  element<HTMLButtonElement>("#exportScratch").addEventListener("click", () => downloadText("neural-lab-turbowarp.js", generateScratchExtension(store.snapshot.model), "text/javascript"));
  element<HTMLButtonElement>("#exportScratchProject").addEventListener("click", () => { downloadBlob("neural-lab-scratch.sb3", createScratchProject(store.snapshot.model)); showToast("Scratch에서 열 수 있는 블록 파일을 만들었습니다."); });
  element<HTMLInputElement>("#importJson").addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { store.importModel(deserializeModel(await file.text())); store.setLessonStep(5); showToast("보관한 모델을 열었습니다."); } catch (error) { showToast(error instanceof Error ? error.message : "파일을 열지 못했습니다."); } finally { input.value = ""; } });
  let drawing = false;
  ["#pixelDataCanvas", "#pixelUseCanvas"].forEach((selector) => {
    const canvas = element<HTMLCanvasElement>(selector);
    let previousPixel: number | null = null;
    const paint = (event: PointerEvent) => { if (!drawing) return; const current = pixelIndexAt(canvas, event.clientX, event.clientY); pixelStore.paintMany(previousPixel === null ? [current] : pixelLineIndices(previousPixel, current), 1); previousPixel = current; };
    canvas.addEventListener("pointerdown", (event) => { drawing = true; previousPixel = null; canvas.setPointerCapture(event.pointerId); paint(event); });
    canvas.addEventListener("pointermove", paint);
    canvas.addEventListener("pointerup", () => { drawing = false; previousPixel = null; }); canvas.addEventListener("pointercancel", () => { drawing = false; previousPixel = null; });
  });
  ["#pixelClear", "#pixelUseClear"].forEach((selector) => element<HTMLButtonElement>(selector).addEventListener("click", () => pixelStore.clear()));
  element<HTMLButtonElement>("#pixelAdd").addEventListener("click", () => { pixelStore.addDrawing(); window.requestAnimationFrame(() => { element<HTMLElement>("#pixelSamples").scrollTop = 0; }); showToast(`${PIXEL_TASKS[pixelStore.snapshot.task].classes[pixelStore.snapshot.selectedLabel]} 자료를 맨 앞에 추가했습니다.`); });
  let sampleIndex = 1;
  element<HTMLButtonElement>("#pixelUseSample").addEventListener("click", () => { const classes = PIXEL_TASKS[pixelStore.snapshot.task].classes; const label = sampleIndex % classes.length; pixelStore.loadSample(label, sampleIndex); sampleIndex += 1; });
  element<HTMLButtonElement>("#pixelRevealHighlight").addEventListener("click", () => pixelStore.revealHighlight());
  document.querySelectorAll<HTMLButtonElement>("[data-pixel-step]").forEach((button) => button.addEventListener("click", () => pixelStore.setUnderstandStep(Number(button.dataset.pixelStep) as 1 | 2 | 3 | 4)));
  element<HTMLButtonElement>("#pixelQuizNext").addEventListener("click", () => { if (pixelStore.snapshot.understandStep === 4) { pixelStore.resetModel(); store.setLessonStep(4); } else pixelStore.nextUnderstand(); });
  ([ ["#pixelTrainOne", 1], ["#pixelTrainTen", 10], ["#pixelTrainHundred", 100] ] as const).forEach(([selector, epochs]) => element<HTMLButtonElement>(selector).addEventListener("click", () => pixelStore.train(epochs)));
  element<HTMLButtonElement>("#pixelResetModel").addEventListener("click", () => { pixelStore.resetModel(); showToast("픽셀 모델을 연습 전 상태로 되돌렸습니다."); });
  element<HTMLInputElement>("#pixelHiddenUnits").addEventListener("input", (event) => { pixelStore.setHiddenUnits(Number((event.currentTarget as HTMLInputElement).value)); showToast("규칙 찾기 칸 수를 바꾸어 분류선을 처음부터 다시 만들었습니다."); });
  element<HTMLSelectElement>("#pixelActivation").addEventListener("change", (event) => { pixelStore.setActivation((event.currentTarget as HTMLSelectElement).value as ActivationName); showToast("중간값을 바꾸는 방법을 적용해 처음부터 다시 시작했습니다."); });
  element<HTMLInputElement>("#pixelLearningRate").addEventListener("change", (event) => pixelStore.setLearningRate(Number((event.currentTarget as HTMLInputElement).value)));
  element<HTMLSelectElement>("#pixelTrainingFeature").addEventListener("change", (event) => { stopPixelAuto(); const feature = (event.currentTarget as HTMLSelectElement).value as PixelLabState["trainingFeatureView"]; pixelStore.setTrainingFeature(feature); showToast("고른 특징으로 그림 지도를 다시 만들고 연습 전 상태로 돌아갔습니다."); });
  element<HTMLInputElement>("#pixelNeuronLayer").addEventListener("change", (event) => pixelStore.setLayers({ showNeuronBoundaries: (event.currentTarget as HTMLInputElement).checked }));
  element<HTMLInputElement>("#pixelDecisionLayer").addEventListener("change", (event) => pixelStore.setLayers({ showDecisionBoundary: (event.currentTarget as HTMLInputElement).checked }));
  element<HTMLCanvasElement>("#pixelLatentCanvas").addEventListener("click", (event) => { const state = pixelStore.snapshot; const index = pixelMapExampleAt(event.currentTarget as HTMLCanvasElement, event.clientX, event.clientY, state.projection, state.data); pixelStore.selectMapExample(index); if (index === null) showToast("점을 누르면 그 그림의 좌표 계산을 볼 수 있습니다."); });
  element<HTMLButtonElement>("#pixelAutoTrain").addEventListener("click", () => { if (pixelAutoTimer) { stopPixelAuto(); rerender(); return; } pixelAutoTimer = window.setInterval(() => { if (!isPixelPreset(store.snapshot.preset) || store.snapshot.lessonStep !== 4 || pixelStore.snapshot.model.epoch >= 1000) { stopPixelAuto(); rerender(); return; } pixelStore.train(5); }, 100); pixelStore.train(1); });
  element<HTMLButtonElement>("#pixelConvertStart").addEventListener("click", () => { const strip = element<HTMLElement>(".pixel-convert-strip"); if (strip.classList.contains("is-converting") && pixelConversionProgress >= 1) { strip.classList.remove("is-converting"); const closeButton = element<HTMLButtonElement>("#pixelConvertStart"); closeButton.textContent = "크게 변환해 보기 →"; return; } resetPixelConversion(); strip.classList.add("is-converting"); const button = element<HTMLButtonElement>("#pixelConvertStart"); button.disabled = true; const start = performance.now(); const animate = (now: number) => { pixelConversionProgress = Math.min(1, (now - start) / 1300); drawPixelConversionFrame(element<HTMLCanvasElement>("#pixelConvertTarget"), pixelStore.snapshot.drawing, pixelStore.snapshot.task, pixelConversionProgress); element<HTMLElement>("#pixelConvertLabel").textContent = pixelConversionProgress < .45 ? "왼쪽부터 14×14칸으로 읽는 중" : pixelConversionProgress < 1 ? "각 칸을 밝기 숫자로 바꾸는 중" : "완료: 밝기 숫자 196개"; if (pixelConversionProgress < 1) pixelConversionFrame = window.requestAnimationFrame(animate); else { pixelConversionFrame = 0; button.disabled = false; button.textContent = "확인하고 닫기"; } }; pixelConversionFrame = window.requestAnimationFrame(animate); });
  element<HTMLButtonElement>("#pixelExportScratch").addEventListener("click", () => { const state = pixelStore.snapshot; downloadBlob("neural-lab-pixel-scratch.sb3", createPixelScratchProject(state.model, PIXEL_TASKS[state.task].classes, state.drawing)); showToast("Scratch의 나의 블록과 지금 그린 196칸을 함께 만들었습니다."); });
  element<HTMLButtonElement>("#pixelExportJson").addEventListener("click", () => downloadText("neural-lab-pixel-model.json", JSON.stringify({ format: "neural-lab/pixel-model-v1", task: pixelStore.snapshot.task, size: 14, classes: PIXEL_TASKS[pixelStore.snapshot.task].classes, model: pixelStore.snapshot.model }, null, 2), "application/json"));
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();
