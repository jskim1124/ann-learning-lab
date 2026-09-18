import "./styles.css";
import { workspacePanels, featureTrainingPanels, revealModelPanel } from "./ui/workspacePanels";
import { generateInferenceExtension } from "./export/inferenceExtension";
import { TabularLesson } from "./ui/tabularLesson";
import { importSpreadsheet } from "./data/spreadsheetImport";
import { evaluate, forward } from "./core/neuralNetwork";
import { forwardPixels } from "./core/pixelNetwork";
import { penaltyPixelModel } from "./core/penalty";
import { liveCalculation, signalNetwork, installSignalNetwork } from "./ui/liveCalculation";
import { bindPracticeProbe } from "./ui/practiceProbe";
import { PRESETS } from "./data/presets";
import { addCustomClass, centroidAccuracy, createCustomDraft, createCustomExample, projectCustomDataset, removeCustomClass, textFeatures, validateCustomDataset, type CustomDatasetDraft, type CustomInputKind } from "./data/customDataset";
import type { PixelTaskName } from "./data/pixelDatasets";
import { deserializeModel, downloadBlob, downloadText, serializeModel } from "./export/modelJson";
import { generateScratchExtension } from "./export/scratchExtension";
import { createScratchProject } from "./export/scratchProject";
import { createPixelScratchProject } from "./export/pixelScratchProject";
import { createInitialStore, type LabState, type LabStore } from "./state/labStore";
import { ImageWorkspace } from "./ui/imageWorkspace";
import { PenaltyCollection } from "./ui/penaltyCollection";
import { PenaltyLesson } from "./ui/penaltyLesson";
import { FeatureLabStore, type FeatureLabState } from "./state/featureLabStore";
import type { ActivationName, Label, PresetName } from "./types";
import { drawDecisionSurface, HIDDEN_COLORS } from "./visualization/decisionSurface";
import { CLASS_COLORS, drawFeatureSurface } from "./visualization/featureSurface";
import { XOR_LESSON } from "./visualization/xorLesson";
import { drawLossChart } from "./visualization/lossChart";
import { drawMediaSample, mediaSampleText, playSoundSample, toggleMediaPixel } from "./visualization/mediaSample";
import { networkGraphMarkup } from "./visualization/networkGraph";
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
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!)); }
function isPixelPreset(preset: PresetName): preset is PixelTaskName { return preset === "digits" || preset === "omr"; }
type CustomPresetName = "custom" | "webcam";
function isCustomPreset(preset: PresetName): preset is CustomPresetName { return preset === "custom"; }

let customDraft: CustomDatasetDraft = createCustomDraft();
let featureUiStore: FeatureLabStore | null = null;
let featureAutoTimer = 0;
let customClassPage = 0, customSelectedClass = 0;
let featureSelectedPoint: number | null = null;
let boundarySelectedPoint: number | null = null;
let featureProbe = false, boundaryProbe = false;
let tabularLesson: TabularLesson | null = null;
let imageWorkspace: ImageWorkspace;
let penaltyCollection:PenaltyCollection;
let penaltyLesson:PenaltyLesson;
function usesImages(preset: PresetName): boolean { return isPixelPreset(preset) || preset === "webcam" || preset === "custom" && (customDraft.inputKind === "drawing" || customDraft.inputKind === "webcam"); }
function stopFeatureAuto(): void { if (featureAutoTimer) window.clearInterval(featureAutoTimer); featureAutoTimer = 0; }

function syncCustomPreset(preset: CustomPresetName): void {
  const projection = projectCustomDataset(customDraft);
  PRESETS[preset].classes = [...projection.classes];
  PRESETS[preset].axes = projection.axes;
}

function syncCustomStore(store: LabStore): void {
  const preset = isCustomPreset(store.snapshot.preset) ? store.snapshot.preset : "custom";
  syncCustomPreset(preset);
  const projection = projectCustomDataset(customDraft);
  store.setCustomData(projection.points.filter((point) => point.label < 2), preset);
  featureSelectedPoint = null;
  featureProbe = false;
  featureUiStore?.setDataset(projection.points, projection.classes);
}

function fillSelect(select: HTMLSelectElement, names: string[], selected: number): void {
  select.replaceChildren();
  names.forEach((name, index) => { const option = document.createElement("option"); option.value = String(index); option.textContent = name || `특징 ${index + 1}`; option.selected = index === selected; select.append(option); });
}

function fillClassSelect(select: HTMLSelectElement): void {
  const selected = select.value; select.replaceChildren();
  customDraft.classes.forEach((name, label) => { const option = document.createElement("option"); option.value = String(label); option.textContent = name; select.append(option); });
  if (customDraft.classes[Number(selected)] !== undefined) select.value = selected;
}

function addCustomRow(store: LabStore, label: number, values: number[], name: string): void {
  customDraft.rows.unshift({ id: customDraft.nextId, name, label, values }); customDraft.nextId += 1; syncCustomStore(store); showToast("새 자료를 학습 자료에 추가했습니다.");
}

