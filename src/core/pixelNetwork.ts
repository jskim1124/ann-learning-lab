export interface PixelExample { pixels: number[]; label: number; }
export interface PixelModel {
  inputSize: number; hiddenUnits: number; classCount: number; epoch: number;
  inputHidden: number[][]; hiddenBias: number[]; hiddenOutput: number[][]; outputBias: number[];
}

export interface PixelForward { hidden: number[]; logits: number[]; probabilities: number[]; }
export interface PixelMetrics { loss: number; accuracy: number; correct: number; }

function randomSource(seed: number): () => number {
  let value = seed >>> 0;
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function initializePixelModel(inputSize: number, hiddenUnits: number, classCount: number, seed = 31): PixelModel {
  const random = randomSource(seed); const inputScale = Math.sqrt(2 / inputSize); const outputScale = Math.sqrt(2 / hiddenUnits);
  return {
    inputSize, hiddenUnits, classCount, epoch: 0,
    inputHidden: Array.from({ length: hiddenUnits }, () => Array.from({ length: inputSize }, () => (random() * 2 - 1) * inputScale)),
    hiddenBias: Array(hiddenUnits).fill(0) as number[],
    hiddenOutput: Array.from({ length: classCount }, () => Array.from({ length: hiddenUnits }, () => (random() * 2 - 1) * outputScale)),
    outputBias: Array(classCount).fill(0) as number[],
  };
}

export function forwardPixels(model: PixelModel, pixels: number[]): PixelForward {
  const hidden = model.inputHidden.map((weights, h) => Math.tanh(weights.reduce((sum, weight, index) => sum + weight * (pixels[index] ?? 0), model.hiddenBias[h] ?? 0)));
  const logits = model.hiddenOutput.map((weights, c) => weights.reduce((sum, weight, h) => sum + weight * (hidden[h] ?? 0), model.outputBias[c] ?? 0));
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return { hidden, logits, probabilities: exponentials.map((value) => value / total) };
}

export function evaluatePixelModel(model: PixelModel, data: PixelExample[]): PixelMetrics {
  if (data.length === 0) return { loss: 0, accuracy: 0, correct: 0 };
  let loss = 0; let correct = 0;
  data.forEach((example) => {
    const probabilities = forwardPixels(model, example.pixels).probabilities;
    loss -= Math.log(Math.max(probabilities[example.label] ?? 0, 1e-12));
    if (probabilities.indexOf(Math.max(...probabilities)) === example.label) correct += 1;
  });
  return { loss: loss / data.length, accuracy: correct / data.length, correct };
}

export function trainPixelModel(model: PixelModel, data: PixelExample[], epochs: number, learningRate: number): PixelModel {
  const next: PixelModel = { ...model, inputHidden: model.inputHidden.map((row) => [...row]), hiddenBias: [...model.hiddenBias], hiddenOutput: model.hiddenOutput.map((row) => [...row]), outputBias: [...model.outputBias] };
  if (data.length === 0) return next;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradInput = Array.from({ length: next.hiddenUnits }, () => Array<number>(next.inputSize).fill(0));
    const gradHiddenBias = Array<number>(next.hiddenUnits).fill(0);
    const gradOutput = Array.from({ length: next.classCount }, () => Array<number>(next.hiddenUnits).fill(0));
    const gradOutputBias = Array<number>(next.classCount).fill(0);
    data.forEach((example) => {
      const { hidden, probabilities } = forwardPixels(next, example.pixels);
      const hiddenDelta = Array<number>(next.hiddenUnits).fill(0);
      for (let c = 0; c < next.classCount; c += 1) {
        const delta = (probabilities[c] ?? 0) - (example.label === c ? 1 : 0);
        gradOutputBias[c] = (gradOutputBias[c] ?? 0) + delta;
        for (let h = 0; h < next.hiddenUnits; h += 1) { gradOutput[c]![h] = (gradOutput[c]![h] ?? 0) + delta * (hidden[h] ?? 0); hiddenDelta[h] = (hiddenDelta[h] ?? 0) + delta * (next.hiddenOutput[c]?.[h] ?? 0); }
      }
      for (let h = 0; h < next.hiddenUnits; h += 1) {
        const hiddenValue = hidden[h] ?? 0; const delta = (hiddenDelta[h] ?? 0) * (1 - hiddenValue * hiddenValue);
        gradHiddenBias[h] = (gradHiddenBias[h] ?? 0) + delta;
        for (let i = 0; i < next.inputSize; i += 1) gradInput[h]![i] = (gradInput[h]![i] ?? 0) + delta * (example.pixels[i] ?? 0);
      }
    });
    const scale = learningRate / data.length;
    for (let h = 0; h < next.hiddenUnits; h += 1) { next.hiddenBias[h] = (next.hiddenBias[h] ?? 0) - scale * (gradHiddenBias[h] ?? 0); for (let i = 0; i < next.inputSize; i += 1) next.inputHidden[h]![i] = (next.inputHidden[h]![i] ?? 0) - scale * (gradInput[h]![i] ?? 0); }
    for (let c = 0; c < next.classCount; c += 1) { next.outputBias[c] = (next.outputBias[c] ?? 0) - scale * (gradOutputBias[c] ?? 0); for (let h = 0; h < next.hiddenUnits; h += 1) next.hiddenOutput[c]![h] = (next.hiddenOutput[c]![h] ?? 0) - scale * (gradOutput[c]![h] ?? 0); }
    next.epoch += 1;
  }
  return next;
}
