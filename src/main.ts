import "./styles.css";
import { evaluate, forward } from "./core/neuralNetwork";
import { forwardPixels } from "./core/pixelNetwork";
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
import { drawNeuronSurface } from "./visualization/neuronSurface";
import { drawPixelCanvas, drawProjectionContribution, pixelIndexAt } from "./visualization/pixelCanvas";
import { drawPixelLatentMap, pixelMapExampleAt, projectPixels } from "./visualization/pixelLatentMap";
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

function renderNeuronCards(state: LabState): void {
  const container = element<HTMLDivElement>("#neuronView"); container.replaceChildren();
  state.model.parameters.inputHidden.forEach((weights, index) => {
    const card = document.createElement("article"); card.className = "neuron-card";
    const title = document.createElement("h3"); title.textContent = `규칙 찾기 칸 ${index + 1}`;
    const canvas = document.createElement("canvas"); canvas.width = 280; canvas.height = 190;
    canvas.setAttribute("aria-label", `규칙 찾기 칸 ${index + 1}이 나눈 두 영역`);
    const detail = document.createElement("p");
    detail.textContent = `가로 영향 ${signed(weights[0])} · 세로 영향 ${signed(weights[1])} · 기준값 ${signed(state.model.parameters.hiddenBias[index] ?? 0)}`;
    card.append(title, canvas, detail); container.append(card); drawNeuronSurface(canvas, state.model, index);
  });
  const note = document.createElement("p"); note.className = "boundary-note";
  note.textContent = "각 칸의 선은 중간 기준입니다. 마지막 검은 선은 이 기준들을 모두 합친 뒤에 정해집니다.";
  container.append(note);
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

function renderPixelUnderstanding(state: PixelLabState): void {
  const info = PIXEL_TASKS[state.task]; const step = state.understandStep;
  document.querySelectorAll<HTMLButtonElement>("[data-pixel-step]").forEach((button) => { const value = Number(button.dataset.pixelStep); button.classList.toggle("active", value === step); button.disabled = value > step; });
  const changed = state.drawing.map((value, index) => value > 0 ? index : -1).filter((index) => index >= 0).slice(0, step === 1 ? 1 : 8);
  drawPixelCanvas(element<HTMLCanvasElement>("#pixelWhyCanvas"), state.drawing, state.highlightRevealed ? changed : []);
  const explanation = element<HTMLDivElement>("#pixelExplanation");
  if (step === 1) explanation.innerHTML = `<span class="scene-no">장면 1</span><h2>그림 한 칸도 입력 하나입니다</h2><p>검은 칸은 1에 가깝고 흰 칸은 0에 가깝습니다. 14×14 그림이므로 신경망에 들어가는 밝기는 모두 196개입니다.</p><div class="plain-rule">그림을 ‘둥글다’ 같은 말로 바꾸지 않아요.<br><b>칸 196개의 밝기를 그대로 넣어요.</b></div>`;
  if (step === 2) explanation.innerHTML = `<span class="scene-no">장면 2</span><h2>196칸을 두 점수로 펼쳐 위치를 정합니다</h2><p>각 칸이 보통 그림보다 얼마나 밝거나 어두운지 두 가지 기준 그림과 겹쳐 봅니다. 같은 방향의 차이는 더하고 반대 방향은 빼서 가로·세로 점수를 만듭니다.</p><div class="why-projection-mini"><div><span>가로 기준과 겹친 칸</span><canvas id="pixelWhyProjectionX" width="112" height="84"></canvas><b id="pixelWhyXScore"></b></div><i>+</i><div><span>세로 기준과 겹친 칸</span><canvas id="pixelWhyProjectionY" width="112" height="84"></canvas><b id="pixelWhyYScore"></b></div><i>→</i><strong id="pixelWhyCoordinate"></strong></div><div class="plain-rule">주황 칸은 +쪽, 보라 칸은 −쪽으로 점을 끕니다.<br><b>이렇게 계산한 좌표는 학습 중에도 바뀌지 않습니다.</b></div>`;
  if (step === 3) explanation.innerHTML = `<span class="scene-no">장면 3</span><h2>색 점선은 정답선이 아니라 뉴런의 기준입니다</h2><p>색 점선은 196칸 전체를 보는 뉴런의 기준을 설명 지도 위에서 잘라 보여 준 모습입니다. 각 뉴런은 −1부터 +1 사이의 신호를 만들고, ${info.classes.join("·")} 출력칸은 이 신호들을 서로 다르게 섞습니다.</p><div class="pixel-flow small"><span><b>${state.model.hiddenUnits}</b> 뉴런 신호</span><i>→</i><span><b>${info.classes.length}</b> 답 점수</span></div><div class="plain-rule">그래서 점선 ${state.model.hiddenUnits}개가 답 ${info.classes.length}개를 하나씩 맡지 않아도 됩니다.<br><b>검은 선은 가장 큰 답 점수가 바뀌는 곳</b>입니다.</div>`;
  if (step === 2) { const point = projectPixels(state.projection, state.drawing); drawProjectionContribution(element<HTMLCanvasElement>("#pixelWhyProjectionX"), state.drawing, state.projection, "horizontal"); drawProjectionContribution(element<HTMLCanvasElement>("#pixelWhyProjectionY"), state.drawing, state.projection, "vertical"); element<HTMLElement>("#pixelWhyXScore").textContent = `가로 ${signed(point.x)}`; element<HTMLElement>("#pixelWhyYScore").textContent = `세로 ${signed(point.y)}`; element<HTMLElement>("#pixelWhyCoordinate").textContent = `좌표 (${signed(point.x)}, ${signed(point.y)})`; }
  if (step === 3) { const bars = document.createElement("div"); bars.id = "pixelWhyBars"; bars.className = "probability-bars"; explanation.append(bars); renderProbabilityBars("#pixelWhyBars", state, pixelUiStore?.probabilities() ?? []); }
  element<HTMLElement>("#pixelHighlightInstruction").textContent = step === 1 ? "그림에서 입력으로 들어가는 칸 하나를 확인합니다." : step === 2 ? "가로·세로 점수에 쓰이는 칸을 색으로 확인합니다." : "색 점선과 검은 분류선의 역할을 구별합니다.";
  const reveal = element<HTMLButtonElement>("#pixelRevealHighlight"); reveal.disabled = state.highlightRevealed; reveal.textContent = state.highlightRevealed ? "확인했습니다" : step === 1 ? "입력 칸 한 개 보기" : step === 2 ? "좌표 계산 확인하기" : "두 종류의 선 구별하기";
  element<HTMLElement>("#pixelHighlightResult").textContent = state.highlightRevealed ? (step === 1 ? "노란 테두리 한 칸도 196개 입력 중 하나입니다." : step === 2 ? "위의 두 색 그림에서 196칸의 영향을 더해 좌표 하나를 만들었습니다." : "색 점선은 뉴런 신호의 기준이고, 검은 선은 최종 답이 바뀌는 경계입니다.") : "버튼을 누르면 방금 본 내용을 한 문장으로 확인하고 문제가 열립니다.";
  const quiz = element<HTMLElement>("#pixelQuiz"); quiz.hidden = !state.highlightRevealed;
  element<HTMLElement>("#pixelQuizQuestion").textContent = step === 1 ? "14×14 그림에서 모델로 들어가는 밝기는 몇 개일까요?" : step === 2 ? "가로·세로 점수는 무엇으로 만들까요?" : "색 점선 하나는 무엇을 나타낼까요?";
  const choices = element<HTMLDivElement>("#pixelQuizChoices"); choices.replaceChildren();
  const options = step === 1 ? [["196", true], ["2", false]] as const : step === 2 ? [["그림 196칸의 차이", true], ["점의 색만", false]] as const : [["뉴런 신호가 0인 기준", true], ["숫자 하나의 정답선", false]] as const;
  options.forEach(([label, correct]) => { const button = document.createElement("button"); button.type = "button"; button.className = "quiz-choice"; button.textContent = label; button.disabled = state.quizPassed; button.addEventListener("click", () => { if (correct) pixelUiStore?.passQuiz(); else showToast("강조된 그림과 설명을 한 번 더 살펴보세요."); }); choices.append(button); });
  const feedback = element<HTMLElement>("#pixelQuizFeedback"); feedback.hidden = !state.quizPassed; feedback.className = "quiz-feedback correct"; feedback.textContent = state.quizPassed ? "맞았습니다! 방금 본 변화와 이어집니다." : "";
  const next = element<HTMLButtonElement>("#pixelQuizNext"); next.hidden = !state.quizPassed; next.textContent = step === 3 ? "직접 연습시키기 →" : "다음 장면 →";
}

let pixelUiStore: PixelLabStore | null = null;
let pixelAutoTimer = 0;
function stopPixelAuto(): void { if (pixelAutoTimer) window.clearInterval(pixelAutoTimer); pixelAutoTimer = 0; }

function renderPixelProjectionStory(state: PixelLabState): { pixels: number[]; label: string } {
  const info = PIXEL_TASKS[state.task]; const selected = state.mapExampleIndex === null ? undefined : state.data[state.mapExampleIndex]; const pixels = selected?.pixels ?? state.drawing; const label = selected ? `학습 그림 ${state.mapExampleIndex! + 1} · 정답 ${info.classes[selected.label]}` : "내가 그린 그림"; const point = projectPixels(state.projection, pixels); const result = forwardPixels(state.model, pixels);
  drawPixelCanvas(element<HTMLCanvasElement>("#pixelProjectionSource"), pixels); drawProjectionContribution(element<HTMLCanvasElement>("#pixelProjectionX"), pixels, state.projection, "horizontal"); drawProjectionContribution(element<HTMLCanvasElement>("#pixelProjectionY"), pixels, state.projection, "vertical");
  element<HTMLElement>("#pixelProjectionSourceName").textContent = label; element<HTMLOutputElement>("#pixelProjectionXScore").value = signed(point.x); element<HTMLOutputElement>("#pixelProjectionYScore").value = signed(point.y); element<HTMLElement>("#pixelProjectionCoordinate").textContent = `가로 ${signed(point.x)} · 세로 ${signed(point.y)}`;
  const chips = element<HTMLDivElement>("#pixelSignalChips"); chips.replaceChildren();
  const addChip = (name: string, value: string, index: number) => { const chip = document.createElement("span"); chip.style.setProperty("--chip-color", ["#7457c7", "#247a63", "#d06c2c", "#1769d2", "#bd4e78"][index % 5]!); chip.innerHTML = `<b>${name}</b>${value}`; chips.append(chip); };
  if (state.view === "placement") {
    element<HTMLElement>("#pixelMapInstruction").textContent = "그림이 왜 이 자리에 놓였는지 먼저 봅니다."; element<HTMLElement>("#pixelGraphReasonTitle").textContent = "굵은 테두리 점은 위에서 계산한 그림입니다"; element<HTMLElement>("#pixelGraphReasonText").textContent = "가로 점수와 세로 점수를 좌표로 사용했습니다. 다른 점을 누르면 그 그림과 좌표 계산이 위에 바로 나타납니다."; addChip("가로", signed(point.x), 3); addChip("세로", signed(point.y), 4);
  } else if (state.view === "neurons") {
    element<HTMLElement>("#pixelMapInstruction").textContent = "색 점선은 정답선이 아니라 각 뉴런 신호의 0 기준입니다."; element<HTMLElement>("#pixelGraphReasonTitle").textContent = `점선 ${state.model.hiddenUnits}개가 답 ${info.classes.length}개를 하나씩 맡는 것이 아닙니다`; element<HTMLElement>("#pixelGraphReasonText").textContent = "각 뉴런은 196칸 전체를 계산해 −1부터 +1 사이의 신호를 만듭니다. 색 선은 그 기준을 설명 지도에 잘라 보여 준 것이며, 실제 신호값은 아래에 표시됩니다."; result.hidden.slice(0, 6).forEach((value, index) => addChip(`뉴런 ${index + 1}`, signed(value), index));
  } else {
    element<HTMLElement>("#pixelMapInstruction").textContent = "뉴런 신호를 섞어 가장 큰 답 점수가 바뀌는 곳에 검은 선이 생깁니다."; element<HTMLElement>("#pixelGraphReasonTitle").textContent = `왜 뉴런 ${state.model.hiddenUnits}개로 답 ${info.classes.length}개를 고를 수 있을까요?`; element<HTMLElement>("#pixelGraphReasonText").textContent = `출력칸 ${info.classes.join("·")} 각각은 같은 뉴런 신호를 서로 다른 비율로 섞어 점수를 냅니다. 배경색은 1등 답, 검은 선은 1등 답이 바뀌는 자리입니다.`; result.probabilities.forEach((value, index) => addChip(`답 ${info.classes[index]}`, `${(value * 100).toFixed(1)}%`, index));
  }
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
  element<HTMLElement>("#whySubtitle").textContent = "그림 196칸이 좌표와 뉴런 신호를 거쳐 답이 되는 순서를 확인합니다.";
  element<HTMLElement>("#whyFooterNote").textContent = "그림 196칸 → 가로·세로 점수 → 뉴런 신호 → 여러 답 점수 순서로 살펴봅니다.";
  element<HTMLElement>("#trainTitle").textContent = "이제 모델이 스스로 고치게 해 봅시다";
  element<HTMLElement>("#useTitle").textContent = "처음 보는 그림으로 확인해 봅시다";
  ["#pixelDataCanvas", "#pixelTrainCanvas", "#pixelUseCanvas"].forEach((selector) => drawPixelCanvas(element<HTMLCanvasElement>(selector), state.drawing));
  element<HTMLElement>("#pixelDrawTitle").textContent = state.task === "digits" ? "14×14칸에 0·1·2를 그려 보세요" : "OMR 한 문항을 직접 칠해 보세요";
  element<HTMLElement>("#pixelDataCount").textContent = `학습 그림 ${state.data.length}장`;
  const picker = element<HTMLDivElement>("#pixelClassPicker"); picker.replaceChildren();
  info.classes.forEach((name, label) => { const button = document.createElement("button"); button.type = "button"; button.className = label === state.selectedLabel ? "active" : ""; button.textContent = `${name} 정답`; button.addEventListener("click", () => pixelUiStore?.selectLabel(label)); picker.append(button); });
  if (lab.lessonStep === 2) {
    const samples = element<HTMLDivElement>("#pixelSamples"); samples.replaceChildren();
    state.data.filter((_, index) => index % Math.max(1, Math.floor(state.data.length / 15)) === 0).slice(0, 15).forEach((example, index) => { const button = document.createElement("button"); button.type = "button"; const canvas = document.createElement("canvas"); canvas.width = 140; canvas.height = 140; drawPixelCanvas(canvas, example.pixels); const caption = document.createElement("span"); caption.textContent = `정답 ${info.classes[example.label] ?? "?"}`; button.append(canvas, caption); button.addEventListener("click", () => pixelUiStore?.loadSample(example.label, index)); samples.append(button); });
  }
  if (lab.lessonStep === 3) renderPixelUnderstanding(state);
  const probabilities = pixelUiStore?.probabilities() ?? [];
  if (lab.lessonStep === 4) {
    renderProbabilityBars("#pixelTrainBars", state, probabilities); const metrics = pixelUiStore?.metrics();
    element<HTMLElement>("#pixelEpoch").textContent = String(state.model.epoch); element<HTMLElement>("#pixelEpochNow").textContent = String(state.model.epoch); element<HTMLElement>("#pixelProgressBar").style.width = `${Math.min(100, state.model.epoch / 10)}%`;
    const focus = renderPixelProjectionStory(state); element<HTMLInputElement>("#pixelHiddenUnits").value = String(state.model.hiddenUnits); element<HTMLOutputElement>("#pixelHiddenOut").value = `${state.model.hiddenUnits}개`; element<HTMLInputElement>("#pixelLearningRate").value = String(state.learningRate); element<HTMLOutputElement>("#pixelLearningRateOut").value = state.learningRate.toFixed(2); drawPixelLatentMap(element<HTMLCanvasElement>("#pixelLatentCanvas"), state.model, state.data, focus.pixels, state.projection, state.view, focus.label);
    element<HTMLElement>(".latent-map-wrap > span").textContent = state.view === "placement" ? "점을 누르면 그 그림의 좌표 계산을 볼 수 있습니다" : state.view === "decision" ? "자료 점은 고정 · 검은 선은 1등 답이 바뀌는 곳" : "색 점선은 뉴런 신호가 0인 기준";
    const pixelPlacementTab = element<HTMLButtonElement>("#pixelPlacementTab"); const pixelDecisionTab = element<HTMLButtonElement>("#pixelDecisionTab"); const pixelNeuronTab = element<HTMLButtonElement>("#pixelNeuronTab");
    const mapTabs: Array<[HTMLButtonElement, PixelLabState["view"]]> = [[pixelPlacementTab, "placement"], [pixelNeuronTab, "neurons"], [pixelDecisionTab, "decision"]]; mapTabs.forEach(([button, view]) => { const active = state.view === view; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); });
    element<SVGSVGElement>("#pixelNetworkSvg").innerHTML = pixelNetworkGraphMarkup(state.model, info.classes, forwardPixels(state.model, state.drawing).hidden);
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
  const decision = element<HTMLDivElement>("#decisionView"); const neurons = element<HTMLDivElement>("#neuronView");
  decision.hidden = state.view !== "decision"; neurons.hidden = state.view !== "neurons";
  element<HTMLButtonElement>("#decisionTab").classList.toggle("active", state.view === "decision");
  element<HTMLButtonElement>("#neuronTab").classList.toggle("active", state.view === "neurons");
  element<HTMLButtonElement>("#decisionTab").setAttribute("aria-selected", String(state.view === "decision"));
  element<HTMLButtonElement>("#neuronTab").setAttribute("aria-selected", String(state.view === "neurons"));
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
    drawDecisionSurface(element<HTMLCanvasElement>("#modelCanvas"), state.model, state.data, state.testInput, { explanationStep: 4, selectedNeuron: state.selectedNeuron });
    renderNeuronCards(state); drawLossChart(element<HTMLCanvasElement>("#lossCanvas"), state.history);
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
  element<HTMLButtonElement>("#decisionTab").addEventListener("click", () => store.setView("decision"));
  element<HTMLButtonElement>("#neuronTab").addEventListener("click", () => store.setView("neurons"));
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
  ["#pixelDataCanvas", "#pixelTrainCanvas", "#pixelUseCanvas"].forEach((selector) => {
    const canvas = element<HTMLCanvasElement>(selector);
    const paint = (event: PointerEvent) => { if (!drawing) return; pixelStore.paint(pixelIndexAt(canvas, event.clientX, event.clientY), 1); };
    canvas.addEventListener("pointerdown", (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); paint(event); });
    canvas.addEventListener("pointermove", paint);
    canvas.addEventListener("pointerup", () => { drawing = false; }); canvas.addEventListener("pointercancel", () => { drawing = false; });
  });
  ["#pixelClear", "#pixelTrainClear", "#pixelUseClear"].forEach((selector) => element<HTMLButtonElement>(selector).addEventListener("click", () => pixelStore.clear()));
  element<HTMLButtonElement>("#pixelAdd").addEventListener("click", () => { pixelStore.addDrawing(); showToast(`${PIXEL_TASKS[pixelStore.snapshot.task].classes[pixelStore.snapshot.selectedLabel]} 학습 자료로 추가했습니다.`); });
  let sampleIndex = 1;
  ["#pixelTrainSample", "#pixelUseSample"].forEach((selector) => element<HTMLButtonElement>(selector).addEventListener("click", () => { const classes = PIXEL_TASKS[pixelStore.snapshot.task].classes; const label = sampleIndex % classes.length; pixelStore.loadSample(label, sampleIndex); sampleIndex += 1; }));
  element<HTMLButtonElement>("#pixelRevealHighlight").addEventListener("click", () => pixelStore.revealHighlight());
  element<HTMLButtonElement>("#pixelQuizNext").addEventListener("click", () => { if (pixelStore.snapshot.understandStep === 3) { pixelStore.resetModel(); store.setLessonStep(4); } else pixelStore.nextUnderstand(); });
  ([ ["#pixelTrainOne", 1], ["#pixelTrainTen", 10], ["#pixelTrainHundred", 100] ] as const).forEach(([selector, epochs]) => element<HTMLButtonElement>(selector).addEventListener("click", () => pixelStore.train(epochs)));
  element<HTMLButtonElement>("#pixelResetModel").addEventListener("click", () => { pixelStore.resetModel(); showToast("픽셀 모델을 연습 전 상태로 되돌렸습니다."); });
  element<HTMLInputElement>("#pixelHiddenUnits").addEventListener("change", (event) => { pixelStore.setHiddenUnits(Number((event.currentTarget as HTMLInputElement).value)); showToast("은닉 뉴런 수를 바꾸어 분류선을 처음부터 다시 만들었습니다."); });
  element<HTMLInputElement>("#pixelLearningRate").addEventListener("change", (event) => pixelStore.setLearningRate(Number((event.currentTarget as HTMLInputElement).value)));
  element<HTMLButtonElement>("#pixelPlacementTab").addEventListener("click", () => pixelStore.setView("placement"));
  element<HTMLButtonElement>("#pixelNeuronTab").addEventListener("click", () => pixelStore.setView("neurons"));
  element<HTMLButtonElement>("#pixelDecisionTab").addEventListener("click", () => pixelStore.setView("decision"));
  element<HTMLCanvasElement>("#pixelLatentCanvas").addEventListener("click", (event) => { const state = pixelStore.snapshot; const index = pixelMapExampleAt(event.currentTarget as HTMLCanvasElement, event.clientX, event.clientY, state.projection, state.data); pixelStore.selectMapExample(index); if (index === null) showToast("점을 누르면 그 그림의 좌표 계산을 볼 수 있습니다."); });
  element<HTMLButtonElement>("#pixelAutoTrain").addEventListener("click", () => { if (pixelAutoTimer) { stopPixelAuto(); rerender(); return; } pixelAutoTimer = window.setInterval(() => { if (!isPixelPreset(store.snapshot.preset) || store.snapshot.lessonStep !== 4 || pixelStore.snapshot.model.epoch >= 1000) { stopPixelAuto(); rerender(); return; } pixelStore.train(5); }, 100); pixelStore.train(1); });
  element<HTMLButtonElement>("#pixelExportScratch").addEventListener("click", () => { const state = pixelStore.snapshot; downloadBlob("neural-lab-pixel-scratch.sb3", createPixelScratchProject(state.model, PIXEL_TASKS[state.task].classes, state.drawing)); showToast("Scratch의 나의 블록과 지금 그린 196칸을 함께 만들었습니다."); });
  element<HTMLButtonElement>("#pixelExportJson").addEventListener("click", () => downloadText("neural-lab-pixel-model.json", JSON.stringify({ format: "neural-lab/pixel-model-v1", task: pixelStore.snapshot.task, size: 14, classes: PIXEL_TASKS[pixelStore.snapshot.task].classes, model: pixelStore.snapshot.model }, null, 2), "application/json"));
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();
