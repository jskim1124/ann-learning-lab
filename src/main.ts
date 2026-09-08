import "./styles.css";
import { evaluate, forward } from "./core/neuralNetwork";
import { PRESETS } from "./data/presets";
import { deserializeModel, downloadBlob, downloadText, serializeModel } from "./export/modelJson";
import { generateScratchExtension } from "./export/scratchExtension";
import { createScratchProject } from "./export/scratchProject";
import { createInitialStore, type LabState, type LabStore } from "./state/labStore";
import type { ActivationName, Label, PresetName } from "./types";
import { drawDecisionSurface, HIDDEN_COLORS } from "./visualization/decisionSurface";
import { drawLossChart } from "./visualization/lossChart";
import { networkGraphMarkup } from "./visualization/networkGraph";
import { drawNeuronSurface } from "./visualization/neuronSurface";

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
    target.innerHTML = `<span class="scene-no">장면 1</span><h2>보라색 십자에서 출발합니다</h2><p>십자는 모델에게 새로 물어볼 자리입니다. 가로값은 <b>${x}</b>, 세로값은 <b>${y}</b>입니다. 아직 모델이 만든 선은 보여 주지 않습니다.</p><div class="plain-rule">관찰한 점 = 모델이 연습한 사례<br>보라색 십자 = 이제 판단해 볼 새 사례</div>`;
    return;
  }
  const neuronButtons = result.z.map((value, index) => `<button type="button" class="neuron-choice ${index === state.selectedNeuron ? "active" : ""}" data-neuron="${index}" style="--neuron-color:${HIDDEN_COLORS[index % HIDDEN_COLORS.length]}"><span>규칙 ${index + 1}</span><strong>중간 점수 ${signed(value)}</strong></button>`).join("");
  if (state.explanationStep === 2) {
    const index = state.selectedNeuron; const weights = state.model.parameters.inputHidden[index] ?? [0, 0]; const bias = state.model.parameters.hiddenBias[index] ?? 0;
    target.innerHTML = `<span class="scene-no">장면 2</span><h2>칸마다 기준선 하나를 찾습니다</h2><p>색 선을 누르면 그 칸의 계산을 볼 수 있습니다. 화살표 쪽으로 갈수록 그 칸의 중간 점수가 커집니다.</p><div class="neuron-choices">${neuronButtons}</div><div class="plain-rule"><b>규칙 ${index + 1}</b><br>${weights[0].toFixed(2)} × ${x} + ${weights[1].toFixed(2)} × ${y} + 기준값 ${bias.toFixed(2)}<br>= 중간 점수 <b>${signed(result.z[index] ?? 0)}</b></div><p>색 선 위에서는 중간 점수가 0입니다. 이 색 선 하나가 마지막 답은 아닙니다.</p>`;
    target.querySelectorAll<HTMLButtonElement>("[data-neuron]").forEach((button) => button.addEventListener("click", () => store.setSelectedNeuron(Number(button.dataset.neuron))));
    return;
  }
  const contributions = result.hidden.map((value, index) => value * (state.model.parameters.hiddenOutput[index] ?? 0));
  const max = Math.max(.0001, ...contributions.map(Math.abs));
  const rows = contributions.map((value, index) => `<div class="contribution-row"><span>규칙 ${index + 1}</span><div class="contribution-track"><i class="${value >= 0 ? "positive" : "negative"}" style="width:${Math.max(3, Math.abs(value) / max * 50)}%"></i></div><b>${signed(value)}</b></div>`).join("");
  if (state.explanationStep === 3) {
    target.innerHTML = `<span class="scene-no">장면 3</span><h2>여러 칸의 영향을 모두 합칩니다</h2><p>오른쪽 막대는 결과 1 쪽, 왼쪽 막대는 결과 0 쪽으로 미는 힘입니다. 길수록 영향이 큽니다.</p><div class="contribution-list">${rows}</div><div class="sum-line"><span>시작값 ${signed(state.model.parameters.outputBias)}</span><strong>모두 합친 점수 ${signed(result.logit)}</strong></div>`;
    return;
  }
  target.innerHTML = `<span class="scene-no">장면 4</span><h2>합친 점수가 0인 곳을 이으면 검은 선이 됩니다</h2><p>검은 선의 한쪽에서는 결과 0 쪽 힘이 더 크고, 반대쪽에서는 결과 1 쪽 힘이 더 큽니다. 어느 색 선 하나를 그대로 따라가는 것이 아닙니다.</p><div class="final-equation"><span>십자 위치의 합친 점수</span><strong>${signed(result.logit)}</strong><span>${PRESETS[state.preset].classes[1]}일 가능성</span><strong>${(result.probability * 100).toFixed(1)}%</strong><span>모델의 답</span><strong>${result.probability >= .5 ? PRESETS[state.preset].classes[1] : PRESETS[state.preset].classes[0]}</strong></div><div class="plain-rule">검은 선 위: 두 결과의 가능성이 똑같은 50%<br>검은 선 양쪽: 더 가능성이 큰 결과가 달라짐</div>`;
}