function renderCustomLab(state: LabState): void {
  const custom = isCustomPreset(state.preset);
  element<HTMLElement>("#stepThreeLabel").textContent = "이해";
  if (!custom) return;
  const projection = projectCustomDataset(customDraft);
  const inputHelp = { numbers: "특징값을 숫자로 넣습니다.", drawing: "그림 자체로 학습합니다.", webcam: "촬영한 사진 자체로 학습합니다.", text: "글의 길이와 구성을 셉니다. 문장의 뜻을 이해하는 모델은 아닙니다." };
  element<HTMLElement>(".custom-input-tabs").classList.remove("webcam-only");
  document.querySelectorAll<HTMLButtonElement>("[data-custom-input]").forEach((button) => { const active = button.dataset.customInput === customDraft.inputKind; button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
  element<HTMLElement>("#customInputHelp").textContent = inputHelp[customDraft.inputKind];
  element<HTMLButtonElement>("#customLoadExample").hidden = customDraft.inputKind !== "numbers"; element<HTMLButtonElement>("#customAddFeature").hidden = customDraft.inputKind !== "numbers";
  element<HTMLFormElement>("#customRowForm").hidden = customDraft.inputKind !== "numbers"; element<HTMLElement>("#customTextCapture").hidden = customDraft.inputKind !== "text";
  const classInputs = element<HTMLDivElement>("#customClassInputs"); classInputs.replaceChildren();
  customSelectedClass = Math.min(customSelectedClass, customDraft.classes.length - 1);
  const pageCount = Math.ceil(customDraft.classes.length / 3); customClassPage = Math.max(0, Math.min(customClassPage, pageCount - 1));
  classInputs.innerHTML = customDraft.classes.slice(customClassPage * 3, customClassPage * 3 + 3).map((name, i) => {
    const label=customClassPage*3+i, rows=customDraft.rows.filter(row=>row.label===label);
    return `<article class="image-class ${label===customSelectedClass?"selected":""}" style="--class-color:${CLASS_COLORS[label%CLASS_COLORS.length]}"><div class="image-class-top"><button data-select-custom-class="${label}" aria-pressed="${label===customSelectedClass}">${escapeHtml(name)}</button><span>${rows.length}개</span><button data-rename-custom-class="${label}" aria-label="${escapeHtml(name)} 이름 바꾸기">이름</button><button data-remove-custom-class="${label}" aria-label="${escapeHtml(name)} 클래스 삭제" ${customDraft.classes.length<=2?"disabled":""}>×</button></div><div>${rows.length?rows.slice(0,2).map(row=>`<div class="tabular-sample"><span title="${escapeHtml(row.name)}">${escapeHtml(row.name)} · ${row.values.map(v=>Number(v.toFixed(1))).join(" / ")}</span><button data-remove-custom-row="${row.id}" aria-label="${escapeHtml(row.name)} 삭제">×</button></div>`).join(""):'<p>이 클래스를 선택하고 자료를 추가하세요.</p>'}</div></article>`;
  }).join("");
  element<HTMLElement>("#customClassesPage").textContent=`${customClassPage+1} / ${pageCount}`;
  element<HTMLButtonElement>("#customClassesPrev").disabled=customClassPage===0;
  element<HTMLButtonElement>("#customClassesNext").disabled=customClassPage===pageCount-1;
  element<HTMLElement>("#customFeatureEditor").hidden=customDraft.inputKind!=="numbers";
  element<HTMLElement>("#customSpreadsheet").hidden=customDraft.inputKind!=="numbers";
  const addClassButton = element<HTMLButtonElement>("#customAddClass"); addClassButton.disabled = customDraft.classes.length >= 6; addClassButton.textContent = customDraft.classes.length >= 6 ? "최대 6개" : "+ 클래스 추가";
  const featureNames = element<HTMLDivElement>("#customFeatureNames"); featureNames.replaceChildren();
  customDraft.features.forEach((name, index) => {
    const row = document.createElement("div"); const label = document.createElement("label"); const span = document.createElement("span"); const input = document.createElement("input");
    span.textContent = `특징 ${index + 1}`; input.type = "text"; input.maxLength = 18; input.value = name; input.dataset.customFeature = String(index); input.readOnly = customDraft.inputKind !== "numbers"; label.append(span, input); row.append(label);
    if (customDraft.inputKind === "numbers" && customDraft.features.length > 2) { const remove = document.createElement("button"); remove.type = "button"; remove.className = "text-button"; remove.dataset.removeCustomFeature = String(index); remove.textContent = "삭제"; row.append(remove); }
    featureNames.append(row);
  });
  element<HTMLButtonElement>("#customAddFeature").disabled = customDraft.features.length >= 5;
  const rowClass = element<HTMLSelectElement>("#customRowClass"); const rowClassSelected = rowClass.value; rowClass.replaceChildren();
  customDraft.classes.forEach((name, label) => { const option = document.createElement("option"); option.value = String(label); option.textContent = name; rowClass.append(option); });
  if (customDraft.classes[Number(rowClassSelected)] !== undefined) rowClass.value = String(customSelectedClass);
  fillClassSelect(element<HTMLSelectElement>("#customTextClass")); element<HTMLSelectElement>("#customTextClass").value=String(customSelectedClass);
  const rowValues = element<HTMLDivElement>("#customRowValues"); rowValues.replaceChildren();
  customDraft.features.forEach((name, index) => { const label = document.createElement("label"); const span = document.createElement("span"); const input = document.createElement("input"); span.textContent = name; input.type = "number"; input.step = "any"; input.required = true; input.dataset.customValue = String(index); input.placeholder = "숫자"; label.append(span, input); rowValues.append(label); });
  element<HTMLElement>("#customRowCount").textContent = `입력한 사례 ${customDraft.rows.length}개`;
  const head = element<HTMLTableSectionElement>("#customTableHead"); const body = element<HTMLTableSectionElement>("#customTableBody"); head.replaceChildren(); body.replaceChildren();
  const headerRow = document.createElement("tr"); ["사례", "클래스", ...customDraft.features, ""].forEach((name) => { const th = document.createElement("th"); th.textContent = name; headerRow.append(th); }); head.append(headerRow);
  if (!customDraft.rows.length) { const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan = customDraft.features.length + 3; cell.className = "empty-cell"; cell.textContent = "아직 입력한 사례가 없습니다."; }
  customDraft.rows.forEach((item) => { const row = body.insertRow(); [item.name, customDraft.classes[item.label] ?? "삭제된 클래스", ...item.values.map(String)].forEach((value) => { const cell = row.insertCell(); cell.textContent = value; }); const action = row.insertCell(); const button = document.createElement("button"); button.type = "button"; button.className = "delete-button"; button.dataset.removeCustomRow = String(item.id); button.textContent = "지우기"; action.append(button); });
  const xSelect = element<HTMLSelectElement>("#customXAxis"); const ySelect = element<HTMLSelectElement>("#customYAxis"); fillSelect(xSelect, customDraft.features, customDraft.xFeature); fillSelect(ySelect, customDraft.features, customDraft.yFeature);
  element<HTMLElement>("#customFeatureAxisX").textContent = projection.axes[0]; element<HTMLElement>("#customFeatureAxisY").textContent = projection.axes[1]; element<HTMLElement>("#customFeatureTitle").textContent = `${projection.axes[0]} × ${projection.axes[1]}`;
  const legend = element<HTMLElement>("#customFeatureLegend"); legend.replaceChildren(); projection.classes.forEach((name, index) => { const item = document.createElement("span"); const dot = document.createElement("i"); dot.style.background = CLASS_COLORS[index % CLASS_COLORS.length]!; const text = document.createElement("b"); text.textContent = name; item.append(dot, text); legend.append(item); });
  const score = Math.round(centroidAccuracy(projection.points, projection.classes.length) * 100); element<HTMLElement>("#customSeparationScore").textContent = projection.points.length ? `${score}%` : "—"; element<HTMLElement>("#customSeparationHint").textContent = !projection.points.length ? "자료를 먼저 입력해 주세요." : score >= 80 ? "두 특징만으로 무리가 비교적 잘 떨어집니다. 아직 신경망의 성적은 아닙니다." : "다른 특징 조합도 비교해 보세요. 아직 신경망의 성적은 아닙니다.";
  if (state.lessonStep === 3) tabularLesson?.render(customDraft); else tabularLesson?.stop();
}

let renderedLessonStep = 0;
let renderedScenarioPreset: PresetName | null = null;
let uiRerender = () => {};
let resizeFrame = 0;
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(() => { resizeFrame = 0; uiRerender(); });
});
let explanationMotionFrame = 0; let explanationMotionProgress = 1;

