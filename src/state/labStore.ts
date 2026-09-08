import { createStoredModel } from "../core/modelSchema";
import { initializeNetwork } from "../core/initialization";
import { evaluate, train } from "../core/neuralNetwork";
import { addPoint, clampInput, undoPoint, validateTrainingData } from "../data/dataset";
import { clonePreset, PRESETS } from "../data/presets";
import type {
  ActivationName,
  DataPoint,
  ExperimentRecord,
  HistoryPoint,
  Label,
  NetworkModel,
  PresetName,
  StoredModelV2,
} from "../types";

export interface LabState {
  preset: PresetName;
  data: DataPoint[];
  pointClass: Label;
  model: NetworkModel;
  history: HistoryPoint[];
  experiments: ExperimentRecord[];
  testInput: { x: number; y: number };
  view: "decision" | "neurons";
  autoTraining: boolean;
  epochGoal: number;
  explanationStep: 1 | 2 | 3 | 4;
  selectedNeuron: number;
  quizIndex: number;
  quizAnswer: string | null;
  highlightRevealed: boolean;
  mediaSampleIndex: number;
  mediaHighlight: boolean;
  lessonStep: 1 | 2 | 3 | 4 | 5;
  furthestLessonStep: 1 | 2 | 3 | 4 | 5;
  furthestExplanationStep: 1 | 2 | 3 | 4;
}

type Listener = (state: LabState) => void;
const SETTINGS_KEY = "neural-lab/settings-v2";
const EXPERIMENTS_KEY = "neural-lab/experiments-v2";
const DEFAULT_SEED = 19;

function safeExperiments(): ExperimentRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPERIMENTS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as ExperimentRecord[]) : [];
  } catch { return []; }
}

function safeSettings(): { preset: PresetName; hiddenUnits: number; activation: ActivationName; learningRate: number } {
  const fallback = { preset: "sound" as const, hiddenUnits: 2, activation: "tanh" as const, learningRate: 0.08 };
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<typeof fallback> | null;
    if (!parsed) return fallback;
    return {
      preset: ["sound", "sketch", "digits", "custom"].includes(parsed.preset ?? "") ? parsed.preset as PresetName : fallback.preset,
      hiddenUnits: Number.isInteger(parsed.hiddenUnits) && (parsed.hiddenUnits ?? 0) >= 1 && (parsed.hiddenUnits ?? 0) <= 6 ? parsed.hiddenUnits as number : fallback.hiddenUnits,
      activation: ["tanh", "relu", "sigmoid"].includes(parsed.activation ?? "") ? parsed.activation as ActivationName : fallback.activation,
      learningRate: typeof parsed.learningRate === "number" && parsed.learningRate >= 0.01 && parsed.learningRate <= 0.3 ? parsed.learningRate : fallback.learningRate,
    };
  } catch { return fallback; }
}

function initialState(): LabState {
  const settings = safeSettings();
  const config = { hiddenUnits: settings.hiddenUnits, activation: settings.activation, learningRate: settings.learningRate, seed: DEFAULT_SEED };
  const model = initializeNetwork(config);
  const data = clonePreset(settings.preset);
  const first = evaluate(model, data);
  return {
    preset: settings.preset, data, pointClass: 0, model,
    history: [{ epoch: 0, loss: first.loss ?? 0 }],
    experiments: safeExperiments(), testInput: { x: 0, y: 0 },
    view: "decision", autoTraining: false, epochGoal: PRESETS[settings.preset].recommendedHiddenUnits >= 4 ? 2000 : 1000,
    explanationStep: 1, selectedNeuron: 0, quizIndex: 0, quizAnswer: null, highlightRevealed: false,
    mediaSampleIndex: 0, mediaHighlight: false,
    lessonStep: 1,
    furthestLessonStep: 1, furthestExplanationStep: 1,
  };
}

export class LabStore {
  private state: LabState;
  private listeners = new Set<Listener>();
  private animationId: number | null = null;