function quizDefinition(state: LabState): { question: string; choices: Array<[string, string]>; correct: string; explanation: string } {
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  if (state.explanationStep === 1) return { question: "그래프의 보라색 십자는 무엇일까요?", choices: [["old", "이미 연습한 사례"], ["new", "새로 판단할 사례"]], correct: "new", explanation: "보라색 십자는 모델에게 결과를 물어볼 새 사례입니다." };
  if (state.explanationStep === 2) return { question: "색 선에서 화살표 쪽으로 움직이면 무엇이 커질까요?", choices: [["score", "그 칸의 중간 점수"], ["data", "관찰한 점의 개수"]], correct: "score", explanation: "화살표는 그 규칙 찾기 칸의 중간 점수가 커지는 방향을 보여 줍니다." };
  if (state.explanationStep === 3) {
    const values = result.hidden.map((value, index) => Math.abs(value * (state.model.parameters.hiddenOutput[index] ?? 0)));
    const largest = values.indexOf(Math.max(...values));
    return { question: "지금 십자에서 가장 긴 영향 막대는 어느 칸일까요?", choices: values.map((_, index) => [`rule${index}`, `규칙 ${index + 1}`]), correct: `rule${largest}`, explanation: `막대 길이를 비교하면 규칙 ${largest + 1}의 영향이 가장 큽니다.` };
  }
  return { question: "검은 선 위에서는 두 결과의 가능성이 어떻게 될까요?", choices: [["same", "50% 대 50%로 같다"], ["certain", "한 결과가 100%다"]], correct: "same", explanation: "두 쪽의 힘이 같아지는 곳을 이어 그린 것이 마지막 검은 선입니다." };
}

function renderQuiz(state: LabState, store: LabStore): void {
  const quiz = quizDefinition(state); const correct = state.quizAnswer === quiz.correct;
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
  const next = element<HTMLButtonElement>("#nextQuiz"); next.hidden = !correct; next.textContent = state.explanationStep === 4 ? "새 값으로 시험하기 →" : "다음 장면 →";
}

