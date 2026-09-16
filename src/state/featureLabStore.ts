import { evaluatePixelModel, forwardPixels, initializePixelModel, trainPixelModel, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import type { ActivationName, DataPoint } from "../types";

export interface FeatureHistoryPoint { epoch: number; loss: number; accuracy?: number; }
export interface FeatureLabState {
  classes: string[];
  data: PixelExample[];
  model: PixelModel;
  learningRate: number;
  history: FeatureHistoryPoint[];
  testInput: { x: number; y: number };
  showNeuronBoundaries: boolean;
  showDecisionBoundary: boolean;
}

type Listener = (state: FeatureLabState) => void;

export class FeatureLabStore {
  private state: FeatureLabState;
  private listeners = new Set<Listener>();

  constructor() {
    const model = initializePixelModel(2, 1, 2, 47);
    this.state = { classes: ["A 결과", "B 결과"], data: [], model, learningRate: .1, history: [{ epoch: 0, loss: 0 }], testInput: { x: 0, y: 0 }, showNeuronBoundaries: true, showDecisionBoundary: true };
  }

  get snapshot(): FeatureLabState { return this.state; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  private emit(): void { this.listeners.forEach((listener) => listener(this.state)); }
  private restart(classes = this.state.classes, data = this.state.data, hiddenUnits = this.state.model.hiddenUnits, activation = this.state.model.activation): void {
    const model = initializePixelModel(2, hiddenUnits, classes.length, 47, activation);
    this.state = { ...this.state, classes: [...classes], data: data.map((item) => ({ pixels: [...item.pixels], label: item.label })), model, history: [{ epoch: 0, ...evaluatePixelModel(model, data) }] };
  }

  setDataset(points: DataPoint[], classes: string[]): void {
    this.restart(classes, points.map((point) => ({ pixels: [point.x, point.y], label: point.label })));
    this.emit();
  }
  resetModel(): void { this.restart(); this.emit(); }
  train(epochs: number): void {
    const model = trainPixelModel(this.state.model, this.state.data, epochs, this.state.learningRate);
    const metrics = evaluatePixelModel(model, this.state.data);
    this.state = { ...this.state, model, history: [...this.state.history, { epoch: model.epoch, loss: metrics.loss, accuracy: metrics.accuracy }].slice(-240) };
    this.emit();
  }
  setHiddenUnits(hiddenUnits: number): void { this.restart(this.state.classes, this.state.data, Math.max(1, Math.min(8, Math.round(hiddenUnits))), this.state.model.activation); this.emit(); }
  setActivation(activation: ActivationName): void { this.restart(this.state.classes, this.state.data, this.state.model.hiddenUnits, activation); this.emit(); }
  setLearningRate(learningRate: number): void { this.state = { ...this.state, learningRate: Math.max(.01, Math.min(.3, learningRate)) }; this.emit(); }
  setTestInput(x: number, y: number): void { this.state = { ...this.state, testInput: { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) } }; this.emit(); }
  setLayers(change: { showNeuronBoundaries?: boolean; showDecisionBoundary?: boolean }): void { this.state = { ...this.state, ...change }; this.emit(); }
  probabilities(): number[] { return forwardPixels(this.state.model, [this.state.testInput.x, this.state.testInput.y]).probabilities; }
  metrics() { return evaluatePixelModel(this.state.model, this.state.data); }
}
