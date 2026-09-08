import type {
  ActivationName,
  DataPoint,
  ForwardResult,
  Metrics,
  NetworkModel,
} from "../types";

const EPSILON = 1e-9;

export function sigmoid(value: number): number {
  const clipped = Math.max(-40, Math.min(40, value));
  return 1 / (1 + Math.exp(-clipped));
}

export function activate(value: number, name: ActivationName): number {
  if (name === "relu") return Math.max(0, value);
  if (name === "sigmoid") return sigmoid(value);
  return Math.tanh(value);
}

export function activationDerivative(
  z: number,
  activated: number,
  name: ActivationName,
): number {
  if (name === "relu") return z > 0 ? 1 : 0;
  if (name === "sigmoid") return activated * (1 - activated);
  return 1 - activated * activated;
}

export function forward(model: NetworkModel, x: number, y: number): ForwardResult {
  const { parameters: p, config } = model;
  const z = p.inputHidden.map(
    (weights, index) => weights[0] * x + weights[1] * y + (p.hiddenBias[index] ?? 0),
  );
  const hidden = z.map((value) => activate(value, config.activation));
  const logit = hidden.reduce(
    (sum, value, index) => sum + value * (p.hiddenOutput[index] ?? 0),
    p.outputBias,
  );
  return { z, hidden, logit, probability: sigmoid(logit) };
}

export function evaluate(model: NetworkModel, data: DataPoint[]): Metrics {
  if (data.length === 0) return { loss: null, accuracy: null, correct: 0 };
  let loss = 0;
  let correct = 0;
  for (const point of data) {
    const probability = forward(model, point.x, point.y).probability;
    loss += -(
      point.label * Math.log(probability + EPSILON) +
      (1 - point.label) * Math.log(1 - probability + EPSILON)
    );
    if ((probability >= 0.5 ? 1 : 0) === point.label) correct += 1;
  }
  return { loss: loss / data.length, accuracy: correct / data.length, correct };
}

export function trainOne(model: NetworkModel, data: DataPoint[]): NetworkModel {
  if (data.length === 0) return model;
  const next = structuredClone(model);
  const p = next.parameters;
  const dInputHidden = p.inputHidden.map((): [number, number] => [0, 0]);
  const dHiddenBias = Array(next.config.hiddenUnits).fill(0) as number[];
  const dHiddenOutput = Array(next.config.hiddenUnits).fill(0) as number[];
  let dOutputBias = 0;

  for (const point of data) {
    const result = forward(model, point.x, point.y);
    const dLogit = result.probability - point.label;
    for (let h = 0; h < next.config.hiddenUnits; h += 1) {
      const hiddenValue = result.hidden[h] ?? 0;
      dHiddenOutput[h] = (dHiddenOutput[h] ?? 0) + dLogit * hiddenValue;
      const dZ =
        dLogit *
        (model.parameters.hiddenOutput[h] ?? 0) *
        activationDerivative(result.z[h] ?? 0, hiddenValue, next.config.activation);
      const gradients = dInputHidden[h];
      if (gradients) {
        gradients[0] += dZ * point.x;
        gradients[1] += dZ * point.y;
      }
      dHiddenBias[h] = (dHiddenBias[h] ?? 0) + dZ;
    }
    dOutputBias += dLogit;
  }

  const divisor = data.length;
  const rate = next.config.learningRate;
  for (let h = 0; h < next.config.hiddenUnits; h += 1) {
    const weights = p.inputHidden[h];
    const gradients = dInputHidden[h];
    if (!weights || !gradients) continue;
    weights[0] -= (rate * gradients[0]) / divisor;
    weights[1] -= (rate * gradients[1]) / divisor;
    p.hiddenBias[h] = (p.hiddenBias[h] ?? 0) - (rate * (dHiddenBias[h] ?? 0)) / divisor;
    p.hiddenOutput[h] = (p.hiddenOutput[h] ?? 0) - (rate * (dHiddenOutput[h] ?? 0)) / divisor;
  }
  p.outputBias -= (rate * dOutputBias) / divisor;
  next.epoch += 1;
  return next;
}

export function train(model: NetworkModel, data: DataPoint[], epochs: number): NetworkModel {
  let next = model;
  for (let index = 0; index < epochs; index += 1) next = trainOne(next, data);
  return next;
}
