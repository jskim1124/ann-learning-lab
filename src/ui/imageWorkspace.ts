import { captureImage, drawImagePixels, IMAGE_INPUTS, IMAGE_SIDE } from "../core/imageInput";
import { forwardPixels, initializePixelModel, trainPixelModel, type PixelModel } from "../core/pixelNetwork";
import { pixelAxisLegend } from "../core/pixelProjection";
import { OMR_CENTERS } from "../data/pixelDatasets";
import { downloadBlob, downloadText } from "../export/modelJson";
import { createPixelScratchProject } from "../export/pixelScratchProject";
import { ImageLabStore, type ImageTask, type ImageMode } from "../state/imageLabStore";
import { drawPixelLatentMap, pixelMapExampleAt } from "../visualization/pixelLatentMap";
import { pixelNetworkGraphMarkup } from "../visualization/pixelNetworkGraph";
import { drawLossChart } from "../visualization/lossChart";
import "./imageWorkspace.css";

const COLORS = ["#f17605", "#df466f", "#7446f5", "#1769d2", "#1558b7", "#a93658"];
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const signed = (value: number) => `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(3)}`;
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
  private lessonFrame = 0;
  private classPage = 0;
  private samplePage = 0;
  private lesson = 1;
  private lessonRevealed = false;
  private inspectedPixel = 0;
  private lessonAfter: PixelModel | null = null;
  private lessonInitial: PixelModel | null = null;
  private canCapture = false;
  private collectionSignature = "";
  private showLines = true;
  private showBoundary = true;

  constructor(private message: (text: string) => void, private go: (step: 1 | 2 | 3 | 4 | 5) => void, private changeInput: (kind: "numbers" | "text") => void) {
    const pages: Record<number, string> = {
      2: `<div class="image-collection"><section class="image-panel image-classes"><div class="image-heading"><h2>클래스별 자료</h2><span id="imageTotal"></span></div><div id="imageClassList"></div><form id="imageNewClass"><input name="name" aria-label="새 이미지 클래스 이름" maxlength="18" placeholder="새 클래스 이름"><button type="submit">+ 추가</button></form><div class="image-pager"><button id="imageClassesPrev" aria-label="이전 클래스">←</button><span id="imageClassPage"></span><button id="imageClassesNext" aria-label="다음 클래스">→</button></div></section><section class="image-panel image-capture-slot" id="imageCollectSlot"></section></div>`,
      3: `<div class="image-understanding"><section class="image-panel image-lesson-visual"><div class="image-heading"><h2 id="imageLessonVisualTitle">그림 한 장</h2><span id="imageLessonValue"></span></div><canvas id="imageLessonCanvas" width="420" height="420" aria-label="한 칸을 눌러 실제 입력값 확인"></canvas><svg id="imageLessonNetwork" viewBox="0 0 330 300" role="img" aria-label="그림의 실제 연결값과 출력" hidden></svg><div id="imageLessonBars"></div></section><section class="image-panel image-lesson-copy"><nav aria-label="그림 이해 순서" class="image-lesson-tabs">${["그림", "계산", "예상", "학습"].map((label, i) => `<button data-image-lesson="${i + 1}">${i + 1} ${label}</button>`).join("")}</nav><h2 id="imageLessonTitle"></h2><p id="imageLessonText"></p><div id="imageLessonCalculation" class="image-calculation"></div><button id="imageLessonAction" class="button primary"></button><div id="imageLessonQuiz" class="image-quiz" hidden><strong id="imageLessonQuestion"></strong><div id="imageLessonAnswers"></div><p id="imageLessonFeedback" role="status"></p></div><button id="imageLessonNext" class="button secondary">다음 →</button></section></div>`,
      4: `<div class="image-train"><section class="image-panel image-results-panel"><div class="image-heading"><h2 id="imageResultTitle">그림마다 예상 확인하기</h2><span id="imageModelTag">그림 전체 학습</span></div><div id="imageResultGrid" class="image-result-grid"></div><canvas id="imageMap" width="720" height="460" hidden aria-label="두 그림 기준에 제한한 실험의 실제 분류선과 최종 경계"></canvas><div id="imageMapControls" class="image-map-controls" hidden><label><input id="imageLines" type="checkbox" checked> 모든 뉴런 선</label><label><input id="imageBoundary" type="checkbox" checked> 최종 경계</label><span>화살표: 뉴런 값이 커지는 쪽</span></div><div class="image-pager" id="imageResultPager"><button id="imageResultsPrev" aria-label="이전 그림">←</button><span id="imageResultPage"></span><button id="imageResultsNext" aria-label="다음 그림">→</button></div><div class="image-trainer" title="학습 1번은 모은 모든 그림을 한 바퀴 보는 것입니다."><button id="imageTrainOne">1번</button><button id="imageTrainTen">10번</button><button id="imageTrainHundred">100번</button><button id="imageAutoTrain" class="button primary">계속 학습</button></div><div class="image-loss"><span>틀린 정도</span><canvas id="imageLoss" width="650" height="75" aria-label="학습 중 틀린 정도 변화"></canvas></div></section><aside class="image-panel image-model-panel"><label class="image-hidden">은닉 뉴런 <output id="imageHiddenValue"></output><input id="imageHidden" type="range" min="1" max="16" value="8"></label><div class="image-metrics"><div><span>학습 횟수</span><b id="imageEpoch">0</b></div><div><span>학습 정답률</span><b id="imageAccuracy">—</b></div></div><div class="image-focus"><canvas id="imageFocus" width="84" height="84"></canvas><span id="imageFocusName"></span></div><div id="imageTrainBars"></div><details class="image-detail"><summary>연결 지도</summary><svg id="imageNetwork" viewBox="0 0 330 300" role="img" aria-label="선택한 그림의 은닉 뉴런 값과 예상"></svg></details><details class="image-detail"><summary>학습 설정 · 지도 실험</summary><label>한 번에 고치는 크기 <input id="imageRate" type="range" min=".01" max=".3" step=".01" value=".12"><output id="imageRateValue"></output></label><label>학습 방법<select id="imageMode"><option value="pixels">그림 전체 — 기본</option><option value="map">두 기준 지도 — 원리 실험</option></select></label><label id="imageFeatureLabel" hidden>지도 기준<select id="imageFeature"><option value="learned">그림끼리 많이 다른 두 방향</option><option value="position">좌우·위아래 진하기 차이</option><option value="ink">총 진하기·가장자리 차이</option></select></label><p id="imageModeNote">196칸의 연결값을 모두 학습합니다.</p><button id="imageReset" class="button secondary">처음부터 다시 학습</button></details></aside></div>`,
      5: `<div class="image-use"><section id="imageTestSlot" class="image-panel image-capture-slot"></section><section class="image-panel image-test-result"><h2>새 그림의 예상</h2><p id="imagePredictionTitle"></p><div id="imageUseBars"></div><div class="image-test-check"><label>실제 정답<select id="imageTestLabel"></select></label><button id="imageRecordTest" class="button secondary">이 결과 기록</button><p id="imageTestScore">학습에 넣지 않은 그림으로 시험해 보세요.</p></div><details class="image-detail"><summary>모델 가져가기</summary><p>Scratch에서 ‘그림 밝기’ 목록의 196칸으로 예측합니다.</p><button id="imageExportSb3" class="button secondary">Scratch 블록 .sb3</button><button id="imageExportJson" class="button secondary">모델 보관 .json</button></details></section></div>`,
    };
    Object.entries(pages).forEach(([step, html]) => {
      const root = document.createElement("div"); root.className = "image-workspace"; root.hidden = true; root.innerHTML = html;
      const labels: Record<string, string[]> = { 2: ["클래스·자료", "그림 수집"], 3: ["그림·계산 보기", "설명·퀴즈"], 4: ["학습하기", "모델 살펴보기"], 5: ["새 그림", "예상 결과"] };
      const compactTabs = document.createElement("nav"); compactTabs.className = "image-compact-tabs"; compactTabs.setAttribute("aria-label", "작은 화면 작업면");
      compactTabs.innerHTML = labels[step]!.map((label, i) => `<button data-image-panel="${i}" aria-pressed="${i === 0}">${label}</button>`).join("");
      const panels = [...root.firstElementChild!.children]; panels[0]!.classList.add("compact-selected");
      compactTabs.addEventListener("click", (event) => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-image-panel]"); if (!button) return; const index = Number(button.dataset.imagePanel); panels.forEach((panel,i) => panel.classList.toggle("compact-selected",i === index)); compactTabs.querySelectorAll("button").forEach((tab,i) => tab.setAttribute("aria-pressed",String(i === index))); this.render(); });
      root.prepend(compactTabs);
      document.querySelector(`[data-app-page="${step}"] .page-nav`)!.before(root); this.roots.set(Number(step), root);
    });
    this.capture = document.createElement("div"); this.capture.className = "image-capture";
    this.capture.innerHTML = `<div class="image-heading"><h2 id="imageCaptureTitle">그림을 모아 보세요</h2><span id="imageCaptureClass"></span></div><div class="image-input-switch" id="imageInputSwitch"><button data-image-input="drawing">그리기</button><button data-image-input="webcam">웹캠</button></div><div class="image-capture-pair"><figure><div class="image-source"><canvas id="imageDraw" width="420" height="420" aria-label="자유롭게 그림 그리기"></canvas><video id="imageVideo" autoplay playsinline muted hidden aria-label="중앙을 정사각형으로 자른 웹캠"></video><span id="imageCameraEmpty" hidden>카메라를 켜고 손을 보여 주세요</span></div><figcaption id="imageSourceCaption">직접 그린 그림</figcaption></figure><span class="image-convert-arrow" aria-hidden="true">→</span><figure class="image-processed"><canvas id="imageInputPreview" width="224" height="224" aria-label="모델에 실제 입력하는 14×14 흑백 그림"></canvas><figcaption>모델이 받는 14×14칸</figcaption></figure></div><div class="image-capture-buttons"><button id="imageCameraStart" class="button secondary" hidden>카메라 켜기</button><button id="imageCameraStop" class="button secondary" hidden>카메라 끄기</button><button id="imageClear" class="button secondary">지우기</button><button id="imageCaptureAdd" class="button primary">이 그림 추가</button></div><p id="imageCaptureHint">한 칸의 진하기를 0~1로 바꾸어 입력합니다.</p><p id="imagePrivacy" hidden>영상은 이 브라우저에서만 처리됩니다. 배경도 그림에 포함됩니다.</p>`;
    document.querySelector("#imageCollectSlot")!.append(this.capture);
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
    this.stopCamera(); this.stopTraining(); this.cancelLesson(); this.kind = kind; this.classPage = 0; this.samplePage = 0; this.collectionSignature = ""; this.lesson = 1; this.lessonRevealed = false;
    this.store.configure(task, classes); this.clearDrawing();
    const first = this.store.snapshot.data[0]?.pixels;
    this.inspectedPixel = first?.findIndex((value) => value > .5) ?? 0;
    if (this.inspectedPixel < 0) this.inspectedPixel = 0;
  }
  show(active: boolean, step: number): void {
    if (active && step === 3 && step !== this.step) {
      this.lessonInitial = initializePixelModel(IMAGE_INPUTS, this.store.snapshot.model.hiddenUnits, this.store.snapshot.classes.length, 31);
      this.lessonAfter = null; this.lessonRevealed = false;
      const pixels = this.lessonInput(), weights = this.lessonInitial.inputHidden[0]!;
      this.inspectedPixel = pixels.reduce((best, v, i) => Math.abs(v * weights[i]!) > Math.abs(pixels[best]! * weights[best]!) ? i : best, 0);
    }
    if (active && step === 4 && step !== this.step && this.store.snapshot.selectedSample === null) this.store.selectSample(this.store.snapshot.data[0]?.id ?? null);
    if ((!active || step !== this.step) && this.active) { this.stopCamera(); this.stopTraining(); this.cancelLesson(); }
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
    if (this.step === 3) this.renderLesson();
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
    this.el("imageCaptureHint").textContent = camera ? "손의 모양·거리·배경을 바꾸어 모아 보세요. 클래스마다 20장 이상을 권장합니다." : s.task === "omr" ? "칸을 벗어나도 괜찮습니다. 연필처럼 직접 칠해 보세요." : "같은 숫자도 크기와 모양을 조금씩 바꾸어 그려 보세요.";
    drawImagePixels(this.el<HTMLCanvasElement>("imageInputPreview"), s.input, true);
  }
  private renderTraining(): void {
    const s = this.store.snapshot; const map = s.mode === "map"; const metrics = this.store.metrics(); const focus = this.store.focus(); const result = this.store.predict();
    this.el("imageResultGrid").hidden = map; this.el("imageMap").hidden = !map; this.el("imageMapControls").hidden = !map; this.el("imageResultPager").hidden = map;
    this.el("imageResultTitle").textContent = map ? "두 기준 지도에서 선 살펴보기" : "그림을 눌러 예상 확인하기";
    this.el("imageModelTag").textContent = map ? "두 방향으로 제한한 별도 실험" : "그림 전체 학습";
    this.el<HTMLSelectElement>("imageMode").value = s.mode; this.el<HTMLSelectElement>("imageFeature").value = s.feature; this.el("imageFeatureLabel").hidden = !map;
    this.el("imageModeNote").textContent = map ? "이 실험은 선택한 두 방향만 사용합니다. 색선은 뉴런의 합이 0인 곳, 검은 선은 최종 예상이 바뀌는 곳입니다. 배경색은 예상입니다. 점의 색은 정답이므로 배경색과 다르면 오답입니다." : "196칸의 연결값을 모두 학습합니다. 학습 방법이나 뉴런 수를 바꾸면 처음부터 다시 시작합니다.";
    if (map) drawPixelLatentMap(this.el<HTMLCanvasElement>("imageMap"), s.model, s.data, s.selectedSample === null ? [] : focus.pixels, s.projection, { showNeuronBoundaries: this.showLines, showDecisionBoundary: this.showBoundary, axisLegend: pixelAxisLegend(s.task === "omr" ? "omr" : "digits", s.feature), focusLabel: `정답 ${s.classes[focus.label]}` });
    else {
      const count = Math.max(1, Math.ceil(s.data.length / 8)); this.samplePage = Math.min(this.samplePage, count - 1);
      const groups = s.classes.map((_, label) => s.data.filter((sample) => sample.label === label));
      const ordered = Array.from({length: Math.max(0, ...groups.map((group) => group.length))}, (_, index) => groups.flatMap((group) => group[index] ? [group[index]!] : [])).flat();
      this.el("imageResultGrid").innerHTML = ordered.slice(this.samplePage * 8, this.samplePage * 8 + 8).map((sample) => {
        const p = this.store.predict(sample.pixels).probabilities; const best = p.indexOf(Math.max(...p));
        return `<button data-image-sample="${sample.id}" class="image-result ${sample.id === s.selectedSample ? "selected" : ""}"><canvas data-result="${sample.id}" width="112" height="112"></canvas><span>정답 ${escape(s.classes[sample.label]!)}</span><b class="${best === sample.label ? "" : "image-wrong"}">예상 ${escape(s.classes[best]!)} · ${(p[best]! * 100).toFixed(0)}%</b></button>`;
      }).join("");
      this.el("imageResultGrid").querySelectorAll<HTMLCanvasElement>("[data-result]").forEach((canvas) => drawImagePixels(canvas, s.data.find((sample) => sample.id === Number(canvas.dataset.result))!.pixels));
      this.el("imageResultPage").textContent = `${this.samplePage + 1} / ${count}`; this.el<HTMLButtonElement>("imageResultsPrev").disabled = this.samplePage === 0; this.el<HTMLButtonElement>("imageResultsNext").disabled = this.samplePage >= count - 1;
    }
    this.el<HTMLOutputElement>("imageHiddenValue").value = `${s.model.hiddenUnits}개`; this.el<HTMLInputElement>("imageHidden").value = String(s.model.hiddenUnits);
    this.el("imageEpoch").textContent = `${s.model.epoch}번`; this.el("imageAccuracy").textContent = `${(metrics.accuracy * 100).toFixed(0)}%`;
    this.el<HTMLInputElement>("imageRate").value = String(s.rate); this.el<HTMLOutputElement>("imageRateValue").value = s.rate.toFixed(2);
    this.el("imageAutoTrain").textContent = this.training ? "잠시 멈추기" : "계속 학습";
    drawImagePixels(this.el<HTMLCanvasElement>("imageFocus"), focus.pixels);
    this.el("imageFocusName").textContent = s.selectedSample === null ? "지금 넣은 그림" : `고른 그림 · 정답 ${s.classes[focus.label]}`;
    this.bars("imageTrainBars", result.probabilities);
    this.el("imageNetwork").innerHTML = pixelNetworkGraphMarkup(s.model, s.classes, result.hidden, result.probabilities);
    drawLossChart(this.el<HTMLCanvasElement>("imageLoss"), s.history);
  }
  private lessonInput(): number[] { return this.store.snapshot.data[0]?.pixels ?? this.store.snapshot.input; }
  private renderLesson(): void {
    const s = this.store.snapshot; const pixels = this.lessonInput(); const index = Math.min(this.inspectedPixel, pixels.length - 1); const initial = this.lessonInitial ?? s.model; const weights = initial.inputHidden[0]!; const contribution = pixels[index]! * weights[index]!;
    const sum = weights.reduce((total, weight, i) => total + weight * pixels[i]!, initial.hiddenBias[0]!);
    const modified = [...pixels]; modified[index] = pixels[index]! > .5 ? 0 : 1;
    const changedSum = sum + (modified[index]! - pixels[index]!) * weights[index]!;
    const after = this.lessonAfter ?? initial; const p = forwardPixels(this.lesson === 4 ? after : initial, pixels);
    const canvas = this.el<HTMLCanvasElement>("imageLessonCanvas"); const graph = this.el("imageLessonNetwork"); canvas.hidden = this.lesson === 3; graph.hidden = this.lesson !== 3;
    drawImagePixels(canvas, this.lesson === 2 && this.lessonRevealed ? modified : pixels, true, this.lesson < 3 ? index : -1);
    graph.innerHTML = pixelNetworkGraphMarkup(initial, s.classes, p.hidden, p.probabilities);
    this.el("imageLessonValue").textContent = this.lesson < 3 ? `${Math.floor(index / IMAGE_SIDE) + 1}행 ${index % IMAGE_SIDE + 1}열 · 진하기 ${pixels[index]!.toFixed(2)}${this.lesson === 2 && this.lessonRevealed ? ` → ${modified[index]!.toFixed(2)}` : ""}` : "같은 그림의 실제 계산";
    this.roots.get(3)!.querySelectorAll<HTMLButtonElement>("[data-image-lesson]").forEach((button) => { button.classList.toggle("active", Number(button.dataset.imageLesson) === this.lesson); button.setAttribute("aria-pressed", String(Number(button.dataset.imageLesson) === this.lesson)); });
    const titles = ["그림을 작은 칸으로 읽어요", "한 칸을 바꾸면 값도 바뀌어요", "여러 뉴런의 값을 모아 예상해요", "정답과 비교하며 연결값을 고쳐요"];
    const texts = ["왼쪽 그림에서 칸 하나를 눌러 보세요. 검정은 1, 흰색은 0입니다. 회색도 그대로 입력됩니다.", "은닉 뉴런 하나는 각 칸의 진하기에 연결값을 곱해 더합니다. 다른 칸은 그대로 두고, 고른 칸만 바꿔 봅시다.", "은닉 뉴런의 값을 각 클래스의 점수로 합칩니다. 가장 큰 막대가 모델의 선택입니다. 높은 점수도 정답을 보장하지는 않습니다.", "왼쪽 한 장을 반복해서 학습해 봅시다. 여러 연결값을 함께 고쳐 정답의 점수가 어떻게 달라지는지 확인합니다."];
    this.el("imageLessonTitle").textContent = titles[this.lesson - 1]!; this.el("imageLessonVisualTitle").textContent = this.lesson === 3 ? "연결 지도" : "같은 그림 한 장"; this.el("imageLessonText").textContent = texts[this.lesson - 1]!;
    const first = s.data[0]; const correct = first?.label ?? 0; const beforeP = forwardPixels(initial, pixels).probabilities[correct]!;
    this.el("imageLessonCalculation").innerHTML = this.lesson === 1 ? `<b>14 × 14 = 196개</b><span>이 모델은 사진도 숫자도 같은 크기의 흑백 그림으로 읽습니다.</span>` : this.lesson === 2 ? `<span>고른 칸: ${pixels[index]!.toFixed(2)} × ${signed(weights[index]!)} = ${signed(contribution)}${this.lessonRevealed ? `<br>바꾼 칸: ${modified[index]!.toFixed(2)} × ${signed(weights[index]!)} = ${signed(modified[index]! * weights[index]!)}` : ""}</span><b>뉴런 1의 합: ${signed(sum)}${this.lessonRevealed ? ` → ${signed(changedSum)}` : ""}</b><span>다른 195칸과 시작값은 그대로입니다.</span><span>합을 −1~1 사이로 바꾼 뉴런 값: ${Math.tanh(sum).toFixed(3)}${this.lessonRevealed ? ` → ${Math.tanh(changedSum).toFixed(3)}` : ""}</span>` : this.lesson === 3 ? `<b>예상: ${escape(s.classes[p.probabilities.indexOf(Math.max(...p.probabilities))]!)}</b><span>막대의 합은 100%입니다.</span>` : `<span>정답: ${escape(s.classes[correct]!)}</span><b>정답 점수 ${(beforeP * 100).toFixed(1)}% → ${(p.probabilities[correct]! * 100).toFixed(1)}%</b><span>한 장을 맞혀도 새 그림을 모두 맞히는 것은 아닙니다.</span>`;
    const action = this.el<HTMLButtonElement>("imageLessonAction"); action.textContent = ["고른 칸 확인", "고른 칸만 바꾸기", "예상 막대 보기", "이 그림으로 30번 학습"][this.lesson - 1]!; action.disabled = this.lessonRevealed;
    this.el("imageLessonBars").hidden = !this.lessonRevealed || this.lesson < 3; if (this.lessonRevealed && this.lesson >= 3) this.bars("imageLessonBars", p.probabilities);
    this.el("imageLessonQuiz").hidden = !this.lessonRevealed;
    const questions = ["사진을 다른 이름으로 부르면 입력값이 바뀔까요?", "한 칸만 바꿔도 뉴런의 합이 바뀔까요?", "가장 큰 막대는 항상 정답일까요?", "지금 그림 한 장을 잘 맞히면 처음 보는 그림도 반드시 맞힐까요?"];
    this.el("imageLessonQuestion").textContent = questions[this.lesson - 1]!;
    this.el("imageLessonAnswers").innerHTML = '<button data-image-answer="yes">그렇다</button><button data-image-answer="no">아니다</button>';
    this.el("imageLessonNext").textContent = this.lesson === 4 ? "내 모델 학습하기 →" : "다음 →";
  }
  private setLesson(step: number): void { this.cancelLesson(); this.lesson = step; this.lessonRevealed = false; this.lessonAfter = null; this.el("imageLessonFeedback").textContent = ""; this.render(); }
  private cancelLesson(): void { if (this.lessonFrame) cancelAnimationFrame(this.lessonFrame); this.lessonFrame = 0; }
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
      this.store.addInput(); this.message(`${this.store.snapshot.classes[this.store.snapshot.selectedClass]} 자료를 맨 앞에 추가했습니다.`);
    });
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
    const paint = (event: PointerEvent) => { if (!drawing) return; const here = point(event); const ctx = canvas.getContext("2d")!; ctx.strokeStyle = "#151515"; ctx.lineWidth = this.store.snapshot.task === "omr" ? 17 : 13; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.beginPath(); ctx.moveTo(...(last ?? here)); ctx.lineTo(here[0] + .01, here[1]); ctx.stroke(); last = here; this.canCapture = true; const input = captureImage(canvas); this.store.setInput(input.pixels, input.image, "drawing"); };
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
    this.el<HTMLSelectElement>("imageFeature").addEventListener("change", (event) => { this.stopTraining(); this.store.setFeature((event.target as HTMLSelectElement).value as "learned" | "position" | "ink"); });
    click("imageReset", () => { this.stopTraining(); this.store.resetModel(); });
    this.el<HTMLInputElement>("imageLines").addEventListener("change", (event) => { this.showLines = (event.target as HTMLInputElement).checked; this.render(); });
    this.el<HTMLInputElement>("imageBoundary").addEventListener("change", (event) => { this.showBoundary = (event.target as HTMLInputElement).checked; this.render(); });
    this.el<HTMLCanvasElement>("imageMap").addEventListener("click", (event) => { const s = this.store.snapshot; const index = pixelMapExampleAt(event.currentTarget as HTMLCanvasElement, event.clientX, event.clientY, s.projection, s.data); if (index !== null) this.store.selectSample(s.data[index]!.id); });
    this.roots.get(3)!.addEventListener("click", (event) => { const target = event.target as HTMLElement; const step = target.closest<HTMLButtonElement>("[data-image-lesson]"); if (step) this.setLesson(Number(step.dataset.imageLesson)); const answer = target.closest<HTMLButtonElement>("[data-image-answer]"); if (answer) this.el("imageLessonFeedback").textContent = (answer.dataset.imageAnswer === "yes") === (this.lesson === 2) ? "맞아요. 방금 본 계산과 연결됩니다." : "앞의 계산과 그림을 다시 확인해 보세요."; });
    this.el<HTMLCanvasElement>("imageLessonCanvas").addEventListener("click", (event) => { if (this.lesson > 2) return; const box = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect(); this.inspectedPixel = Math.max(0, Math.min(195, Math.floor((event.clientY - box.top) / box.height * 14) * 14 + Math.floor((event.clientX - box.left) / box.width * 14))); this.lessonRevealed = false; this.render(); });
    click("imageLessonAction", () => {
      this.lessonRevealed = true;
      if (this.lesson !== 4) { this.render(); return; }
      const s = this.store.snapshot; const example = s.data[0]; if (!example) return; let after = this.lessonInitial ?? s.model; let count = 0;
      let last = 0;
      const tick = (now: number) => {
        if (!this.active || this.step !== 3) return;
        if (now - last >= 120 || count === 0) { after = trainPixelModel(after, [example], 1, s.rate); this.lessonAfter = after; this.renderLesson(); count++; last = now; }
        this.lessonFrame = count < 30 ? requestAnimationFrame(tick) : 0;
      }; this.lessonFrame = requestAnimationFrame(tick);
    });
    click("imageLessonNext", () => { if (this.lesson === 4) this.go(4); else this.setLesson(this.lesson + 1); });
    click("imageRecordTest", () => {
      if (this.kind === "webcam" && this.stream) { const input = captureImage(this.el<HTMLVideoElement>("imageVideo"), true); this.stopCamera(); this.store.setInput(input.pixels, input.image, "webcam"); }
      const error = this.store.recordTest(Number(this.el<HTMLSelectElement>("imageTestLabel").value)); if (error) this.message(error);
    });
    click("imageExportSb3", () => { const s = this.store.snapshot; downloadBlob("neural-lab-image.sb3", createPixelScratchProject(s.model, s.classes, s.input)); });
    click("imageExportJson", () => { const s = this.store.snapshot; downloadText("neural-lab-image.json", JSON.stringify({ format: "neural-lab/image-v2", preprocessing: { side: IMAGE_SIDE, grayscale: "1-(.299R+.587G+.114B)/255", crop: "center-square", mirroredCamera: true }, mode: s.mode, classes: s.classes, model: s.model }, null, 2), "application/json"); });
    window.addEventListener("pagehide", () => { this.stopCamera(); this.stopTraining(); this.cancelLesson(); });
  }
}
