import "./styles.css";
import { forward, evaluate } from "./core/neuralNetwork";
import { deserializeModel, downloadText, serializeModel } from "./export/modelJson";
import { generateScratchExtension } from "./export/scratchExtension";
import { PRESETS } from "./data/presets";
import { createInitialStore, type LabState, type LabStore } from "./state/labStore";
import type { ActivationName, Label, PresetName } from "./types";
import { drawDecisionSurface } from "./visualization/decisionSurface";
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
  element<HTMLElement>("#plotTitle").textContent = state.view === "decision" ? "최종 판단 영역" : "은닉 뉴런별 활성화 영역";
  element<HTMLElement>("#plotSubtitle").textContent = state.view === "decision" ? "배경색은 범주 1 확률, 검은 선은 최종 0.5 경계입니다." : "색은 실제 활성화값, 검은 직선은 각 뉴런의 선형 결합이 0인 중간 경계입니다.";
  drawDecisionSurface(element<HTMLCanvasElement>("#decisionCanvas"), state.model, state.data, state.testInput);
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
  ([["#trainOne", 1], ["#trainTen", 10], ["#trainHundred", 100]] as const).forEach(([selector, epochs]) => element<HTMLButtonElement>(selector).addEventListener("click", () => { const error = store.trainEpochs(epochs); if (error) showToast(error); }));
  element<HTMLButtonElement>("#autoTrain").addEventListener("click", () => { const error = store.toggleAuto(); if (error) showToast(error); });
  const updateInput = () => store.setTestInput(Number(element<HTMLInputElement>("#testX").value), Number(element<HTMLInputElement>("#testY").value));
  element<HTMLInputElement>("#testX").addEventListener("input", updateInput); element<HTMLInputElement>("#testY").addEventListener("input", updateInput);
  element<HTMLCanvasElement>("#decisionCanvas").addEventListener("click", (event) => { const canvas = event.currentTarget as HTMLCanvasElement; const rect = canvas.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 2 - 1; const y = 1 - ((event.clientY - rect.top) / rect.height) * 2; store.addDataPoint(x, y); showToast("점을 추가해 모델을 같은 초기값으로 다시 만들었습니다."); });
  element<HTMLButtonElement>("#toggleFormula").addEventListener("click", (event) => { const panel = element<HTMLPreElement>("#formulaPanel"); panel.hidden = !panel.hidden; (event.currentTarget as HTMLButtonElement).textContent = panel.hidden ? "계산식 보기" : "계산식 닫기"; });
  element<HTMLButtonElement>("#saveRun").addEventListener("click", () => { const error = store.saveExperiment(); showToast(error ?? "현재 조건과 결과를 기록했습니다."); });
  element<HTMLButtonElement>("#exportJson").addEventListener("click", () => { const model = store.exportModel(); if (!model) return showToast("저장할 데이터가 없습니다."); downloadText("neural-lab-model.json", serializeModel(model), "application/json"); });
  element<HTMLButtonElement>("#exportScratch").addEventListener("click", () => downloadText("neural-lab-turbowarp.js", generateScratchExtension(store.snapshot.model), "text/javascript"));
  element<HTMLInputElement>("#importJson").addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { store.importModel(deserializeModel(await file.text())); showToast("모델과 데이터를 복원했습니다."); } catch (error) { showToast(error instanceof Error ? error.message : "모델을 불러오지 못했습니다."); } finally { input.value = ""; } });
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();