function startUnderstandingMotion(_kind: "boundary", duration = 950): void {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (explanationMotionFrame) window.cancelAnimationFrame(explanationMotionFrame);
  if (reduced) { explanationMotionProgress = 1; uiRerender(); return; }
  const start = performance.now();
  const tick = (now: number) => {
    const raw = Math.min(1, (now - start) / duration); const eased = raw < .5 ? 2 * raw * raw : 1 - ((-2 * raw + 2) ** 2) / 2;
    explanationMotionProgress = eased;
    uiRerender();
    if (raw < 1) explanationMotionFrame = window.requestAnimationFrame(tick);
    else explanationMotionFrame = 0;
  };
  explanationMotionFrame = window.requestAnimationFrame(tick);
}
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
  element<HTMLElement>("#scenarioMotivation").textContent = preset.motivation ?? preset.story;
  element<HTMLElement>("#scenarioQuestion").textContent = preset.question;
  const illustration = element<HTMLElement>("#scenarioIllustration");
  illustration.dataset.mediaKind = preset.mediaKind;
  illustration.dataset.preset = state.preset;
  if (renderedScenarioPreset !== state.preset) {
    illustration.classList.remove("changing");
    void illustration.offsetWidth;
    illustration.classList.add("changing");
    renderedScenarioPreset = state.preset;
  }
  element<HTMLElement>("#datasetDescription").textContent = preset.description;
  element<HTMLElement>("#datasetSourceNote").textContent = preset.sourceNote;
  element<HTMLElement>("#classZeroName").textContent = preset.classes[0] ?? "결과 1";
  element<HTMLElement>("#classOneName").textContent = preset.classes[1] ?? "결과 2";
  element<HTMLElement>("#classZeroButton").textContent = preset.classes[0] ?? "결과 1";
  element<HTMLElement>("#classOneButton").textContent = preset.classes[1] ?? "결과 2";
  element<HTMLElement>("#legendZero").textContent = preset.classes[0] ?? "결과 1";
  element<HTMLElement>("#legendOne").textContent = preset.classes[1] ?? "결과 2";
  element<HTMLElement>("#dataAxisX").textContent = preset.axes[0];
  element<HTMLElement>("#dataAxisY").textContent = preset.axes[1];
  document.querySelectorAll<HTMLElement>(".shared-axis-x").forEach((node) => { node.textContent = preset.axes[0]; });
  document.querySelectorAll<HTMLElement>(".shared-axis-y").forEach((node) => { node.textContent = preset.axes[1]; });
  element<HTMLElement>("#dataCountLabel").textContent = `관찰한 사례 ${state.data.length}개`;
  element<HTMLElement>("#probabilityName").textContent = `${preset.classes[1]}일 가능성`;
  element<HTMLElement>("#weightPositive").textContent = preset.classes[1] ?? "결과 2";
  element<HTMLElement>("#weightNegative").textContent = preset.classes[0] ?? "결과 1";
  const mediaTitles = { sound: "소리 파형 한 개", sketch: "8×8 손그림 한 장", digits: "14×14 손글씨 한 장", omr: "14×14 OMR 한 문항", points: "두 힌트 점 지도" };
  element<HTMLElement>("#mediaTitle").textContent = mediaTitles[preset.mediaKind];
  element<HTMLElement>("#mediaSample").hidden = preset.mediaKind === "points";
  element<HTMLElement>("#pointEditor").hidden = preset.mediaKind !== "points";
  element<HTMLButtonElement>("#playMediaSound").hidden = preset.mediaKind !== "sound";
  element<HTMLElement>("#dataGraphTitle").textContent = state.preset === "xor" ? "승부차기 방향 네 경우" : preset.mediaKind === "points" ? "관찰 자료" : "두 힌트로 펼친 설명 지도";
  const pointPrompt = element<HTMLElement>("#pointEditor .think-box p");
  pointPrompt.textContent = state.preset === "xor"
    ? "왼쪽·왼쪽과 오른쪽·오른쪽은 막힘, 방향이 다른 두 경우는 골입니다. 직선 하나로 두 골만 묶을 수 있을까요?"
    : "자와 직선 하나만으로 두 결과를 나눌 수 있나요? 어렵다면 선이 몇 개쯤 필요할까요?";
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
  const lines = result.hidden.map((value, index) => `은닉 뉴런 ${index + 1}: 중간값 ${value.toFixed(4)} × 마지막 영향 ${(state.model.parameters.hiddenOutput[index] ?? 0).toFixed(4)}`);
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
    const labels = state.preset === "xor" ? XOR_LESSON.map((lesson) => lesson.tab) : ["새 점", "뉴런 신호", "합치기", "최종 판단"];
    if (button.lastChild) button.lastChild.textContent = labels[step - 1] ?? "";
  });
  if (state.preset === "xor") { const lesson = XOR_LESSON[state.explanationStep - 1]!; target.innerHTML = `<span class="scene-no">${state.explanationStep} / 4</span><h2>${lesson.title}</h2><p>${lesson.body}</p><div class="xor-rule"><b>${state.explanationStep === 1 ? "먼저 네 경우 읽기" : state.explanationStep === 2 ? "은닉 뉴런 1개" : state.explanationStep === 3 ? "은닉 뉴런 하나 추가" : "대표 선 고치기"}</b><span>${state.explanationStep === 1 ? "가로는 키커, 세로는 골키퍼의 방향이며 색은 결과입니다." : state.explanationStep === 2 ? "선 하나로는 골과 막힘이 섞입니다." : state.explanationStep === 3 ? "두 은닉 뉴런이 양끝의 막힘을 하나씩 맡습니다." : "뉴런의 값과 골 예상이 함께 바뀝니다. 선 하나가 최종 답은 아닙니다."}</span></div>`; return; }
  const x = state.testInput.x.toFixed(2); const y = state.testInput.y.toFixed(2);
  if (state.explanationStep === 1) {
    target.innerHTML = `<span class="scene-no">장면 1</span><h2>같은 높이에서 옆으로만 움직입니다</h2><p>주황 점과 보라색 십자는 세로 위치가 같습니다. 가로 방향의 힌트 하나만 바꾸면 무엇이 달라지는지 살펴봅니다.</p><div class="plain-rule">주황 점 = 바꾸기 전<br>보라색 십자 = 가로 힌트 하나만 바꾼 뒤</div>`;
    return;
  }
  const neuronButtons = result.z.map((value, index) => `<button type="button" class="neuron-choice ${index === state.selectedNeuron ? "active" : ""}" data-neuron="${index}" style="--neuron-color:${HIDDEN_COLORS[index % HIDDEN_COLORS.length]}"><span>은닉 뉴런 ${index + 1}</span><strong>중간 점수 ${signed(value)}</strong></button>`).join("");
  if (state.explanationStep === 2) {
    const index = state.selectedNeuron; const weights = state.model.parameters.inputHidden[index] ?? [0, 0]; const bias = state.model.parameters.hiddenBias[index] ?? 0;
    target.innerHTML = `<span class="scene-no">장면 2</span><h2>은닉 뉴런은 작은 질문 하나를 맡습니다</h2><p>가로 힌트 하나를 바꾸어 색 선의 어느 쪽에 놓이는지 봅니다. 색 선 하나만으로 최종 답을 정하지는 않습니다.</p><div class="neuron-choices">${neuronButtons}</div><div class="plain-rule"><b>은닉 뉴런 ${index + 1}</b><br>색 선을 기준으로 양쪽을 다르게 봅니다.<br>지금 십자의 뉴런 합: <b>${signed(result.z[index] ?? 0)}</b></div>`;
    target.querySelectorAll<HTMLButtonElement>("[data-neuron]").forEach((button) => button.addEventListener("click", () => store.setSelectedNeuron(Number(button.dataset.neuron))));
    return;
  }
  const contributions = result.hidden.map((value, index) => value * (state.model.parameters.hiddenOutput[index] ?? 0));
  const max = Math.max(.0001, ...contributions.map(Math.abs));
  const rows = contributions.map((value, index) => `<div class="contribution-row"><span>은닉 뉴런 ${index + 1}</span><div class="contribution-track"><i class="${value >= 0 ? "positive" : "negative"}" style="width:${Math.max(3, Math.abs(value) / max * 50)}%"></i></div><b>${signed(value)}</b></div>`).join("");
  if (state.explanationStep === 3) {
    target.innerHTML = `<span class="scene-no">장면 3</span><h2>작은 질문들의 표를 모읍니다</h2><p>오른쪽 막대는 ${PRESETS[state.preset].classes[1]} 쪽, 왼쪽 막대는 ${PRESETS[state.preset].classes[0]} 쪽 표입니다. 긴 막대의 표가 더 셉니다.</p><div class="contribution-list">${rows}</div><div class="sum-line"><span>모든 표를 더하면</span><strong>합친 값 ${signed(result.logit)}</strong></div>`;
    return;
  }
  target.innerHTML = `<span class="scene-no">장면 4</span><h2>표가 똑같아지는 곳이 검은 선입니다</h2><p>검은 선의 양쪽에서는 더 많은 표를 받은 답이 달라집니다. 검은 선은 어느 색 선 하나를 그대로 베낀 것이 아닙니다.</p><div class="final-equation"><span>${PRESETS[state.preset].classes[1]}일 가능성</span><strong>${(result.probability * 100).toFixed(1)}%</strong><span>지금 모델의 답</span><strong>${result.probability >= .5 ? PRESETS[state.preset].classes[1] : PRESETS[state.preset].classes[0]}</strong></div><div class="plain-rule">검은 선 위에서는 두 답이 50%씩<br>선을 건너면 더 많은 표를 받은 답이 바뀜</div>`;
}

function quizDefinition(state: LabState): { question: string; choices: Array<[string, string]>; correct: string; explanation: string } {
  if (state.preset === "xor") { const lesson = XOR_LESSON[state.explanationStep - 1]!; return { question: lesson.question, choices: lesson.choices, correct: lesson.correct, explanation: lesson.explanation }; }
  const result = forward(state.model, state.testInput.x, state.testInput.y);
  const previousX = Math.max(-.9, state.testInput.x - .65); const previous = forward(state.model, previousX, state.testInput.y);
  if (state.explanationStep === 1) return { question: "주황 점에서 십자로 갈 때 그대로인 것은?", choices: [["height", "세로 높이"], ["side", "가로 위치"]], correct: "height", explanation: "옆으로만 움직였으므로 세로 높이는 그대로입니다." };
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
    if (correct && value === state.quizAnswer) button.classList.add("correct");
    if (state.quizAnswer === value && !correct) button.classList.add("wrong");
    button.addEventListener("click", () => store.answerQuiz(value)); choices.append(button);
  });
  const feedback = element<HTMLElement>("#quizFeedback");
  feedback.hidden = state.quizAnswer === null; feedback.className = state.quizAnswer ? `quiz-feedback ${correct ? "correct" : "wrong"}` : "quiz-feedback";
  feedback.textContent = state.quizAnswer ? correct ? `맞았습니다! ${quiz.explanation}` : "오답입니다. 그래프를 다시 보고 골라 보세요." : "";
  const next = element<HTMLButtonElement>("#nextQuiz"); next.hidden = !correct; next.textContent = state.explanationStep === 4 ? "직접 연습시키기 →" : "다음 장면 →";
}

