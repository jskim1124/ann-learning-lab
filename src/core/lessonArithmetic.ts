import { featureCalculation, type ImageFeature } from "./imageFeatures";
import { forwardPixels, type PixelModel } from "./pixelNetwork";

/** Small teaching image, never added to the learner's training data. */
export function smallFeatureExample(id: string) {
  const pixels = [0, 1, 0, 0, 0, .5, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0];
  const kind = ["lr", "tb", "ink", "center", "position"].includes(id) ? id : "lr";
  const weights = pixels.map((_, i) => {
    const x = i % 4, y = Math.floor(i / 4);
    return kind === "lr" ? x >= 2 ? 1 : -1 : kind === "tb" ? y < 2 ? 1 : -1 : kind === "center" ? x >= 1 && x <= 2 && y >= 1 && y <= 2 ? 1 : 0 : kind === "position" ? x + 1 : 1;
  });
  const names: Record<string, string> = { lr: "오른쪽 − 왼쪽", tb: "위 − 아래", ink: "전체 진하기", center: "가운데 진하기", position: "열 번호 × 진하기 합" };
  const feature: ImageFeature = { id: kind, name: names[kind]!, weights, description: "계산 방법을 배우기 위한 4×4 예제" };
  return { pixels, feature, calculation: featureCalculation(feature, pixels) };
}
export function outputTeachingModel(): PixelModel {
  return { inputSize: 2, hiddenUnits: 2, classCount: 2, epoch: 0, activation: "tanh", inputHidden: [[1.4, .5], [.2, -1.3]], hiddenBias: [.2, -.1], hiddenOutput: [[1.2, -.8], [-.6, 1.1]], outputBias: [.1, -.15] };
}
/** Finite-search learning: hold all weights fixed, compare only three bias candidates. */
export function biasDirectionExample() {
  const point = [.2, .2];
  const initial: PixelModel = { inputSize: 2, hiddenUnits: 1, classCount: 2, epoch: 0, activation: "tanh", inputHidden: [[1, .5]], hiddenBias: [-.6], hiddenOutput: [[-1], [1]], outputBias: [0, 0] };
  const frames = [initial];
  for (let i = 0; i < 8; i++) {
    const current = frames.at(-1)!;
    const candidates = [-.1, 0, .1].map(change => ({ ...current, epoch: current.epoch + 1, hiddenBias: [current.hiddenBias[0]! + change] }));
    frames.push(candidates.reduce((best, model) => forwardPixels(model, point).probabilities[1]! > forwardPixels(best, point).probabilities[1]! ? model : best));
  }
  const candidates = [-.1, 0, .1].map(change => ({ change, probability: forwardPixels({ ...initial, hiddenBias: [initial.hiddenBias[0]! + change] }, point).probabilities[1]! }));
  return { point, frames, candidates };
}
export function numberChoices(answer: number): number[] {
  const rounded = Number(answer.toFixed(2));
  return [Number((rounded + 1).toFixed(2)), rounded, Number((rounded - 1).toFixed(2))];
}
