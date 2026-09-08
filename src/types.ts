export type ActivationName = "tanh" | "relu" | "sigmoid";
export type PresetName = "sound" | "sketch" | "digits" | "omr" | "custom" | "shot" | "plane" | "xor" | "and" | "focus";
export type MediaKind = "sound" | "sketch" | "digits" | "omr" | "points";
export type Label = 0 | 1;

export interface DataPoint {
  x: number;
  y: number;
  label: Label;
}

export interface NetworkConfig {
  hiddenUnits: number;
  activation: ActivationName;
  learningRate: number;
  seed: number;
}

export interface NetworkParameters {
  inputHidden: [number, number][];
  hiddenBias: number[];
  hiddenOutput: number[];
  outputBias: number;
}

export interface NetworkModel {
  config: NetworkConfig;
  parameters: NetworkParameters;
  epoch: number;
}

export interface ForwardResult {
  z: number[];
  hidden: number[];
  logit: number;
  probability: number;
}

export interface Metrics {
  loss: number | null;
  accuracy: number | null;
  correct: number;
}

export interface HistoryPoint {
  epoch: number;
  loss: number;
}

export interface ExperimentRecord {
  id: string;
  hiddenUnits: number;
  activation: ActivationName;
  learningRate: number;
  epoch: number;
  loss: number;
  accuracy: number;
}

export interface StoredModelV2 {
  format: "neural-lab/model-v2";
  createdAt: string;
  task: PresetName;
  inputs: { names: [string, string]; range: [-1, 1] };
  classes: [string, string];
  model: NetworkModel;
  metrics: { loss: number; accuracy: number };
  data: DataPoint[];
}