function renderHighlightGuide(state: LabState): void {
  if (state.preset === "xor") { const lesson = XOR_LESSON[state.explanationStep - 1]!; element<HTMLElement>("#highlightInstruction").textContent = lesson.reveal; const revealButton = element<HTMLButtonElement>("#revealHighlight"); revealButton.disabled = state.highlightRevealed; revealButton.textContent = state.highlightRevealed ? "그래프에서 확인했습니다" : lesson.reveal; element<HTMLElement>("#highlightResult").textContent = state.highlightRevealed ? lesson.result : "버튼을 누른 뒤 그래프에서 확인하고 문제를 풉니다."; return; }
  const preset = PRESETS[state.preset]; const previousX = Math.max(-.9, state.testInput.x - .65);
  const before = forward(state.model, previousX, state.testInput.y); const after = forward(state.model, state.testInput.x, state.testInput.y);
  element<HTMLElement>("#highlightInstruction").textContent = `${preset.axes[0].replace("설명 지도: ", "")}만 바꾸고 세로 높이는 그대로 둡니다.`;
  const button = element<HTMLButtonElement>("#revealHighlight"); button.disabled = state.highlightRevealed;
  button.textContent = state.highlightRevealed ? "그래프에 변화가 표시되었습니다" : "그래프에서 한 가지만 바꿔 보기";
  element<HTMLElement>("#highlightResult").textContent = state.highlightRevealed
    ? `주황 점 → 보라 십자 · ${preset.classes[1]} 가능성 ${(before.probability * 100).toFixed(0)}% → ${(after.probability * 100).toFixed(0)}%`
    : "버튼을 누르면 주황 점과 이동 화살표가 나타납니다. 그다음 확인 문제가 열립니다.";
}

function renderProbabilityBars(selector: string, state: { classes: string[] }, probabilities: number[]): void {
  const container = element<HTMLDivElement>(selector); container.replaceChildren();
  state.classes.forEach((name, index) => {
    const row = document.createElement("div"); row.className = "probability-row";
    const value = probabilities[index] ?? 0;
    const label = document.createElement("b"); label.textContent = name; const track = document.createElement("div"); const fill = document.createElement("i"); fill.style.width = `${(value * 100).toFixed(1)}%`; track.append(fill); const percent = document.createElement("strong"); percent.textContent = `${(value * 100).toFixed(1)}%`; row.append(label, track, percent);
    container.append(row);
  });
}

function renderFeatureLab(lab: LabState, state: FeatureLabState): void {
  if (!isCustomPreset(lab.preset)) { stopFeatureAuto(); return; }
  if (lab.lessonStep !== 4) stopFeatureAuto();
  const projection = projectCustomDataset(customDraft); const metrics = featureUiStore?.metrics(); const probabilities = featureUiStore?.probabilities() ?? []; const best = probabilities.indexOf(Math.max(...probabilities));
  element<HTMLInputElement>("#featureHiddenUnits").value = String(state.model.hiddenUnits); element<HTMLOutputElement>("#featureHiddenOut").value = `${state.model.hiddenUnits}개`; element<HTMLSelectElement>("#featureActivation").value = state.model.activation; element<HTMLInputElement>("#featureLearningRate").value = String(state.learningRate); element<HTMLOutputElement>("#featureLearningRateOut").value = state.learningRate.toFixed(2);
  element<HTMLElement>("#featureEpoch").textContent = String(state.model.epoch); element<HTMLElement>("#featureEpochNow").textContent = String(state.model.epoch); element<HTMLElement>("#featureProgressBar").style.width = `${Math.min(100, state.model.epoch / 10)}%`; element<HTMLElement>("#featureLoss").textContent = metrics ? metrics.loss.toFixed(4) : "—"; element<HTMLElement>("#featureAccuracy").textContent = metrics ? `${(metrics.accuracy * 100).toFixed(1)}%` : "—"; element<HTMLElement>("#featureTrainCount").textContent = `${state.data.length}개`; element<HTMLButtonElement>("#featureAutoTrain").textContent = featureAutoTimer ? "잠시 멈추기" : "계속 연습";
  element<HTMLInputElement>("#featureNeuronLayer").checked = state.showNeuronBoundaries; element<HTMLInputElement>("#featureDecisionLayer").checked = state.showDecisionBoundary; element<HTMLElement>("#featureTrainAxisX").textContent = projection.axes[0]; element<HTMLElement>("#featureTrainAxisY").textContent = projection.axes[1];
  if (lab.lessonStep === 4) { drawFeatureSurface(element<HTMLCanvasElement>("#featureModelCanvas"), state.model, state.data, state.testInput, { ...state, showProbe: featureProbe, selectedPoint: featureSelectedPoint }); drawLossChart(element<HTMLCanvasElement>("#featureLossCanvas"), state.history); const result = forwardPixels(state.model, [state.testInput.x, state.testInput.y]); element<SVGSVGElement>("#featureNetworkSvg").innerHTML = pixelNetworkGraphMarkup(state.model, state.classes, result.hidden, result.probabilities, [projection.axes[0], projection.axes[1]]); renderProbabilityBars("#featureTrainBars", state, result.probabilities); element('#featureLiveCalculation').innerHTML=liveCalculation(state.model,[state.testInput.x,state.testInput.y],state.classes); }
  element<SVGSVGElement>("#featureNetworkSvg").removeAttribute("hidden");
  for (const [id, selected] of [["featurePracticeX", customDraft.xFeature], ["featurePracticeY", customDraft.yFeature]] as const) fillSelect(element<HTMLSelectElement>(`#${id}`), customDraft.features, selected);
  element<HTMLElement>("#featureTrainBars").hidden=true;
  element('#featureSignalNetwork').innerHTML=signalNetwork(state.model,[state.testInput.x,state.testInput.y],state.classes);
  const selected=featureSelectedPoint===null?null:customDraft.rows[featureSelectedPoint];
  element<HTMLElement>("#featureSelectedData").textContent=selected?`${selected.name} · 정답 ${customDraft.classes[selected.label]} · 예상 ${state.classes[best]} · ${selected.values.map((v,i)=>customDraft.features[i]+": "+Number(v.toFixed(2))).join(" / ")}`:featureProbe?`확인점 (${state.testInput.x.toFixed(2)}, ${state.testInput.y.toFixed(2)}) · 정답 미지정 · 예상 ${state.classes[best]}`:"점을 선택하거나 빈 곳에서 확인점을 움직여 보세요.";
  element<HTMLElement>("#featureUseAxisX").textContent = projection.axes[0]; element<HTMLElement>("#featureUseAxisY").textContent = projection.axes[1]; element<HTMLInputElement>("#featureUseX").value = String(state.testInput.x); element<HTMLInputElement>("#featureUseY").value = String(state.testInput.y);
  if (lab.lessonStep === 5) { renderProbabilityBars("#featureUseBars", state, probabilities); element<HTMLElement>("#featurePredictionAnswer").textContent = state.model.epoch ? `모델의 답: ${state.classes[best] ?? "?"}` : "먼저 모델을 연습시켜 주세요"; }
}

