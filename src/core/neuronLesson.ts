import { biasDirectionExample } from "./lessonArithmetic";
import { forwardPixels, type PixelExample, type PixelModel } from "./pixelNetwork";

export const NEURON_INTRO_STEPS = 5;
export const LESSON_PROJECTION = { mean:[0,0], horizontal:[1,0], vertical:[0,1], horizontalScale:1, verticalScale:1 };
// Fictional teaching truth is fixed BEFORE choosing or changing model weights.
// A: left half. B: right half. With C added, the lower-right quadrant becomes C.
export function lessonTruth(point:number[], classes=2):number {
  return point[0]! < 0 ? 0 : classes===3 && point[1]! < 0 ? 2 : 1;
}
export function lessonTruthRule(classes=2):string {
  return classes===3 ? '정답 규칙: 왼쪽 A / 오른쪽 위 B·아래 C. 0은 오른쪽·위쪽에 포함해요.' : '이번 정답 규칙: 가로가 음수면 A, 0 이상이면 B.';
}
export const NEURON_EXAMPLES: PixelExample[] = [
  {pixels:[-.7,.65],label:0}, {pixels:[-.6,-.55],label:0},
  {pixels:[.2,.2],label:1}, {pixels:[.75,.65],label:1}, {pixels:[.8,-.65],label:1},
];
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
