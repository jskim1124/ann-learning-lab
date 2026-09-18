import { biasDirectionExample } from "./lessonArithmetic";
import { forwardPixels, type PixelModel } from "./pixelNetwork";

export const NEURON_INTRO_STEPS = 5;
export const NEURON_PROBES: Record<string, { title: string; point: [number, number] }> = {
  input: { title: "처음 점 (0.2, 0.2)", point: [.2, .2] },
  purple1: { title: "(−0.5, 1)", point: [-.5, 1] },
  purple2: { title: "(0, 0)", point: [0, 0] },
  purple3: { title: "(0.5, −1)", point: [.5, -1] },
  black1: { title: "(0, 1)", point: [0, 1] },
  black2: { title: "(0.5, 0)", point: [.5, 0] },
  black3: { title: "(1, −1)", point: [1, -1] },
  sideA: { title: "A 쪽 (−0.1, 0.2)", point: [-.1, .2] },
  tie: { title: "경계 (0.4, 0.2)", point: [.4, .2] },
  sideB: { title: "B 쪽 (0.9, 0.2)", point: [.9, .2] },
};
export const neuronLessonModel = (): PixelModel => biasDirectionExample().frames[0]!;
export function neuronCalculation(model: PixelModel, point: number[]) {
  const terms = model.inputHidden[0]!.map((weight, i) => weight * point[i]!);
  const sum = terms.reduce((a, b) => a + b, model.hiddenBias[0]!);
  return { terms, sum, ...forwardPixels(model, point) };
}