function render(state: LabState, store: LabStore): void {
  renderLessonProgress(state); renderScenario(state);
  const images = usesImages(state.preset); const custom = isCustomPreset(state.preset) && !images;
  const skipUnderstanding = state.preset === "custom";
  const understandingButton = element<HTMLButtonElement>('.lesson-progress [data-go-step="3"]');
  understandingButton.hidden = false; understandingButton.disabled = skipUnderstanding || state.furthestLessonStep < 3;
  understandingButton.title = skipUnderstanding ? "자율 문제는 이해 단계를 건너뜁니다." : "이해 단계 다시 보기";
  element<HTMLButtonElement>('[data-app-page="4"] [data-back]').textContent = skipUnderstanding ? "← 자료 다시 보기" : "← 원리 다시 보기";
  ["boundaryDataView", "boundaryWhyView", "boundaryTrainingView", "boundaryUseView"].forEach((id) => { element<HTMLElement>(`#${id}`).hidden = images || custom; });
  if(state.preset==='xor') { element<HTMLElement>('#boundaryDataView').hidden=true;element<HTMLElement>('#boundaryWhyView').hidden=true; }
  penaltyCollection.show(state.preset==='xor'&&state.lessonStep===2);
  penaltyLesson.show(state.preset==='xor'&&state.lessonStep===3);
  ["customDataView", "customFeatureView", "customTrainingView", "customUseView"].forEach((id) => { element<HTMLElement>(`#${id}`).hidden = !custom; });
  element<HTMLElement>("#customFeatureNext").hidden = !custom;
  element<HTMLElement>("#whyFooterNote").hidden = images || custom;
  element<HTMLElement>("#whyFooterNote").textContent = state.preset === "xor" ? "실제 경기 예측이 아니라, 방향 두 가지만 남긴 연습 규칙입니다." : "주황 점에서 보라색 십자로, 가로 한 가지만 바꿉니다.";
  imageWorkspace.show(images, state.lessonStep);
  element<HTMLElement>("#stepThreeLabel").textContent = "이해";
  element<HTMLButtonElement>("#dataNext").textContent = skipUnderstanding ? "바로 학습하기 →" : images ? "원리 살펴보기 →" : "원리 살펴보기 →";
  element<HTMLElement>("#dataTitle").textContent = images ? "클래스를 고르고 그림을 모아요" : custom ? "자료를 직접 모아요" : "사진에서 승부차기를 모아요";
  element<HTMLElement>("#whyTitle").textContent = images ? "그림에서 예상까지, 한 단계씩" : custom ? "어떤 특징으로 나눌까요?" : "은닉 뉴런이 왜 두 개 필요할까요?";
  element<HTMLElement>("#trainTitle").textContent = images ? "모은 그림으로 학습해요" : "모델을 직접 학습시켜요";
  element<HTMLElement>("#trainTitle").nextElementSibling!.textContent = images ? "그림을 선택해 예상과 정답을 비교해 보세요." : "은닉 뉴런 수를 바꾸고 선의 변화를 관찰해 보세요.";
  if (images) { stopFeatureAuto(); return; }
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
  element<HTMLElement>("#boundaryMapInstruction").textContent = state.showNeuronBoundaries && state.showDecisionBoundary ? "모든 뉴런 기준선과 검은 최종 경계선을 함께 봅니다." : state.showNeuronBoundaries ? "모든 뉴런 기준선을 봅니다." : state.showDecisionBoundary ? "검은 최종 경계선만 봅니다." : "자료 점과 판단 영역만 봅니다.";
  if (state.lessonStep === 2 && !isPixelPreset(state.preset) && !isCustomPreset(state.preset)) {
    drawDecisionSurface(element<HTMLCanvasElement>("#dataCanvas"), state.model, state.data, state.testInput, { explanationStep: 1, showProbe: false });
    if (preset.mediaKind !== "points") {
      drawMediaSample(element<HTMLCanvasElement>("#mediaCanvas"), preset.mediaKind, state.mediaSampleIndex, state.mediaHighlight);
      element<HTMLCanvasElement>("#mediaCanvas").dataset.drawable = String(preset.mediaKind === "sketch" || preset.mediaKind === "digits");
      element<HTMLElement>("#mediaSampleText").textContent = mediaSampleText(preset.mediaKind, state.mediaSampleIndex, state.mediaHighlight);
      element<HTMLButtonElement>("#toggleMediaHighlight").textContent = state.mediaHighlight ? "강조 지우기" : "한 부분만 강조";
    }
  }
  if (state.lessonStep === 4 && !isPixelPreset(state.preset) && !isCustomPreset(state.preset)) {
    drawDecisionSurface(element<HTMLCanvasElement>("#modelCanvas"), state.model, state.data, state.testInput, { explanationStep: 4, selectedNeuron: state.selectedNeuron, showNeuronBoundaries: state.showNeuronBoundaries, showDecisionBoundary: state.showDecisionBoundary, showProbe: boundaryProbe, selectedPoint: boundarySelectedPoint });
    drawLossChart(element<HTMLCanvasElement>("#lossCanvas"), state.history);
    element<SVGSVGElement>("#networkSvg").removeAttribute("hidden");
    const chosen = boundarySelectedPoint === null ? null : state.data[boundarySelectedPoint];
    const ruleTruth=state.testInput.x===0||state.testInput.y===0?'가운데는 정답 미지정':`규칙의 정답 ${preset.classes[Number((state.testInput.x<0)!==(state.testInput.y<0))]}`;
    element<HTMLElement>("#boundarySelectedData").textContent = chosen ? `자료 정답 ${preset.classes[chosen.label]} · 키커 ${chosen.x < 0 ? "왼쪽" : "오른쪽"} / 골키퍼 ${chosen.y < 0 ? "왼쪽" : "오른쪽"}` : boundaryProbe?`확인점 (${state.testInput.x.toFixed(2)}, ${state.testInput.y.toFixed(2)}) · ${ruleTruth}`:"점을 선택하거나 빈 곳에서 확인점을 움직여 보세요.";
    element<HTMLElement>("#boundarySelectedResult").textContent = `예상 ${preset.classes[prediction.probability >= .5 ? 1 : 0]} · 골 가능성 ${(prediction.probability * 100).toFixed(1)}%`;
    element<SVGSVGElement>("#networkSvg").innerHTML = networkGraphMarkup(state.model, prediction.hidden,[state.testInput.x,state.testInput.y]);
    element('#boundaryLiveCalculation').innerHTML=liveCalculation(penaltyPixelModel(state.model),[state.testInput.x,state.testInput.y],preset.classes);
    element('#boundarySignalNetwork').innerHTML=signalNetwork(penaltyPixelModel(state.model),[state.testInput.x,state.testInput.y],preset.classes);
  }
  if (state.lessonStep === 3 && state.preset!=='xor' && !isPixelPreset(state.preset) && !isCustomPreset(state.preset)) {
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
  prediction.hidden.forEach((value, index) => { const item = document.createElement("span"); item.textContent = `은닉 뉴런 ${index + 1}: ${value.toFixed(3)}`; values.append(item); });
  element<HTMLPreElement>("#formulaPanel").textContent = calculationText(state);
  const titles = ["옆으로 한 가지만 바꾸기", "작은 질문의 색 선", "여러 표를 한데 모으기", "두 답이 같아지는 검은 선"];
  const subtitles = ["주황 점과 보라 십자의 세로 높이를 비교하세요.", "한 번에 가로 힌트 하나만 바꿉니다.", "바꾸기 전과 뒤의 가능성을 비교하세요.", "검은 선 위에서는 두 답이 같은 표를 받습니다."];
  element<HTMLElement>("#plotTitle").textContent = state.preset === "xor" ? XOR_LESSON[state.explanationStep - 1]!.tab : titles[state.explanationStep - 1]!;
  const xorSubtitles = ["가로는 키커, 세로는 골키퍼의 방향이며 색은 결과입니다.", "어느 선 하나로도 골과 막힘을 완전히 나눌 수 없습니다.", "두 선 사이에 방향이 다른 두 골만 남습니다.", "주황색 대표 골을 안쪽에 넣는 선의 이동을 봅니다."];
  element<HTMLElement>("#plotSubtitle").textContent = state.preset === "xor" ? xorSubtitles[state.explanationStep - 1]! : subtitles[state.explanationStep - 1]!;
  if (state.lessonStep === 5) renderExperiments(state, store);
  renderCustomLab(state); if (featureUiStore) renderFeatureLab(state, featureUiStore.snapshot);
}

function addPointFromCanvas(event: MouseEvent, store: LabStore): void {
  if(store.snapshot.preset==='xor')return; // Penalty records come from photo choices, never plot clicks.
  const canvas = event.currentTarget as HTMLCanvasElement; const rect = canvas.getBoundingClientRect();
  store.addDataPoint(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
  showToast("새 사례를 점으로 추가했습니다.");
}

export function mountApp(store = createInitialStore()): LabStore {
  const goImageStep = (step: 1 | 2 | 3 | 4 | 5) => {
    if (step === 3 && store.snapshot.preset === "custom") step = 4;
    if (step >= 3) { const error = imageWorkspace.ready(); if (error) return showToast(error); }
    if (step === 5 && !imageWorkspace.store.snapshot.model.epoch) return showToast("먼저 학습해 주세요.");
    store.setLessonStep(step);
  };
  imageWorkspace = new ImageWorkspace(showToast, goImageStep, (kind) => { customDraft = createCustomDraft(kind); syncCustomStore(store); store.setLessonStep(2); });
  imageWorkspace.configure(isPixelPreset(store.snapshot.preset) ? store.snapshot.preset : store.snapshot.preset === "webcam" ? "webcam" : "custom");
  penaltyCollection=new PenaltyCollection(store,showToast);
  penaltyLesson=new PenaltyLesson(()=>store.beginPractice());
  workspacePanels(element("#customDataView"), [...element("#customDataView .image-collection").children], ["클래스·자료", "자료 수집"], () => renderCustomLab(store.snapshot));
  const featureStore = new FeatureLabStore(); featureUiStore = featureStore;
  if (isCustomPreset(store.snapshot.preset)) { const projection = projectCustomDataset(customDraft); featureStore.setDataset(projection.points, projection.classes); }
  const rerender = () => render(store.snapshot, store);
  tabularLesson = new TabularLesson(element("#customFeatureView"), () => renderCustomLab(store.snapshot), showToast);
  featureTrainingPanels(element("#customTrainingView"), rerender);
  featureTrainingPanels(element("#boundaryTrainingView"), rerender);
  for(const [svg,id] of [['#networkSvg','boundaryLiveCalculation'],['#featureNetworkSvg','featureLiveCalculation']]){const panel=document.createElement('div');panel.id=id!;element(svg!).after(panel);}
  installSignalNetwork(element('#networkSvg'),'boundarySignalNetwork');installSignalNetwork(element('#featureNetworkSvg'),'featureSignalNetwork');
  document.querySelectorAll<HTMLDetailsElement>('[data-app-page="5"] details').forEach(panel=>panel.open=true);
  const axes = document.createElement("div"); axes.className = "feature-axis-pair practice-axes";
  axes.innerHTML = '<label>가로 특징<select id="featurePracticeX"></select></label><label>세로 특징<select id="featurePracticeY"></select></label><span>바꾸면 좌표·분포가 바뀌고 학습이 초기화됩니다.</span>';
  element("#customTrainingView .feature-training-stage .stage-toolbar").after(axes);
  for (const [id, axis] of [["featurePracticeX", "xFeature"], ["featurePracticeY", "yFeature"]] as const) element(id === "featurePracticeX" ? "#featurePracticeX" : "#featurePracticeY").addEventListener("change", event => {
    const value = Number((event.target as HTMLSelectElement).value), other = axis === "xFeature" ? customDraft.yFeature : customDraft.xFeature;
    if (value === other) { showToast("두 축에는 서로 다른 특징을 골라 주세요."); return rerender(); }
    stopFeatureAuto(); customDraft[axis] = value; syncCustomStore(store); showToast("새 특징으로 분포를 바꾸었습니다. 여기서 다시 학습하세요.");
  });
  uiRerender = rerender;
  store.subscribe(rerender); featureStore.subscribe(rerender);
  document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((card) => card.addEventListener("click", () => {
    const preset = card.dataset.preset as PresetName;
    boundarySelectedPoint = null; featureSelectedPoint = null; boundaryProbe=false;featureProbe=false;customClassPage=0; customSelectedClass=0; tabularLesson?.reset();penaltyCollection.reset();penaltyLesson.reset();
    if (preset === "custom") { customDraft = createCustomDraft(); featureStore.setHiddenUnits(1); syncCustomPreset("custom"); imageWorkspace.configure("custom"); }
    else if (isPixelPreset(preset) || preset === "webcam") imageWorkspace.configure(preset);
    store.setPreset(preset, { restartLesson: true }); if (preset === "custom") syncCustomStore(store);
  }));
  document.querySelectorAll<HTMLButtonElement>("[data-go-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.goStep) as LabState["lessonStep"]; if (step <= store.snapshot.furthestLessonStep) { if (usesImages(store.snapshot.preset)) goImageStep(step); else { if(isCustomPreset(store.snapshot.preset)&&step>=3){const error=validateCustomDataset(customDraft);if(error)return showToast(error);} if(step===5&&!featureStore.snapshot.model.epoch&&isCustomPreset(store.snapshot.preset))return showToast("먼저 학습해 주세요."); store.setLessonStep(step); } } }));
  document.querySelectorAll<HTMLButtonElement>("[data-back]").forEach((button) => button.addEventListener("click", () => {
    if (store.snapshot.preset === "custom" && store.snapshot.lessonStep === 4) store.setLessonStep(2); else store.previousLesson();
  }));
  element<HTMLButtonElement>("#scenarioNext").addEventListener("click", () => store.setLessonStep(2));
  element<HTMLButtonElement>("#dataNext").addEventListener("click", () => {
    if(store.snapshot.preset==='xor'){store.setLessonStep(3);return;}
    if (usesImages(store.snapshot.preset)) { const error = imageWorkspace.ready(); if (error) return showToast(error); store.setLessonStep(store.snapshot.preset === "custom" ? 4 : 3); return; }
    if (isCustomPreset(store.snapshot.preset)) { const error = validateCustomDataset(customDraft); if (error) return showToast(error); syncCustomStore(store); store.setLessonStep(4); return; }
    const error = store.prepareExplanationModel(); if (error) return showToast(error); store.setLessonStep(3);
  });
  element<HTMLButtonElement>("#modelNext").addEventListener("click", () => {
    const epochs = usesImages(store.snapshot.preset) ? imageWorkspace.store.snapshot.model.epoch : isCustomPreset(store.snapshot.preset) ? featureStore.snapshot.model.epoch : store.snapshot.model.epoch;
    if (!epochs) return showToast("모델을 적어도 한 번 학습시켜 주세요."); store.setLessonStep(5);
  });
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
  document.querySelectorAll<HTMLButtonElement>("[data-custom-input]").forEach((button) => button.addEventListener("click", () => {
    const kind = button.dataset.customInput as CustomInputKind; if (kind === customDraft.inputKind) return;
    const classes = [...customDraft.classes]; customDraft = createCustomDraft(kind); customDraft.classes = classes;
    if (kind === "drawing" || kind === "webcam") imageWorkspace.configure("custom", kind, classes);
    syncCustomStore(store);
  }));
  element<HTMLDivElement>("#customClassInputs").addEventListener("change", (event) => { const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-custom-class]"); if (!input) return; const index = Number(input.dataset.customClass); customDraft.classes[index] = input.value.trim() || `클래스 ${index + 1}`; syncCustomStore(store); });
  element<HTMLDivElement>("#customClassInputs").addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-custom-class]"); if (!button) return; const name = customDraft.classes[Number(button.dataset.removeCustomClass)] ?? "클래스"; const error = removeCustomClass(customDraft, Number(button.dataset.removeCustomClass)); if (error) return showToast(error); syncCustomStore(store); showToast(`${name} 클래스와 그 자료를 함께 지웠습니다.`); });
  const addClass = () => { const input = element<HTMLInputElement>("#customNewClassName"); const error = addCustomClass(customDraft, input.value); if (error) return showToast(error); const name = input.value.trim(); input.value = ""; customSelectedClass=customDraft.classes.length-1; customClassPage=Math.floor(customSelectedClass/3); syncCustomStore(store); showToast(`${name} 클래스를 추가했습니다.`); };
  element<HTMLButtonElement>("#customAddClass").addEventListener("click", addClass); element<HTMLInputElement>("#customNewClassName").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addClass(); } });
  element<HTMLDivElement>("#customClassInputs").addEventListener("click",event=>{
    const target=event.target as HTMLElement;
    const select=target.closest<HTMLElement>("[data-select-custom-class]");if(select){customSelectedClass=Number(select.dataset.selectCustomClass);renderCustomLab(store.snapshot);}
    const rename=target.closest<HTMLElement>("[data-rename-custom-class]");if(rename){const i=Number(rename.dataset.renameCustomClass),name=window.prompt("클래스 이름",customDraft.classes[i]);if(name?.trim()){customDraft.classes[i]=name.trim();syncCustomStore(store);}}
    const remove=target.closest<HTMLElement>("[data-remove-custom-row]");if(remove&&window.confirm("이 자료를 삭제할까요?")){customDraft.rows=customDraft.rows.filter(row=>row.id!==Number(remove.dataset.removeCustomRow));syncCustomStore(store);}
  });
  element<HTMLButtonElement>("#customClassesPrev").addEventListener("click",()=>{customClassPage--;renderCustomLab(store.snapshot);});
  element<HTMLButtonElement>("#customClassesNext").addEventListener("click",()=>{customClassPage++;renderCustomLab(store.snapshot);});
  element<HTMLTextAreaElement>("#customTextValue").addEventListener("input",()=>{const values=textFeatures(element<HTMLTextAreaElement>("#customTextValue").value);element<HTMLElement>("#customTextPreview").textContent=customDraft.features.map((name,i)=>name+": "+Number(values[i]!.toFixed(1))).join(" · ");});
  element<HTMLButtonElement>("#customAddFeature").addEventListener("click", () => { if (customDraft.features.length >= 5) return; customDraft.features.push(`특징 ${customDraft.features.length + 1}`); customDraft.rows.forEach((row) => row.values.push(0)); syncCustomStore(store); });
  element<HTMLDivElement>("#customFeatureNames").addEventListener("change", (event) => { const input = (event.target as HTMLElement).closest<HTMLInputElement>("[data-custom-feature]"); if (!input) return; const index = Number(input.dataset.customFeature); customDraft.features[index] = input.value.trim() || `특징 ${index + 1}`; syncCustomStore(store); });
  element<HTMLDivElement>("#customFeatureNames").addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-custom-feature]"); if (!button || customDraft.features.length <= 2) return; const index = Number(button.dataset.removeCustomFeature); customDraft.features.splice(index, 1); customDraft.rows.forEach((row) => row.values.splice(index, 1)); const remap = (selected: number) => selected > index ? selected - 1 : selected === index ? 0 : selected; customDraft.xFeature = remap(customDraft.xFeature); customDraft.yFeature = remap(customDraft.yFeature); if (customDraft.xFeature === customDraft.yFeature) customDraft.yFeature = customDraft.xFeature === 0 ? 1 : 0; syncCustomStore(store); });
  element<HTMLButtonElement>("#customLoadExample").addEventListener("click", () => { customDraft = createCustomExample(); syncCustomStore(store); showToast("특징을 바꾸며 비교할 수 있는 예시를 채웠습니다."); });
  element<HTMLFormElement>("#customRowForm").addEventListener("submit", (event) => { event.preventDefault(); const inputs = [...element<HTMLDivElement>("#customRowValues").querySelectorAll<HTMLInputElement>("[data-custom-value]")]; const values = inputs.map((input) => Number(input.value)); if (values.some((value) => !Number.isFinite(value)) || inputs.some((input) => input.value === "")) return showToast("모든 특징값을 숫자로 적어 주세요."); customDraft.rows.unshift({ id: customDraft.nextId, name: `자료 ${customDraft.nextId}`, label: Number(element<HTMLSelectElement>("#customRowClass").value) as Label, values }); customDraft.nextId += 1; syncCustomStore(store); showToast("새 자료를 학습 자료에 추가했습니다."); });
  element<HTMLInputElement>("#customExcelFile").addEventListener("change", async event => {
    const input = event.currentTarget as HTMLInputElement, file = input.files?.[0]; if (!file) return;
    const status = element<HTMLElement>("#customImportStatus"), previousDraft = customDraft;
    status.textContent = "엑셀 파일을 읽고 있습니다…"; input.disabled = true;
    try {
      const imported = await importSpreadsheet(file);
      if (customDraft !== previousDraft || store.snapshot.preset !== "custom" || customDraft.inputKind !== "numbers") return;
      if (customDraft.rows.length && !window.confirm(`현재 자료 ${customDraft.rows.length}개를 엑셀 자료 ${imported.rows.length}개로 바꿀까요? 기존 학습도 초기화됩니다.`)) { status.textContent = "취소했습니다. 기존 자료는 그대로입니다."; return; }
      customDraft = imported; customClassPage = 0; customSelectedClass = 0; syncCustomStore(store);
      status.textContent = `${imported.rows.length}개 자료 · ${imported.classes.length}개 클래스 · ${imported.features.length}개 특징을 가져왔습니다.`;
    } catch (error) { status.textContent = error instanceof Error ? error.message : "엑셀을 가져오지 못했습니다."; }
    finally { input.value = ""; input.disabled = false; }
  });
  element<HTMLTableSectionElement>("#customTableBody").addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-custom-row]"); if (!button) return; customDraft.rows = customDraft.rows.filter((row) => row.id !== Number(button.dataset.removeCustomRow)); syncCustomStore(store); });
  element<HTMLSelectElement>("#customXAxis").addEventListener("change", (event) => { customDraft.xFeature = Number((event.currentTarget as HTMLSelectElement).value); syncCustomStore(store); });
  element<HTMLSelectElement>("#customYAxis").addEventListener("change", (event) => { customDraft.yFeature = Number((event.currentTarget as HTMLSelectElement).value); syncCustomStore(store); });
  element<HTMLButtonElement>("#customFeatureNext").addEventListener("click", () => { const error = validateCustomDataset(customDraft); if (error) return showToast(error); syncCustomStore(store); store.setLessonStep(4); });
  element<HTMLButtonElement>("#customTextAdd").addEventListener("click", () => { const input = element<HTMLTextAreaElement>("#customTextValue"); const source = input.value.trim(); if (!source) return showToast("글을 먼저 입력해 주세요."); addCustomRow(store, Number(element<HTMLSelectElement>("#customTextClass").value) as Label, textFeatures(source), source); input.value = ""; });
  element<HTMLButtonElement>("#nextMediaSample").addEventListener("click", () => store.nextMediaSample());
  element<HTMLButtonElement>("#toggleMediaHighlight").addEventListener("click", () => store.toggleMediaHighlight());
  element<HTMLButtonElement>("#playMediaSound").addEventListener("click", () => playSoundSample(store.snapshot.mediaSampleIndex));
  element<HTMLCanvasElement>("#mediaCanvas").addEventListener("click", (event) => {
    const state = store.snapshot; const kind = PRESETS[state.preset].mediaKind;
    if (toggleMediaPixel(event.currentTarget as HTMLCanvasElement, event, kind, state.mediaSampleIndex, state.mediaHighlight)) showToast("그림 한 칸을 바꿨습니다. 전체 모양이 어떻게 달라지는지 보세요.");
  });
  document.querySelectorAll<HTMLButtonElement>("[data-explanation-step]").forEach((button) => button.addEventListener("click", () => { const step = Number(button.dataset.explanationStep) as LabState["explanationStep"]; if (step <= store.snapshot.furthestExplanationStep) { explanationMotionProgress = 1; store.setExplanationStep(step); } }));
  element<HTMLButtonElement>("#revealHighlight").addEventListener("click", () => { explanationMotionProgress = 0; store.revealHighlight(); startUnderstandingMotion("boundary"); });
  element<HTMLButtonElement>("#nextQuiz").addEventListener("click", () => { explanationMotionProgress = 1; if (store.snapshot.explanationStep === 4) store.beginPractice(); else store.nextQuiz(); });
  const updateInput = () => store.setTestInput(Number(element<HTMLInputElement>("#testX").value), Number(element<HTMLInputElement>("#testY").value));
  element<HTMLInputElement>("#testX").addEventListener("input", updateInput); element<HTMLInputElement>("#testY").addEventListener("input", updateInput);
  element<HTMLButtonElement>("#toggleFormula").addEventListener("click", (event) => { const panel = element<HTMLPreElement>("#formulaPanel"); panel.hidden = !panel.hidden; (event.currentTarget as HTMLButtonElement).textContent = panel.hidden ? "계산 자세히" : "계산 닫기"; });
  element<HTMLButtonElement>("#saveRun").addEventListener("click", () => { const error = store.saveExperiment(); showToast(error ?? "지금 결과를 기록했습니다."); });
  element<HTMLButtonElement>("#exportJson").addEventListener("click", () => { const model = store.exportModel(); if (model) downloadText("neural-lab-model.json", serializeModel(model), "application/json"); });
  element<HTMLButtonElement>("#exportScratch").addEventListener("click", () => downloadText("neural-lab-turbowarp.js", generateScratchExtension(store.snapshot.model), "text/javascript"));
  element<HTMLButtonElement>("#exportScratchProject").addEventListener("click", () => { downloadBlob("neural-lab-scratch.sb3", createScratchProject(store.snapshot.model)); showToast("Scratch에서 열 수 있는 블록 파일을 만들었습니다."); });
  element<HTMLInputElement>("#importJson").addEventListener("change", async (event) => { const input = event.currentTarget as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { store.importModel(deserializeModel(await file.text())); store.setLessonStep(5); showToast("보관한 모델을 열었습니다."); } catch (error) { showToast(error instanceof Error ? error.message : "파일을 열지 못했습니다."); } finally { input.value = ""; } });
  ([ ["#featureTrainOne", 1], ["#featureTrainTen", 10], ["#featureTrainHundred", 100] ] as const).forEach(([selector, epochs]) => element<HTMLButtonElement>(selector).addEventListener("click", () => featureStore.train(epochs)));
  element<HTMLButtonElement>("#featureResetModel").addEventListener("click", () => { featureStore.resetModel(); showToast("연습 전 상태로 되돌렸습니다."); });
  element<HTMLInputElement>("#featureHiddenUnits").addEventListener("input", (event) => featureStore.setHiddenUnits(Number((event.currentTarget as HTMLInputElement).value)));
  element<HTMLSelectElement>("#featureActivation").addEventListener("change", (event) => featureStore.setActivation((event.currentTarget as HTMLSelectElement).value as ActivationName));
  element<HTMLInputElement>("#featureLearningRate").addEventListener("change", (event) => featureStore.setLearningRate(Number((event.currentTarget as HTMLInputElement).value)));
  element<HTMLInputElement>("#featureNeuronLayer").addEventListener("change", (event) => featureStore.setLayers({ showNeuronBoundaries: (event.currentTarget as HTMLInputElement).checked }));
  element<HTMLInputElement>("#featureDecisionLayer").addEventListener("change", (event) => featureStore.setLayers({ showDecisionBoundary: (event.currentTarget as HTMLInputElement).checked }));
  const nearestPoint = (canvas: HTMLCanvasElement, event: MouseEvent, points: Array<{x:number;y:number}>) => { const r=canvas.getBoundingClientRect();let selected:number|null=null,best=16**2;points.forEach((p,i)=>{const d=((p.x+1)/2*r.width-(event.clientX-r.left))**2+((1-p.y)/2*r.height-(event.clientY-r.top))**2;if(d<best){best=d;selected=i;}});return selected;};
  element<HTMLCanvasElement>("#featureModelCanvas").addEventListener("click",event=>{ const i=nearestPoint(event.currentTarget as HTMLCanvasElement,event,featureStore.snapshot.data.map(row=>({x:row.pixels[0]!,y:row.pixels[1]!})));if(i===null)return;featureProbe=false;featureSelectedPoint=i;const p=featureStore.snapshot.data[i]!.pixels;featureStore.setTestInput(p[0]!,p[1]!);revealModelPanel(element("#customTrainingView"));});
  element<HTMLCanvasElement>("#modelCanvas").addEventListener("click",event=>{const i=nearestPoint(event.currentTarget as HTMLCanvasElement,event,store.snapshot.data);if(i===null)return;boundaryProbe=false;boundarySelectedPoint=i;const p=store.snapshot.data[i]!;store.setTestInput(p.x,p.y);revealModelPanel(element('#boundaryTrainingView'));});
  bindPracticeProbe(element('#modelCanvas'),()=>store.snapshot.data,()=>store.snapshot.testInput,(i,x,y)=>{boundarySelectedPoint=i;boundaryProbe=i===null;store.setTestInput(x,y);});
  bindPracticeProbe(element('#featureModelCanvas'),()=>featureStore.snapshot.data.map(row=>({x:row.pixels[0]!,y:row.pixels[1]!})),()=>featureStore.snapshot.testInput,(i,x,y)=>{featureSelectedPoint=i;featureProbe=i===null;featureStore.setTestInput(x,y);});
  const updateFeatureUse = () => featureStore.setTestInput(Number(element<HTMLInputElement>("#featureUseX").value), Number(element<HTMLInputElement>("#featureUseY").value)); element<HTMLInputElement>("#featureUseX").addEventListener("input", updateFeatureUse); element<HTMLInputElement>("#featureUseY").addEventListener("input", updateFeatureUse);
  element<HTMLButtonElement>("#featureAutoTrain").addEventListener("click", () => { if (featureAutoTimer) { stopFeatureAuto(); rerender(); return; } featureAutoTimer = window.setInterval(() => { if (!isCustomPreset(store.snapshot.preset) || store.snapshot.lessonStep !== 4 || featureStore.snapshot.model.epoch >= 1000) { stopFeatureAuto(); rerender(); return; } featureStore.train(5); }, 100); featureStore.train(1); });
  element<HTMLButtonElement>("#featureExportScratch").addEventListener("click", () => { const state = featureStore.snapshot; if(!state.model.epoch)return showToast("먼저 학습해 주세요."); downloadBlob("neural-lab-feature-scratch.sb3", createPixelScratchProject(state.model, state.classes, [], { blockName: "특징 두 개로 예측하기", inputListName: "특징 값", stageTitle: "Neural Lab 특징 모델", inputSummary: "특징 2개" })); showToast("학습 자료 없이 예측 모델만 내보냈습니다."); });
  element<HTMLButtonElement>("#featureExportExtension").addEventListener("click",()=>{const state=featureStore.snapshot;if(!state.model.epoch)return showToast("먼저 학습해 주세요.");downloadText("neural-lab-model.js",generateInferenceExtension(state.model,state.classes,{kind:customDraft.inputKind==="text"?"text":"numbers",featureCount:customDraft.features.length,axes:[customDraft.xFeature,customDraft.yFeature],ranges:[customDraft.xFeature,customDraft.yFeature].map(i=>[Math.min(...customDraft.rows.map(row=>row.values[i]!)),Math.max(...customDraft.rows.map(row=>row.values[i]!))])}),"text/javascript");});
  element<HTMLButtonElement>("#featureExportJson").addEventListener("click", () => { const state = featureStore.snapshot; downloadText("neural-lab-feature-model.json", JSON.stringify({ format: "neural-lab/feature-model-v1", axes: projectCustomDataset(customDraft).axes, inputSpace: "normalized-map", normalization: [customDraft.xFeature, customDraft.yFeature].map((index) => ({ minimum: Math.min(...customDraft.rows.map((row) => row.values[index]!)), maximum: Math.max(...customDraft.rows.map((row) => row.values[index]!)), range: [-.9, .9] })), classes: state.classes, model: state.model }, null, 2), "application/json"); });
  const dialog = element<HTMLDialogElement>("#guideDialog"); element<HTMLButtonElement>("#openGuide").addEventListener("click", () => dialog.showModal());
  return store;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mountApp()); else mountApp();
