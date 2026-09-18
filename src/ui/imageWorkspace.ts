import { captureImage, drawImagePixels, IMAGE_INPUTS, IMAGE_SIDE } from "../core/imageInput";
import { imageFeatureLegend } from "../core/imageFeatures";
import { ImageFeatureLesson } from "./imageFeatureLesson";
import { revealModelPanel } from "./workspacePanels";
import { OMR_CENTERS } from "../data/pixelDatasets";
import { downloadBlob, downloadText } from "../export/modelJson";
import { generateInferenceExtension } from "../export/inferenceExtension";
import { createPixelScratchProject } from "../export/pixelScratchProject";
import { ImageLabStore, type ImageTask, type ImageMode } from "../state/imageLabStore";
import { drawPixelLatentMap, pixelMapExampleAt, projectedPixelModel } from "../visualization/pixelLatentMap";
import { pixelNetworkGraphMarkup } from "../visualization/pixelNetworkGraph";
import { drawLossChart } from "../visualization/lossChart";
import "./imageWorkspace.css";

const COLORS = ["#f17605", "#df466f", "#7446f5", "#1769d2", "#1558b7", "#a93658"];
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
type CaptureKind = "drawing" | "webcam";

/** Shared image workflow. The DOM is created once, so video, focus and drafts survive updates. */
export class ImageWorkspace {
  readonly store = new ImageLabStore();
  private roots = new Map<number, HTMLElement>();
  private capture: HTMLElement;
  private step = 0;
  private active = false;
  private kind: CaptureKind = "drawing";
  private stream: MediaStream | null = null;
  private cameraToken = 0;
  private frame = 0;
  private training = 0;
  private classPage = 0;
  private samplePage = 0;
  private featureLesson: ImageFeatureLesson;
  private canCapture = false;
  private collectionSignature = "";
  private showLines = true;
  private showBoundary = true;