  constructor(state: LabState = initialState()) { this.state = state; }
  get snapshot(): LabState { return this.state; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  private emit(): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      preset: this.state.preset,
      hiddenUnits: this.state.model.config.hiddenUnits,
      activation: this.state.model.config.activation,
      learningRate: this.state.model.config.learningRate,
    }));
    this.listeners.forEach((listener) => listener(this.state));
  }
  private replaceModel(model: NetworkModel): void {
    const metrics = evaluate(model, this.state.data);
    this.state = {
      ...this.state, model, history: [{ epoch: 0, loss: metrics.loss ?? 0 }], autoTraining: false,
      selectedNeuron: Math.min(this.state.selectedNeuron, model.config.hiddenUnits - 1), quizAnswer: null, highlightRevealed: false,
    };
    this.stopAuto(false);
    this.emit();
  }
  resetModel(): void { this.replaceModel(initializeNetwork(this.state.model.config)); }
  setConfig(change: Partial<Pick<NetworkModel["config"], "hiddenUnits" | "activation" | "learningRate">>): void {
    this.replaceModel(initializeNetwork({ ...this.state.model.config, ...change }));
  }
  setPreset(preset: PresetName): void {
    const config = { ...this.state.model.config, hiddenUnits: PRESETS[preset].recommendedHiddenUnits };
    const model = initializeNetwork(config);
    const metrics = evaluate(model, clonePreset(preset));
    this.state = { ...this.state, preset, data: clonePreset(preset), model, history: [{ epoch: 0, loss: metrics.loss ?? 0 }], selectedNeuron: 0, explanationStep: 1, quizAnswer: null, highlightRevealed: false, mediaSampleIndex: 0, mediaHighlight: false, epochGoal: PRESETS[preset].recommendedHiddenUnits >= 4 ? 2000 : 1000 };
    this.stopAuto(false); this.emit();
  }
  setPointClass(pointClass: Label): void { this.state = { ...this.state, pointClass }; this.emit(); }
  addDataPoint(x: number, y: number): void {
    this.state = { ...this.state, preset: "custom", data: addPoint(this.state.data, x, y, this.state.pointClass) };
    this.resetModel();
  }
  undoDataPoint(): void { this.state = { ...this.state, preset: "custom", data: undoPoint(this.state.data) }; this.resetModel(); }
  setView(view: LabState["view"]): void { this.state = { ...this.state, view }; this.emit(); }
  setLessonStep(lessonStep: LabState["lessonStep"]): void {
    this.state = { ...this.state, lessonStep, furthestLessonStep: Math.max(this.state.furthestLessonStep, lessonStep) as LabState["furthestLessonStep"] };
    this.emit();
  }
  nextLesson(): void { this.setLessonStep(Math.min(5, this.state.lessonStep + 1) as LabState["lessonStep"]); }
  previousLesson(): void { this.setLessonStep(Math.max(1, this.state.lessonStep - 1) as LabState["lessonStep"]); }
  setExplanationStep(explanationStep: LabState["explanationStep"]): void {
    this.state = { ...this.state, explanationStep, view: "decision", quizAnswer: null, highlightRevealed: false };
    this.emit();
  }
  setSelectedNeuron(selectedNeuron: number): void {
    const last = Math.max(0, this.state.model.config.hiddenUnits - 1);
    this.state = { ...this.state, selectedNeuron: Math.max(0, Math.min(last, Math.floor(selectedNeuron))) };
    this.emit();
  }
  answerQuiz(quizAnswer: string): void { this.state = { ...this.state, quizAnswer }; this.emit(); }
  revealHighlight(): void { this.state = { ...this.state, highlightRevealed: true, quizAnswer: null }; this.emit(); }
  nextMediaSample(): void { this.state = { ...this.state, mediaSampleIndex: (this.state.mediaSampleIndex + 1) % 2, mediaHighlight: false }; this.emit(); }
  toggleMediaHighlight(): void { this.state = { ...this.state, mediaHighlight: !this.state.mediaHighlight }; this.emit(); }
  prepareExplanationModel(): string | null {
    const error = this.trainingError(); if (error) return error;
    const fresh = initializeNetwork(this.state.model.config);
    const model = train(fresh, this.state.data, this.state.epochGoal);
    const metrics = evaluate(model, this.state.data);
    this.state = { ...this.state, model, history: [{ epoch: model.epoch, loss: metrics.loss ?? 0 }], explanationStep: 1, selectedNeuron: 0, quizAnswer: null, highlightRevealed: false };
    this.emit(); return null;
  }
  beginPractice(): void { this.resetModel(); this.setLessonStep(4); }
  nextQuiz(): void {
    const explanationStep = Math.min(4, this.state.explanationStep + 1) as LabState["explanationStep"];
    this.state = { ...this.state, explanationStep, furthestExplanationStep: Math.max(this.state.furthestExplanationStep, explanationStep) as LabState["furthestExplanationStep"], quizAnswer: null, highlightRevealed: false };
    this.emit();
  }
  setTestInput(x: number, y: number): void { this.state = { ...this.state, testInput: { x: clampInput(x), y: clampInput(y) } }; this.emit(); }
  trainingError(): string | null { return validateTrainingData(this.state.data); }
  trainEpochs(epochs: number): string | null {
    const error = this.trainingError();
    if (error) return error;
    const model = train(this.state.model, this.state.data, epochs);
    const current = evaluate(model, this.state.data);
    const history = [...this.state.history, { epoch: model.epoch, loss: current.loss ?? 0 }].slice(-240);
    this.state = { ...this.state, model, history };
    this.emit();
    return null;
  }
  toggleAuto(): string | null {
    if (this.state.autoTraining) { this.stopAuto(); return null; }
    const error = this.trainingError();
    if (error) return error;
    const goal = this.state.model.epoch >= this.state.epochGoal ? this.state.epochGoal + 1000 : this.state.epochGoal;
    this.state = { ...this.state, autoTraining: true, epochGoal: goal };
    const tick = () => {
      if (!this.state.autoTraining) return;
      this.trainEpochs(Math.min(8, this.state.epochGoal - this.state.model.epoch));
      if (this.state.model.epoch >= this.state.epochGoal) this.stopAuto();
      else this.animationId = requestAnimationFrame(tick);
    };
    this.animationId = requestAnimationFrame(tick);
    this.emit();
    return null;
  }
  stopAuto(emit = true): void {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    if (this.state.autoTraining) this.state = { ...this.state, autoTraining: false };
    if (emit) this.emit();
  }
  saveExperiment(): string | null {
    const metrics = evaluate(this.state.model, this.state.data);
    if (this.state.model.epoch === 0 || metrics.loss === null || metrics.accuracy === null) return "먼저 모델을 학습하세요.";
    const record: ExperimentRecord = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      hiddenUnits: this.state.model.config.hiddenUnits,
      activation: this.state.model.config.activation,
      learningRate: this.state.model.config.learningRate,
      epoch: this.state.model.epoch,
      loss: metrics.loss,
      accuracy: metrics.accuracy,
    };
    this.state = { ...this.state, experiments: [...this.state.experiments, record] };
    localStorage.setItem(EXPERIMENTS_KEY, JSON.stringify(this.state.experiments));
    this.emit();
    return null;
  }
  deleteExperiment(id: string): void {
    this.state = { ...this.state, experiments: this.state.experiments.filter((item) => item.id !== id) };
    localStorage.setItem(EXPERIMENTS_KEY, JSON.stringify(this.state.experiments));
    this.emit();
  }
  exportModel(): StoredModelV2 | null {
    const metrics = evaluate(this.state.model, this.state.data);
    if (metrics.loss === null || metrics.accuracy === null) return null;
    return createStoredModel(this.state.preset, this.state.data, this.state.model, metrics.loss, metrics.accuracy);
  }
  importModel(stored: StoredModelV2): void {
    const metrics = evaluate(stored.model, stored.data);
    this.state = {
      ...this.state, preset: stored.task, data: stored.data.map((point) => ({ ...point })),
      model: structuredClone(stored.model),
      history: [{ epoch: stored.model.epoch, loss: metrics.loss ?? stored.metrics.loss }],
      autoTraining: false,
    };
    this.emit();
  }
}

export function createInitialStore(): LabStore { return new LabStore(); }