function render(state: LabState, store: LabStore): void {
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
  if (state.lessonStep === 2) drawDecisionSurface(element<HTMLCanvasElement>("#dataCanvas"), state.model, state.data, state.testInput, { explanationStep: 1 });
  if (state.lessonStep === 3) {
    drawDecisionSurface(element<HTMLCanvasElement>("#modelCanvas"), state.model, state.data, state.testInput, { explanationStep: 4, selectedNeuron: state.selectedNeuron });
    renderNeuronCards(state); drawLossChart(element<HTMLCanvasElement>("#lossCanvas"), state.history);
    element<SVGSVGElement>("#networkSvg").innerHTML = networkGraphMarkup(state.model, prediction.hidden);
  }
  if (state.lessonStep === 4) {
    drawDecisionSurface(element<HTMLCanvasElement>("#decisionCanvas"), state.model, state.data, state.testInput, { explanationStep: state.explanationStep, selectedNeuron: state.selectedNeuron });
    renderCausalExplanation(state, store); renderQuiz(state, store);
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
  const titles = ["새 점의 위치", "칸마다 찾은 기준선", "여러 영향 합치기", "마지막 검은 선"];
  const subtitles = ["보라색 십자가 지금 판단할 새 사례입니다.", "색 선과 화살표를 비교해 보세요.", "배경색은 여러 칸의 영향을 모두 합친 결과입니다.", "검은 선 양쪽에서 모델의 답이 달라집니다."];
  element<HTMLElement>("#plotTitle").textContent = titles[state.explanationStep - 1]!;
  element<HTMLElement>("#plotSubtitle").textContent = subtitles[state.explanationStep - 1]!;
  if (state.lessonStep === 5) renderExperiments(state, store);
}

function addPointFromCanvas(event: MouseEvent, store: LabStore): void {
  const canvas = event.currentTarget as HTMLCanvasElement; const rect = canvas.getBoundingClientRect();
  store.addDataPoint(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
  showToast("새 사례를 점으로 추가했습니다.");
}

export function mountApp(store = createInitialStore()): LabStore {
  store.subscribe((state) => render(state, store));
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((card) => card.addEventListener("click", () => store.setPreset(card.dataset.preset as PresetName)));
  document.querySelectorAll<HTMLButtonElement>("[data-go-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.goStep) as LabState["lessonStep"]; if (step <= store.snapshot.furthestLessonStep) store.setLessonStep(step); }));
  document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => store.previousLesson()));
  element<HTMLButtonElement>("#scenarioNext").addEventListener("click", () => store.setLessonStep(2));
  element<HTMLButtonElement>("#dataNext").addEventListener("click", () => { if (store.snapshot.data.length < 2) return showToast("서로 다른 결과의 사례를 먼저 두 개 이상 만들어 주세요."); store.setLessonStep(3); });
  element<HTMLButtonElement>("#modelNext").addEventListener("click", () => { if (store.snapshot.model.epoch === 0) return showToast("모델을 적어도 한 번 연습시켜 주세요."); store.setLessonStep(4); });
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
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.explanationStep) as LabState["explanationStep"]; if (step <= store.snapshot.furthestExplanationStep) store.setExplanationStep(step); }));
  element<HTMLButtonElement>("#nextQuiz").addEventListener("click", () => { if (store.snapshot.explanationStep === 4) store.setLessonStep(5); else store.nextQuiz(); });
  const updateInput = () => store.setTestInput(Number(element<HTMLInputElement>("#testX").value), Number(element<HTMLInputElement>("#testY").value));
  element<HTMLInputElement>("#testX").addEventListener("input", updateInput); element<HTMLInputElement>("#testY").addEventListener("input", updateInput);
  element<HTMLButtonElement>("#toggleFormula").addEventListener("click", (event) => { const panel = element<HTMLPreElement>("#formulaPanel"); panel.hidden = !panel.hidden; (event.currentTarget as HTMLButtonElement).textContent = panel.hidden ? "계산 자세히" : "계산 닫기"; });
  element<HTMLButtonElement>("#saveRun").addEventListener("click", () => { const error = store.saveExperiment(); showToast(error ?? "지금 결과를 기록했습니다."); });
  element<HTMLButtonElement>("#exportJson").addEventListener("click", () => { const model = store.exportModel(); if (model) downloadText("neural-lab-model.json", serializeModel(model), "application/json"); });
  element<HTMLButtonElement>("#exportScratch").addEventListener("click", () => downloadText("neural-lab-turbowarp.js", generateScratchExtension(store.snapshot.model), "text/javascript"));
  element<HTMLButtonElement>("#exportScratchProject").addEventListener("click", () => { downloadBlob("neural-lab-scratch.sb3", createScratchProject(store.snapshot.model)); showToast("Scratch에서 열 수 있는 블록 파일을 만들었습니다."); });
  element<HTMLInputElement>("#importJson").addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { store.importModel(deserializeModel(await file.text())); store.setLessonStep(5); showToast("보관한 모델을 열었습니다."); } catch (error) { showToast(error instanceof Error ? error.message : "파일을 열지 못했습니다."); } finally { input.value = ""; } });
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();