  constructor(private message: (text: string) => void, private go: (step: 1 | 2 | 3 | 4 | 5) => void, private changeInput: (kind: "numbers" | "text") => void) {
    const pages: Record<number, string> = {
      2: `<div class="image-collection"><section class="image-panel image-classes"><div class="image-heading"><h2>클래스별 자료</h2><span id="imageTotal"></span></div><div id="imageClassList"></div><form id="imageNewClass"><input name="name" aria-label="새 이미지 클래스 이름" maxlength="18" placeholder="새 클래스 이름"><button type="submit">+ 추가</button></form><div class="image-pager"><button id="imageClassesPrev" aria-label="이전 클래스">←</button><span id="imageClassPage"></span><button id="imageClassesNext" aria-label="다음 클래스">→</button></div></section><section class="image-panel image-capture-slot" id="imageCollectSlot"></section></div>`,
      3: `<div></div>`,
      4: `<div class="image-train"><section class="image-panel image-results-panel"><div class="image-heading"><h2 id="imageResultTitle">특징 지도에서 학습하기</h2><span id="imageModelTag">고른 특징으로 학습</span></div><div class="image-training-choice"><select id="imageMode" aria-label="학습 방법"><option value="map">고른 두 특징으로 학습</option><option value="pixels">그림 전체로 학습</option></select><button id="imageChooseFeatures">특징 고르기</button><span id="imageModeNote"></span></div><div id="imageResultGrid" class="image-result-grid"></div><canvas id="imageMap" width="720" height="460" hidden aria-label="두 그림 기준에 제한한 실험의 실제 뉴런 기준선과 최종 경계"></canvas><div id="imageMapControls" class="image-map-controls" hidden><label><input id="imageLines" type="checkbox" checked> 모든 뉴런 기준선</label><label><input id="imageBoundary" type="checkbox" checked> 최종 경계</label><span>화살표: 뉴런 값이 커지는 쪽</span></div><div class="image-pager" id="imageResultPager"><button id="imageResultsPrev" aria-label="이전 그림">←</button><span id="imageResultPage"></span><button id="imageResultsNext" aria-label="다음 그림">→</button></div><div class="image-trainer" title="학습 1번은 모은 모든 그림을 한 바퀴 보는 것입니다."><button id="imageTrainOne">1번</button><button id="imageTrainTen">10번</button><button id="imageTrainHundred">100번</button><button id="imageAutoTrain" class="button primary">계속 학습</button></div><div class="image-loss"><span>오차</span><canvas id="imageLoss" width="650" height="75" aria-label="학습 중 오차 변화"></canvas></div></section><aside class="image-panel image-model-panel"><label class="image-hidden">은닉 뉴런 <output id="imageHiddenValue"></output><input id="imageHidden" type="range" min="1" max="16" value="8"></label><div class="image-metrics"><div><span>학습 횟수</span><b id="imageEpoch">0</b></div><div><span>학습 정답률</span><b id="imageAccuracy">—</b></div></div><div class="image-focus"><canvas id="imageFocus" width="84" height="84"></canvas><span id="imageFocusName"></span></div><div id="imageTrainBars"></div><details class="image-detail"><summary>연결 지도</summary><svg id="imageNetwork" viewBox="0 0 330 300" role="img" aria-label="선택한 그림의 은닉 뉴런 값과 예상"></svg></details><details class="image-detail"><summary>학습 설정</summary><label>한 번에 고치는 크기 <input id="imageRate" type="range" min=".01" max=".3" step=".01" value=".12"><output id="imageRateValue"></output></label><button id="imageReset" class="button secondary">처음부터 다시 학습</button></details></aside></div>`,
      5: `<div class="image-use"><section id="imageTestSlot" class="image-panel image-capture-slot"></section><section class="image-panel image-test-result"><h2>새 그림의 예상</h2><p id="imagePredictionTitle"></p><div id="imageUseBars"></div><div class="image-test-check"><label>실제 정답<select id="imageTestLabel"></select></label><button id="imageRecordTest" class="button secondary">이 결과 기록</button><p id="imageTestScore">학습에 넣지 않은 그림으로 시험해 보세요.</p></div><details class="image-detail"><summary>모델 가져가기</summary><p>학습은 끝났습니다. 이 파일에는 모델만 담고, 새 그림의 라벨·점수만 가져다 씁니다.</p><button id="imageExportExtension" class="button primary">카메라·라벨 블록 .js (TurboWarp)</button><p>TurboWarp → 확장 추가 → 사용자 확장 → 파일. ‘샌드박스 없이 실행’을 선택하세요. 카메라는 블록을 실행할 때만 켜집니다.</p><button id="imageExportSb3" class="button secondary">일반 Scratch 예측 블록 .sb3</button><p>일반 Scratch는 사용자 카메라 확장을 지원하지 않습니다. .sb3에서는 ‘그림 밝기’ 목록에 196칸을 넣고 예측 블록을 실행합니다.</p><button id="imageExportJson" class="button secondary">모델 보관 .json</button></details></section></div>`,
    };
    Object.entries(pages).forEach(([step, html]) => {
      const root = document.createElement("div"); root.className = "image-workspace"; root.hidden = true; root.innerHTML = html;
      const labels: Record<string, string[]> = { 2: ["클래스·자료", "그림 수집"], 3: ["그림·계산 보기", "설명·퀴즈"], 4: ["학습하기", "모델 살펴보기"], 5: ["새 그림", "예상 결과"] };
      const compactTabs = document.createElement("nav"); compactTabs.className = "image-compact-tabs"; compactTabs.setAttribute("aria-label", "작은 화면 작업면");
      compactTabs.innerHTML = labels[step]!.map((label, i) => `<button data-image-panel="${i}" aria-pressed="${i === 0}">${label}</button>`).join("");
      const panels = [...root.firstElementChild!.children]; panels[0]?.classList.add("compact-selected");
      compactTabs.addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-panel]"); if (!button) return; const index = Number(button.dataset.imagePanel); panels.forEach((panel,i) => panel.classList.toggle("compact-selected",i === index)); compactTabs.querySelectorAll("button").forEach((tab,i) => tab.setAttribute("aria-pressed",String(i === index))); this.render(); });
      root.prepend(compactTabs);
      document.querySelector(`[data-app-page="${step}"] .page-nav`)!.before(root); this.roots.set(Number(step), root);
    });
    this.featureLesson = new ImageFeatureLesson(this.roots.get(3)!, this.store, () => this.go(4), this.message);
    const axisBar = document.createElement("div"); axisBar.className = "feature-axis-pair practice-axes";
    axisBar.innerHTML = '<label>가로 특징<select id="imagePracticeX"></select></label><label>세로 특징<select id="imagePracticeY"></select></label><span>특징을 바꾸면 분포가 바뀌고 학습은 처음부터 시작합니다.</span>';
    this.el("imageChooseFeatures").replaceWith(axisBar);
    this.el("imageNetwork").closest("details")!.open = true;
    this.capture = document.createElement("div"); this.capture.className = "image-capture";
    this.capture.innerHTML = `<div class="image-heading"><h2 id="imageCaptureTitle">그림을 모아 보세요</h2><span id="imageCaptureClass"></span></div><div class="image-input-switch" id="imageInputSwitch"><button data-image-input="drawing">그리기</button><button data-image-input="webcam">웹캠</button></div><div class="image-capture-pair"><figure><div class="image-source"><canvas id="imageDraw" width="420" height="420" aria-label="자유롭게 그림 그리기"></canvas><video id="imageVideo" autoplay playsinline muted hidden aria-label="중앙을 정사각형으로 자른 웹캠"></video><span id="imageCameraEmpty" hidden>카메라를 켜고 손을 보여 주세요</span></div><figcaption id="imageSourceCaption">직접 그린 그림</figcaption></figure><span class="image-convert-arrow" aria-hidden="true">→</span><figure class="image-processed"><canvas id="imageInputPreview" width="224" height="224" aria-label="모델에 실제 입력하는 14×14 흑백 그림"></canvas><figcaption>모델이 받는 14×14칸</figcaption></figure></div><div class="image-capture-buttons"><button id="imageCameraStart" class="button secondary" hidden>카메라 켜기</button><button id="imageCameraStop" class="button secondary" hidden>카메라 끄기</button><button id="imageClear" class="button secondary">지우기</button><button id="imageCaptureAdd" class="button primary">이 그림 추가</button></div><p id="imageCaptureHint">한 칸의 진하기를 0~1로 바꾸어 입력합니다.</p><p id="imagePrivacy" hidden>영상은 이 브라우저에서만 처리됩니다. 배경도 그림에 포함됩니다.</p>`;
    document.querySelector("#imageCollectSlot")!.append(this.capture);
    const destination = document.createElement('label'); destination.id='imageAddDestination'; destination.className='image-add-destination';
    destination.innerHTML='<span>추가할 클래스</span><select id="imageAddClass" aria-label="추가 버튼의 클래스 선택"></select>';
    this.el('imageCaptureAdd').before(destination);
    const still = document.createElement("img"); still.id = "imageCameraStill"; still.alt = "촬영해 보관한 원본 그림"; still.hidden = true;
    this.capture.querySelector(".image-source")!.append(still);
    const removeSample = document.createElement("button"); removeSample.id = "imageRemoveSample"; removeSample.textContent = "이 자료 삭제"; removeSample.hidden = true;
    this.capture.querySelector(".image-capture-buttons")!.append(removeSample);
    removeSample.addEventListener("click", () => { const id = this.store.snapshot.selectedSample; if (id !== null && window.confirm("이 학습 그림 한 장을 삭제할까요? 모델은 다시 학습해야 합니다.")) this.store.removeSample(id); });
    const otherInputs = document.createElement("span");
    otherInputs.innerHTML = '<button data-image-other="numbers">숫자 자료</button><button data-image-other="text">텍스트 자료</button>';
    this.el("imageInputSwitch").append(otherInputs);
    otherInputs.addEventListener("click", (event) => {
      const kind = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-other]")?.dataset.imageOther as "numbers" | "text" | undefined;
      if (kind && (!this.store.snapshot.data.length || window.confirm("입력 형식을 바꾸면 현재 그림 자료와 모델을 비웁니다. 바꿀까요?"))) this.changeInput(kind);
    });
    this.bind(); this.store.subscribe(() => this.render());
  }
  private el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
  configure(task: ImageTask, kind: CaptureKind = task === "webcam" ? "webcam" : "drawing", classes?: string[]): void {
    this.stopCamera(); this.stopTraining(); this.featureLesson.stop(); this.kind = kind; this.classPage = 0; this.samplePage = 0; this.collectionSignature = ""; this.featureLesson.reset();
    this.store.configure(task, classes); this.clearDrawing();
  }
  show(active: boolean, step: number): void {
    if ((!active || step !== this.step) && this.active) { this.stopCamera(); this.stopTraining(); this.featureLesson.stop(); }
    this.active = active; this.step = step;
    this.roots.forEach((root, number) => { root.hidden = !active || step !== number; });
    if (!active) return;
    if (step === 2 || step === 5) {
      const slot = this.el(step === 2 ? "imageCollectSlot" : "imageTestSlot"); if (this.capture.parentElement !== slot) slot.append(this.capture);
      if (step === 5) this.store.selectSample(null);
    }
    this.render();
  }
  ready(): string | null { return this.store.coverageError(); }
  private options(select: HTMLSelectElement): void {
    const selected = select.value; const signature = this.store.snapshot.classes.join("\0");
    if (select.dataset.signature === signature) return;
    select.innerHTML = this.store.snapshot.classes.map((name, i) => `<option value="${i}">${escape(name)}</option>`).join("");
    if (this.store.snapshot.classes[Number(selected)]) select.value = selected; select.dataset.signature = signature;
  }
  private bars(id: string, probabilities: number[]): void {
    this.el(id).innerHTML = this.store.snapshot.classes.map((name, i) => `<div class="image-bar" style="--class-color:${COLORS[i % COLORS.length]}"><b title="${escape(name)}">${escape(name)}</b><span><i style="width:${(probabilities[i] ?? 0) * 100}%"></i></span><output>${((probabilities[i] ?? 0) * 100).toFixed(1)}%</output></div>`).join("");
  }
  private render(): void {
    if (!this.active) return;
    const s = this.store.snapshot;
    if (this.step === 2 || this.step === 5) this.renderCapture();
    if (this.step === 2) this.renderCollection();
    if (this.step === 3) this.featureLesson.render();
    if (this.step === 4) this.renderTraining();
    if (this.step === 5) {
      const p = this.store.predict(s.input).probabilities; this.bars("imageUseBars", p); this.options(this.el<HTMLSelectElement>("imageTestLabel"));
      this.el("imagePredictionTitle").textContent = s.model.epoch ? `모델의 선택: ${s.classes[p.indexOf(Math.max(...p))]}` : "먼저 학습을 시작해 주세요.";
      this.el("imageTestScore").textContent = s.testCount ? `새 그림 ${s.testCount}장 중 ${s.testCorrect}장 맞힘 · 현재 모델로 직접 시험한 결과` : "학습에 넣지 않은 그림으로 시험해 보세요.";
    }
  }
  private renderCollection(): void {
    const s = this.store.snapshot;
    const signature = `${s.revision}:${s.classes.join("|")}:${s.selectedClass}:${this.classPage}`; if (signature === this.collectionSignature) return; this.collectionSignature = signature;
    const pageCount = Math.ceil(s.classes.length / 3); this.classPage = Math.min(this.classPage, pageCount - 1);
    this.el("imageTotal").textContent = `${s.data.length}장${s.data.some((sample) => sample.source === "example") ? " · 시작 자료는 연습용 그림" : ""}`;
    this.el("imageClassList").innerHTML = s.classes.slice(this.classPage * 3, this.classPage * 3 + 3).map((name, local) => {
      const label = this.classPage * 3 + local; const samples = s.data.filter((sample) => sample.label === label);
      return `<article class="image-class ${s.selectedClass === label ? "selected" : ""}" style="--class-color:${COLORS[label % COLORS.length]}"><div class="image-class-top"><button data-select-image-class="${label}" aria-pressed="${s.selectedClass === label}">${escape(name)}</button><span>${samples.length}장</span><button data-rename-image-class="${label}" aria-label="${escape(name)} 이름 바꾸기">이름</button><button data-remove-image-class="${label}" aria-label="${escape(name)} 클래스 삭제" ${s.classes.length <= 2 ? "disabled" : ""}>×</button></div><div class="image-thumbnails">${samples.length ? samples.slice(0, 4).map((sample) => `<button data-image-sample="${sample.id}" title="${escape(name)} 그림 살펴보기">${sample.source === "webcam" && sample.image ? `<img src="${sample.image}" alt="${escape(name)} 촬영 자료">` : `<canvas width="84" height="84" data-thumb="${sample.id}"></canvas>`}</button>`).join("") : '<p>이 클래스를 선택하고 그림을 추가하세요.</p>'}</div></article>`;
    }).join("");
    this.el("imageClassList").querySelectorAll<HTMLCanvasElement>("[data-thumb]").forEach((canvas) => { const sample = s.data.find((item) => item.id === Number(canvas.dataset.thumb)); if (sample) drawImagePixels(canvas, sample.pixels); });
    this.el("imageClassPage").textContent = `${this.classPage + 1} / ${pageCount}`;
    this.el<HTMLButtonElement>("imageClassesPrev").disabled = this.classPage === 0; this.el<HTMLButtonElement>("imageClassesNext").disabled = this.classPage >= pageCount - 1;
  }
  private renderCapture(): void {
    const s = this.store.snapshot; const camera = this.kind === "webcam";
    this.el("imageInputSwitch").hidden = s.task !== "custom";
    this.capture.querySelectorAll<HTMLButtonElement>("[data-image-input]").forEach((button) => { button.classList.toggle("active", button.dataset.imageInput === this.kind); });
    this.el("imageDraw").hidden = camera; this.el("imageVideo").hidden = !camera; this.el("imageCameraEmpty").hidden = !camera || !!this.stream;
    const still = this.el<HTMLImageElement>("imageCameraStill"); still.hidden = !camera || !!this.stream || !s.inputImage;
    if (!still.hidden) { if (still.getAttribute("src") !== s.inputImage) still.src = s.inputImage!; this.el("imageCameraEmpty").hidden = true; }
    this.el("imageRemoveSample").hidden = this.step !== 2 || s.selectedSample === null;
    this.el("imageCameraStart").hidden = !camera || !!this.stream; this.el("imageCameraStop").hidden = !camera || !this.stream; this.el("imageClear").hidden = camera; this.el("imagePrivacy").hidden = !camera;
    this.el("imageCaptureTitle").textContent = this.step === 5 ? "새 그림으로 시험" : camera ? "사진 모으기" : "그림 모으기";
    this.el("imageSourceCaption").textContent = camera ? "지금 카메라에 보이는 그림" : "직접 그린 그림";
    this.el("imageCaptureClass").textContent = this.step === 2 ? `추가할 클래스: ${s.classes[s.selectedClass]}` : "학습 자료에는 추가되지 않습니다";
    const add = this.el<HTMLButtonElement>("imageCaptureAdd"); add.hidden = this.step !== 2; add.disabled = camera && !this.canCapture; add.textContent = `${s.classes[s.selectedClass]}에 추가`;
    this.el('imageAddDestination').hidden=this.step!==2;
    this.options(this.el<HTMLSelectElement>('imageAddClass')); this.el<HTMLSelectElement>('imageAddClass').value=String(s.selectedClass);
    this.el("imageCaptureHint").textContent = camera ? "손의 모양·거리·배경을 바꾸어 모아 보세요. 클래스마다 20장 이상을 권장합니다." : s.task === "omr" ? "칸을 벗어나도 괜찮습니다. 연필처럼 직접 칠해 보세요." : "같은 숫자도 크기와 모양을 조금씩 바꾸어 그려 보세요.";
    drawImagePixels(this.el<HTMLCanvasElement>("imageInputPreview"), s.input, true);
  }
  private renderTraining(): void {
    const s = this.store.snapshot; const map = s.mode === "map"; const metrics = this.store.metrics(); const focus = this.store.focus(); const result = this.store.predict();
    this.el("imageResultGrid").hidden = true; this.el("imageResultPager").hidden = true;
    this.el("imageMap").hidden = false; this.el("imageMapControls").hidden = !map;
    this.el("imageResultTitle").textContent = "점을 눌러 그림과 예상 확인";
    this.el("imageModelTag").textContent = map ? "고른 두 특징으로 학습" : "그림 전체로 학습";
    this.el<HTMLSelectElement>("imageMode").value = s.mode;
    this.el("imageModeNote").textContent = map ? "점 색 = 정답 · 배경색 = 예상 · 검은 선 = 최종 경계" : "점은 두 특징의 요약입니다. 그림 전체 모델의 경계는 이 평면으로 모두 표현할 수 없습니다.";
    this.el("imageTrainBars").hidden = s.selectedSample === null;
    this.el("imageFocus").hidden = s.selectedSample === null;
    this.el("imageNetwork").closest("details")!.hidden = false;
    for (const [id, value] of [["imagePracticeX", s.xFeature], ["imagePracticeY", s.yFeature]]) {
      const select = this.el<HTMLSelectElement>(id!);
      if (select.dataset.features !== s.features.map(f => f.id).join("|")) { select.innerHTML = s.features.map(f => `<option value="${f.id}">${escape(f.name)}</option>`).join(""); select.dataset.features = s.features.map(f => f.id).join("|"); }
      select.value = value!;
    }
    this.el<HTMLOutputElement>("imageHiddenValue").value = `${s.model.hiddenUnits}개`; this.el<HTMLInputElement>("imageHidden").value = String(s.model.hiddenUnits);
    this.el("imageEpoch").textContent = `${s.model.epoch}번`; this.el("imageAccuracy").textContent = `${(metrics.accuracy * 100).toFixed(0)}%`;
    this.el<HTMLInputElement>("imageRate").value = String(s.rate); this.el<HTMLOutputElement>("imageRateValue").value = s.rate.toFixed(2);
    this.el("imageAutoTrain").textContent = this.training ? "잠시 멈추기" : "계속 학습";
    drawImagePixels(this.el<HTMLCanvasElement>("imageFocus"), focus.pixels);
    this.el("imageFocusName").textContent = s.selectedSample === null ? "그래프의 점을 누르면 이곳에 그림과 예상이 나타납니다." : `고른 그림 · 정답 ${s.classes[focus.label]}`;
    if (s.selectedSample !== null) this.bars("imageTrainBars", result.probabilities);
    this.el("imageNetwork").innerHTML = pixelNetworkGraphMarkup(map ? projectedPixelModel(s.model,s.projection) : s.model, s.classes, s.selectedSample === null ? [] : result.hidden, s.selectedSample === null ? [] : result.probabilities, map ? [s.features.find(f=>f.id===s.xFeature)!.name,s.features.find(f=>f.id===s.yFeature)!.name] : undefined);
    drawLossChart(this.el<HTMLCanvasElement>("imageLoss"), s.history);
    drawPixelLatentMap(this.el<HTMLCanvasElement>("imageMap"), s.model, s.data, s.selectedSample === null ? [] : focus.pixels, s.projection, { view: map ? "decision" : "placement", showNeuronBoundaries: this.showLines, showDecisionBoundary: this.showBoundary, axisLegend: imageFeatureLegend(s.features, s.xFeature, s.yFeature), focusLabel: `정답 ${s.classes[focus.label]}` });
  }
  private clearDrawing(): void {
    const canvas = this.el<HTMLCanvasElement>("imageDraw"); const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (this.store.snapshot.task === "omr") { const cell = canvas.width / IMAGE_SIDE; ctx.strokeStyle = "#222"; ctx.lineWidth = 2; OMR_CENTERS.forEach((center) => ctx.strokeRect((center - 1) * cell + 1, 4 * cell, 2 * cell - 2, 7 * cell)); }
    this.canCapture = false;
    const capture = captureImage(canvas); this.store.setInput(capture.pixels, this.kind === "webcam" ? undefined : capture.image, this.kind);
  }
  private stopTraining(): void { if (this.training) clearTimeout(this.training); this.training = 0; }
  private stopCamera(): void {
    this.cameraToken++; if (this.frame) cancelAnimationFrame(this.frame); this.frame = 0;
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null;
    this.el<HTMLVideoElement>("imageVideo").srcObject = null; if (this.kind === "webcam") this.canCapture = false;
  }
  private async startCamera(): Promise<void> {
    this.stopCamera(); const token = this.cameraToken;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (token !== this.cameraToken || !this.active || ![2, 5].includes(this.step)) { stream.getTracks().forEach((track) => track.stop()); return; }
      this.stream = stream; const video = this.el<HTMLVideoElement>("imageVideo"); video.srcObject = stream; await video.play();
      let last = 0;
      const tick = (now: number) => {
        if (!this.stream || token !== this.cameraToken) return;
        if (video.readyState >= 2 && now - last > 180) { const input = captureImage(video, true); this.canCapture = true; this.store.setInput(input.pixels, input.image, "webcam"); last = now; }
        this.frame = requestAnimationFrame(tick);
      };
      this.frame = requestAnimationFrame(tick); this.render();
    } catch { if (token === this.cameraToken) { this.stopCamera(); this.render(); this.message("카메라를 열 수 없습니다. 브라우저 권한을 확인해 주세요."); } }
  }
  private bind(): void {
    const click = (id: string, action: () => void) => this.el(id).addEventListener("click", action);
    click("imageCameraStart", () => { void this.startCamera(); }); click("imageCameraStop", () => { this.stopCamera(); this.render(); }); click("imageClear", () => this.clearDrawing());
    click("imageCaptureAdd", () => {
      if (this.kind === "webcam" && !this.canCapture) return;
      if (this.kind === "webcam") { const input = captureImage(this.el<HTMLVideoElement>("imageVideo"), true); this.store.setInput(input.pixels, input.image, "webcam"); }
      const label=this.store.snapshot.selectedClass;
      this.store.addInput(); this.classPage=Math.floor(label/3);
      if(this.kind==='drawing')this.clearDrawing(); // Persist the snapshot before clearing the draft and its preview.
      this.render(); this.message(`${this.store.snapshot.classes[label]} 자료를 맨 앞에 추가했습니다.${this.kind==='drawing'?' 다음 그림을 그려 주세요.':''}`);
    });
    this.el('imageAddClass').addEventListener('change',()=>this.store.selectClass(Number(this.el<HTMLSelectElement>('imageAddClass').value)));
    this.el("imageInputSwitch").addEventListener("click", (event) => { const kind = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-input]")?.dataset.imageInput as CaptureKind | undefined; if (!kind || kind === this.kind) return; this.stopCamera(); this.kind = kind; this.canCapture = false; this.clearDrawing(); this.render(); });
    this.el<HTMLFormElement>("imageNewClass").addEventListener("submit", (event) => { event.preventDefault(); const input = this.el("imageNewClass").querySelector<HTMLInputElement>("input")!; const error = this.store.addClass(input.value); if (error) this.message(error); else { input.value = ""; this.classPage = Math.floor((this.store.snapshot.classes.length - 1) / 3); this.render(); } });
    this.el("imageClassList").addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const selected = target.closest<HTMLButtonElement>("[data-select-image-class]"); if (selected) this.store.selectClass(Number(selected.dataset.selectImageClass));
      const remove = target.closest<HTMLButtonElement>("[data-remove-image-class]"); if (remove) { const label = Number(remove.dataset.removeImageClass); const count = this.store.snapshot.data.filter((sample) => sample.label === label).length; if (count && !window.confirm(`이 클래스와 그림 ${count}장을 삭제할까요?`)) return; const error = this.store.removeClass(label); if (error) this.message(error); }
      const rename = target.closest<HTMLButtonElement>("[data-rename-image-class]"); if (rename) { const label = Number(rename.dataset.renameImageClass); const name = window.prompt("클래스 이름", this.store.snapshot.classes[label]); if (name !== null) { const error = this.store.renameClass(label, name); if (error) this.message(error); } }
    });
    this.roots.forEach((root) => root.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-sample]"); if (!button) return;
      const id = Number(button.dataset.imageSample); this.store.selectSample(id);
      if (this.step === 2) {
        const sample = this.store.snapshot.data.find((item) => item.id === id)!;
        this.stopCamera();
        // A webcam sample is inspected as captured; clicking it never changes the task to drawing.
        if (this.kind === "drawing") drawImagePixels(this.el<HTMLCanvasElement>("imageDraw"), sample.pixels);
        this.canCapture = this.kind === "drawing";
        this.store.setInput(sample.pixels, sample.image, sample.source === "webcam" ? "webcam" : "drawing");
        this.store.selectClass(sample.label);
        this.store.selectSample(id);
      }
    }));
    click("imageClassesPrev", () => { this.classPage--; this.render(); }); click("imageClassesNext", () => { this.classPage++; this.render(); });
    click("imageResultsPrev", () => { this.samplePage--; this.render(); }); click("imageResultsNext", () => { this.samplePage++; this.render(); });
    const canvas = this.el<HTMLCanvasElement>("imageDraw"); let drawing = false; let last: [number, number] | null = null;
    const point = (event: PointerEvent): [number, number] => { const box = canvas.getBoundingClientRect(); return [(event.clientX - box.left) / box.width * canvas.width, (event.clientY - box.top) / box.height * canvas.height]; };
    const paint = (event: PointerEvent) => { if (!drawing) return; const here = point(event); const ctx = canvas.getContext("2d")!; ctx.strokeStyle = "#000000"; ctx.lineWidth = this.store.snapshot.task === "omr" ? 28 : 24; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(...(last ?? here)); ctx.lineTo(here[0] + .01, here[1]); ctx.stroke(); last = here; this.canCapture = true; const input = captureImage(canvas); this.store.setInput(input.pixels, input.image, "drawing"); };
    canvas.addEventListener("pointerdown", (event) => { drawing = true; last = point(event); canvas.setPointerCapture(event.pointerId); paint(event); }); canvas.addEventListener("pointermove", paint);
    canvas.addEventListener("pointerup", () => { drawing = false; last = null; }); canvas.addEventListener("pointercancel", () => { drawing = false; last = null; });
    for (const [id, epochs] of [["imageTrainOne", 1], ["imageTrainTen", 10], ["imageTrainHundred", 100]] as const) click(id, () => { this.stopTraining(); const error = this.store.train(epochs); if (error) this.message(error); });
    click("imageAutoTrain", () => {
      if (this.training) { this.stopTraining(); this.render(); return; }
      const error = this.store.coverageError(); if (error) return this.message(error);
      let remaining = 500;
      const tick = () => { if (!this.active || this.step !== 4 || remaining <= 0) { this.stopTraining(); this.render(); return; } remaining -= 5; this.training = window.setTimeout(tick, 30); this.store.train(5); };
      tick();
    });
    this.el<HTMLInputElement>("imageHidden").addEventListener("input", (event) => { this.stopTraining(); this.store.setHiddenUnits(Number((event.target as HTMLInputElement).value)); });
    this.el<HTMLInputElement>("imageRate").addEventListener("input", (event) => this.store.setRate(Number((event.target as HTMLInputElement).value)));
    this.el<HTMLSelectElement>("imageMode").addEventListener("change", (event) => { this.stopTraining(); this.store.setMode((event.target as HTMLSelectElement).value as ImageMode); this.message("학습 방법을 바꾸어 모델을 처음부터 다시 만들었습니다."); });
    click("imageReset", () => { this.stopTraining(); this.store.resetModel(); });
    this.el<HTMLInputElement>("imageLines").addEventListener("change", (event) => { this.showLines = (event.target as HTMLInputElement).checked; this.render(); });
    this.el<HTMLInputElement>("imageBoundary").addEventListener("change", (event) => { this.showBoundary = (event.target as HTMLInputElement).checked; this.render(); });
    this.el<HTMLCanvasElement>("imageMap").addEventListener("click", (event) => { const s = this.store.snapshot; const index = pixelMapExampleAt(event.currentTarget as HTMLCanvasElement, event.clientX, event.clientY, s.projection, s.data); if (index !== null) { this.store.selectSample(s.data[index]!.id); revealModelPanel(this.roots.get(4)!); } });
    for (const id of ["imagePracticeX", "imagePracticeY"]) this.el(id).addEventListener("change", () => {
      this.stopTraining(); const error = this.store.setAxes(this.el<HTMLSelectElement>("imagePracticeX").value, this.el<HTMLSelectElement>("imagePracticeY").value);
      this.message(error ?? "새 특징으로 분포를 바꾸었습니다. 여기서 다시 학습해 보세요."); this.render();
    });
    click("imageRecordTest", () => {
      if (this.kind === "webcam" && this.stream) { const input = captureImage(this.el<HTMLVideoElement>("imageVideo"), true); this.stopCamera(); this.store.setInput(input.pixels, input.image, "webcam"); }
      const error = this.store.recordTest(Number(this.el<HTMLSelectElement>("imageTestLabel").value)); if (error) this.message(error);
    });
    click("imageExportSb3", () => { const s = this.store.snapshot; if (!s.model.epoch) return this.message("먼저 학습해 주세요."); downloadBlob("neural-lab-image.sb3", createPixelScratchProject(s.model, s.classes)); });
    click("imageExportExtension", () => { const s = this.store.snapshot; if (!s.model.epoch) return this.message("먼저 학습해 주세요."); downloadText("neural-lab-model.js", generateInferenceExtension(s.model, s.classes), "text/javascript"); });
    click("imageExportJson", () => { const s = this.store.snapshot; downloadText("neural-lab-image.json", JSON.stringify({ format: "neural-lab/image-v2", preprocessing: { side: IMAGE_SIDE, grayscale: "1-(.299R+.587G+.114B)/255", crop: "center-square", mirroredCamera: true }, mode: s.mode, classes: s.classes, model: s.model }, null, 2), "application/json"); });
    window.addEventListener("pagehide", () => { this.stopCamera(); this.stopTraining(); this.featureLesson.stop(); });
  }
}
