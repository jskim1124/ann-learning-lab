import { evaluatePixelModel, forwardPixels, initializePixelModel, trainPixelModel, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import { constrainPixelModelToProjection, createPixelProjection, type PixelProjection } from "../core/pixelProjection";
import { createPixelDataset, emptyDrawing, PIXEL_INPUTS, PIXEL_TASKS, sampleForClass, type PixelTaskName } from "../data/pixelDatasets";
import type { ActivationName } from "../types";

export interface PixelHistoryPoint { epoch: number; loss: number; }
export interface PixelLabState {
  task: PixelTaskName;
  data: PixelExample[];
  model: PixelModel;
  drawing: number[];
  selectedLabel: number;
  learningRate: number;
  history: PixelHistoryPoint[];
  understandStep: 1 | 2 | 3 | 4;
  highlightRevealed: boolean;
  quizPassed: boolean;
  projection: PixelProjection;
  showNeuronGradient: boolean;
  showDecisionBoundary: boolean;
  selectedNeuron: number;
  mapExampleIndex: number | null;
}

export class PixelLabStore {
  private state: PixelLabState;
  private listeners = new Set<(state: PixelLabState) => void>();
  constructor(task: PixelTaskName = "digits") { this.state = this.fresh(task); }
  private fresh(task: PixelTaskName): PixelLabState {
    const info = PIXEL_TASKS[task]; const data = createPixelDataset(task); const projection = createPixelProjection(data); const model = constrainPixelModelToProjection(initializePixelModel(PIXEL_INPUTS, info.hiddenUnits, info.classes.length), projection);
    return { task, data, model, drawing: sampleForClass(task, 0), selectedLabel: 0, learningRate: .12, history: [{ epoch: 0, loss: evaluatePixelModel(model, data).loss }], understandStep: 1, highlightRevealed: false, quizPassed: false, projection, showNeuronGradient: true, showDecisionBoundary: true, selectedNeuron: 0, mapExampleIndex: null };
  }
  get snapshot(): PixelLabState { return this.state; }
  subscribe(listener: (state: PixelLabState) => void): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  private emit(): void { this.listeners.forEach((listener) => listener(this.state)); }
  setTask(task: PixelTaskName): void { if (this.state.task !== task) { this.state = this.fresh(task); this.emit(); } }
  paint(index: number, value = 1): void { if (index < 0 || index >= PIXEL_INPUTS) return; const drawing = [...this.state.drawing]; drawing[index] = value; this.state = { ...this.state, drawing, mapExampleIndex: null }; this.emit(); }
  clear(): void { this.state = { ...this.state, drawing: emptyDrawing(this.state.task), mapExampleIndex: null }; this.emit(); }
  loadSample(label: number, variation = 0): void { this.state = { ...this.state, drawing: sampleForClass(this.state.task, label, variation), selectedLabel: label, mapExampleIndex: null }; this.emit(); }
  selectLabel(label: number): void { this.state = { ...this.state, selectedLabel: label }; this.emit(); }
  addDrawing(): void { const example = { pixels: [...this.state.drawing], label: this.state.selectedLabel }; this.state = { ...this.state, data: [...this.state.data, example] }; this.emit(); }
  train(epochs: number): void { let model = this.state.model; for (let epoch = 0; epoch < epochs; epoch += 1) model = constrainPixelModelToProjection(trainPixelModel(model, this.state.data, 1, this.state.learningRate), this.state.projection); const metrics = evaluatePixelModel(model, this.state.data); this.state = { ...this.state, model, history: [...this.state.history, { epoch: model.epoch, loss: metrics.loss }] }; this.emit(); }
  resetModel(): void { const model = constrainPixelModelToProjection(initializePixelModel(PIXEL_INPUTS, this.state.model.hiddenUnits, PIXEL_TASKS[this.state.task].classes.length, 31, this.state.model.activation), this.state.projection); this.state = { ...this.state, model, history: [{ epoch: 0, loss: evaluatePixelModel(model, this.state.data).loss }] }; this.emit(); }
  setHiddenUnits(hiddenUnits: number): void { const count = Math.max(1, Math.min(6, Math.round(hiddenUnits))); const model = constrainPixelModelToProjection(initializePixelModel(PIXEL_INPUTS, count, PIXEL_TASKS[this.state.task].classes.length, 31, this.state.model.activation), this.state.projection); this.state = { ...this.state, model, selectedNeuron: Math.min(this.state.selectedNeuron, count - 1), history: [{ epoch: 0, loss: evaluatePixelModel(model, this.state.data).loss }] }; this.emit(); }
  setActivation(activation: ActivationName): void { const model = constrainPixelModelToProjection(initializePixelModel(PIXEL_INPUTS, this.state.model.hiddenUnits, PIXEL_TASKS[this.state.task].classes.length, 31, activation), this.state.projection); this.state = { ...this.state, model, history: [{ epoch: 0, loss: evaluatePixelModel(model, this.state.data).loss }] }; this.emit(); }
  setLearningRate(learningRate: number): void { this.state = { ...this.state, learningRate: Math.max(.01, Math.min(.3, learningRate)) }; this.emit(); }
  setLayers(layers: { showNeuronGradient?: boolean; showDecisionBoundary?: boolean }): void { this.state = { ...this.state, ...layers }; this.emit(); }
  setSelectedNeuron(selectedNeuron: number): void { this.state = { ...this.state, selectedNeuron: Math.max(0, Math.min(this.state.model.hiddenUnits - 1, Math.round(selectedNeuron))) }; this.emit(); }
  selectMapExample(index: number | null): void { this.state = { ...this.state, mapExampleIndex: index !== null && index >= 0 && index < this.state.data.length ? index : null }; this.emit(); }
  revealHighlight(): void { this.state = { ...this.state, highlightRevealed: true }; this.emit(); }
  passQuiz(): void { this.state = { ...this.state, quizPassed: true }; this.emit(); }
  nextUnderstand(): void { const step = Math.min(4, this.state.understandStep + 1) as 1 | 2 | 3 | 4; this.state = { ...this.state, understandStep: step, highlightRevealed: false, quizPassed: false }; this.emit(); }
  resetUnderstanding(): void { this.state = { ...this.state, understandStep: 1, highlightRevealed: false, quizPassed: false }; this.emit(); }
  probabilities(): number[] { return forwardPixels(this.state.model, this.state.drawing).probabilities; }
  metrics() { return evaluatePixelModel(this.state.model, this.state.data); }
}
