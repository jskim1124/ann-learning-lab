import { evaluatePixelModel, forwardPixels, initializePixelModel, trainPixelModel, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import { constrainPixelModelToProjection, type PixelProjection, type PixelProjectionMode } from "../core/pixelProjection";
import { IMAGE_INPUTS } from "../core/imageInput";
import { imageFeatures, selectedImageProjection, type ImageFeature } from "../core/imageFeatures";
import { createPixelDataset, PIXEL_TASKS, type PixelTaskName } from "../data/pixelDatasets";

export type ImageTask = PixelTaskName | "webcam" | "custom";
export type ImageMode = "pixels" | "map";
export interface ImageSample extends PixelExample { id: number; image?: string; source: "example" | "drawing" | "webcam"; }
export interface ImageState {
  task: ImageTask; classes: string[]; data: ImageSample[]; model: PixelModel; mode: ImageMode;
  projection: PixelProjection; feature: PixelProjectionMode; rate: number;
  features: ImageFeature[]; xFeature: string; yFeature: string;
  history: Array<{ epoch: number; loss: number; accuracy?: number }>; selectedClass: number; selectedSample: number | null;
  input: number[]; inputImage?: string; inputSource: "drawing" | "webcam";
  testCount: number; testCorrect: number; revision: number;
}

/** One source of truth for every image activity; map mode is an explicit, separate experiment. */
export class ImageLabStore {
  private state: ImageState;
  private listeners = new Set<() => void>();
  private nextId = 1;
  private testedInputs = new Set<string>();
  constructor(task: ImageTask = "digits") { this.state = this.fresh(task); }
  private fresh(task: ImageTask, classes?: string[]): ImageState {
    const builtin = task === "digits" || task === "omr";
    const names = classes ?? (builtin ? [...PIXEL_TASKS[task].classes] : task === "webcam" ? ["가위", "바위", "보"] : ["클래스 1", "클래스 2"]);
    const data: ImageSample[] = builtin ? createPixelDataset(task).map((example) => ({ ...example, id: this.nextId++, source: "example" })) : [];
    const features = imageFeatures(data), xFeature = task === "omr" ? "position" : builtin ? "ink" : "auto1", yFeature = task === "omr" ? "ink" : builtin ? "center" : "auto2";
    const projection = selectedImageProjection(data, features, xFeature, yFeature);
    const mode: ImageMode = task === "webcam" ? "pixels" : "map";
    let model = initializePixelModel(IMAGE_INPUTS, 1, names.length, 31);
    if (mode === "map") model = constrainPixelModelToProjection(model, projection);
    return { task, classes: names, data, model, mode, projection, feature: "learned", features, xFeature, yFeature, rate: .12,
      history: [{ epoch: 0, ...evaluatePixelModel(model, data) }], selectedClass: 0, selectedSample: null,
      input: Array<number>(IMAGE_INPUTS).fill(0), inputSource: task === "webcam" ? "webcam" : "drawing", testCount: 0, testCorrect: 0, revision: 0 };
  }
  get snapshot(): ImageState { return this.state; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { this.listeners.forEach((listener) => listener()); }
  configure(task: ImageTask, classes?: string[]): void { this.testedInputs.clear(); this.state = this.fresh(task, classes); this.emit(); }
  private reset(rebuildMap = false): void {
    this.testedInputs.clear();
    const s = this.state;
    const features = rebuildMap ? [...imageFeatures(s.data), ...s.features.filter(f => f.id.startsWith("custom-"))] : s.features;
    const projection = rebuildMap ? selectedImageProjection(s.data, features, s.xFeature, s.yFeature) : s.projection;
    let model = initializePixelModel(IMAGE_INPUTS, s.model.hiddenUnits, s.classes.length, 31, s.model.activation);
    if (s.mode === "map") model = constrainPixelModelToProjection(model, projection);
    this.state = { ...s, model, projection, features, selectedSample: null, history: [{ epoch: 0, ...evaluatePixelModel(model, s.data) }], testCount: 0, testCorrect: 0, revision: s.revision + 1 };
  }
  resetModel(): void { this.reset(); this.emit(); }
  setMode(mode: ImageMode): void { if (mode === this.state.mode) return; this.state = { ...this.state, mode }; this.reset(true); this.emit(); }
  setFeature(feature: PixelProjectionMode): void { this.state.feature = feature; this.setAxes(...(feature === "learned" ? ["auto1", "auto2"] : feature === "position" ? ["lr", "tb"] : ["ink", "center"]) as [string, string]); }
  setAxes(xFeature: string, yFeature: string): string | null {
    const s = this.state;
    if (!s.features.some(f => f.id === xFeature) || !s.features.some(f => f.id === yFeature)) return "특징을 선택해 주세요.";
    try { selectedImageProjection(s.data, s.features, xFeature, yFeature); } catch { return "두 축에는 서로 다른 정보를 세는 특징을 골라 주세요."; }
    if (s.xFeature === xFeature && s.yFeature === yFeature) return null;
    this.state = { ...s, xFeature, yFeature }; this.reset(true); this.emit(); return null;
  }
  addFeature(name: string, weights: number[]): string | null {
    const s = this.state;
    if (!name.trim() || s.features.some(f => f.name === name.trim())) return "겹치지 않는 특징 이름을 적어 주세요.";
    if (s.features.length >= 12) return "새 특징은 최대 5개까지 추가할 수 있습니다.";
    if (weights.length !== IMAGE_INPUTS || weights.some(w => ![-1, 0, 1].includes(w)) || weights.every(w => w === 0)) return "더하거나 뺄 칸을 한 칸 이상 골라 주세요.";
    s.features = [...s.features, { id: `custom-${s.features.length}`, name: name.trim(), description: "주황 칸은 더하고 보라 칸은 뺍니다. 빈 칸은 세지 않습니다.", weights: [...weights] }]; this.emit(); return null;
  }
  setHiddenUnits(value: number): void { this.state.model = { ...this.state.model, hiddenUnits: Math.max(1, Math.min(16, Math.round(value))) }; this.reset(); this.emit(); }
  setRate(rate: number): void { this.state.rate = Math.max(.01, Math.min(.3, rate)); this.emit(); }
  selectClass(label: number): void { if (this.state.classes[label] !== undefined) { this.state.selectedClass = label; this.emit(); } }
  renameClass(label: number, name: string): string | null {
    const value = name.trim(); if (!value) return "클래스 이름을 입력해 주세요.";
    if (this.state.classes.some((item, i) => i !== label && item.toLocaleLowerCase() === value.toLocaleLowerCase())) return "이미 있는 클래스 이름입니다.";
    this.state.classes[label] = value; this.emit(); return null;
  }
  addClass(name: string): string | null {
    if (this.state.classes.length >= 10) return "클래스는 최대 10개입니다.";
    const value = name.trim(); if (!value || this.state.classes.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) return "겹치지 않는 클래스 이름을 입력해 주세요.";
    this.state.classes = [...this.state.classes, value]; this.state.selectedClass = this.state.classes.length - 1; this.reset(true); this.emit(); return null;
  }
  removeClass(label: number): string | null {
    if (this.state.classes.length <= 2) return "클래스는 두 개 이상 필요합니다.";
    if (this.state.classes[label] === undefined) return "클래스를 찾을 수 없습니다.";
    this.state.classes = this.state.classes.filter((_, i) => i !== label);
    this.state.data = this.state.data.filter((sample) => sample.label !== label).map((sample) => ({ ...sample, label: sample.label > label ? sample.label - 1 : sample.label }));
    this.state.selectedClass = Math.max(0, Math.min(this.state.selectedClass > label ? this.state.selectedClass - 1 : this.state.selectedClass, this.state.classes.length - 1));
    this.reset(true); this.emit(); return null;
  }
  setInput(pixels: number[], image?: string, source: "drawing" | "webcam" = this.state.inputSource): void {
    if (pixels.length !== IMAGE_INPUTS || pixels.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error("그림은 0~1 사이의 밝기 196개여야 합니다.");
    this.state = { ...this.state, input: [...pixels], inputImage: image, inputSource: source, selectedSample: null }; this.emit();
  }
  addInput(): void {
    const s = this.state;
    this.state.data = [{ id: this.nextId++, label: s.selectedClass, pixels: [...s.input], image: s.inputImage, source: s.inputSource }, ...s.data];
    this.reset(true); this.emit();
  }
  removeSample(id: number): void { this.state.data = this.state.data.filter((sample) => sample.id !== id); this.reset(true); this.emit(); }
  selectSample(id: number | null): void { this.state.selectedSample = id; this.emit(); }
  focus(): PixelExample { return this.state.data.find((sample) => sample.id === this.state.selectedSample) ?? { pixels: this.state.input, label: this.state.selectedClass }; }
  coverageError(): string | null {
    const missing = this.state.classes.filter((_, label) => this.state.data.filter((sample) => sample.label === label).length < 2);
    return missing.length ? `${missing.join(" · ")}: 자료를 2장 이상 모아 주세요.` : null;
  }
  train(epochs: number): string | null {
    const error = this.coverageError(); if (error) return error;
    this.testedInputs.clear();
    const s = this.state; let model = s.model;
    if (s.mode === "pixels") model = trainPixelModel(model, s.data, epochs, s.rate);
    else for (let i = 0; i < epochs; i++) model = constrainPixelModelToProjection(trainPixelModel(model, s.data, 1, s.rate), s.projection);
    this.state = { ...s, model, history: [...s.history, { epoch: model.epoch, ...evaluatePixelModel(model, s.data) }].slice(-240), testCount: 0, testCorrect: 0 };
    this.emit(); return null;
  }
  predict(pixels = this.focus().pixels) { return forwardPixels(this.state.model, pixels); }
  metrics() { return evaluatePixelModel(this.state.model, this.state.data); }
  recordTest(label: number): string | null {
    if (!this.state.model.epoch) return "먼저 학습해 주세요.";
    if (this.state.classes[label] === undefined) return "정답 클래스를 골라 주세요.";
    if (this.state.data.some((sample) => sample.pixels.every((value, i) => Math.abs(value - this.state.input[i]!) < 1e-9))) return "학습에 넣지 않은 새 그림으로 시험해 주세요.";
    const key = this.state.input.map((value) => value.toFixed(5)).join(",");
    if (this.testedInputs.has(key)) return "이미 기록한 그림입니다. 다른 새 그림으로 시험해 주세요.";
    this.testedInputs.add(key);
    const values = this.predict(this.state.input).probabilities; const correct = values.indexOf(Math.max(...values)) === label;
    this.state.testCount++; this.state.testCorrect += Number(correct); this.emit(); return null;
  }
}
