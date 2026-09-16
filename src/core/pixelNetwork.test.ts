import { describe, expect, it } from "vitest";
import { createPixelDataset, PIXEL_INPUTS, PIXEL_TASKS } from "../data/pixelDatasets";
import { evaluatePixelModel, forwardPixels, initializePixelModel, trainPixelModel } from "./pixelNetwork";

describe("실제 픽셀 다중 분류 신경망", () => {
  it.each(["tanh", "sigmoid", "relu"] as const)("%s 역전파의 모든 연결값·시작값을 수치 미분과 비교한다", (activation) => {
    const model = initializePixelModel(3, 2, 3, 31, activation);
    model.hiddenBias = [.4, .5];
    const data = [{ pixels: [.2,.6,.8], label: 1 }, { pixels: [.1,.9,.4], label: 2 }];
    const rate = .0001, delta = .00001, next = trainPixelModel(model, data, 1, rate);
    const check = (get: (m: typeof model) => number, set: (m: typeof model, v: number) => void) => {
      const positive = structuredClone(model), negative = structuredClone(model), value = get(model);
      set(positive,value+delta); set(negative,value-delta);
      const numerical = (evaluatePixelModel(positive,data).loss-evaluatePixelModel(negative,data).loss)/(2*delta);
      expect((value-get(next))/rate).toBeCloseTo(numerical,6);
    };
    model.inputHidden.forEach((row,h) => row.forEach((_,i) => check((m) => m.inputHidden[h]![i]!, (m,v) => {m.inputHidden[h]![i]=v;})));
    model.hiddenOutput.forEach((row,c) => row.forEach((_,h) => check((m) => m.hiddenOutput[c]![h]!, (m,v) => {m.hiddenOutput[c]![h]=v;})));
    model.hiddenBias.forEach((_,h) => check((m) => m.hiddenBias[h]!, (m,v) => {m.hiddenBias[h]=v;}));
    model.outputBias.forEach((_,c) => check((m) => m.outputBias[c]!, (m,v) => {m.outputBias[c]=v;}));
  });
  it.each(["digits", "omr"] as const)("%s 자료는 196개 밝기를 직접 입력한다", (task) => {
    const data = createPixelDataset(task);
    expect(data.length).toBeGreaterThan(50);
    expect(data.every((example) => example.pixels.length === PIXEL_INPUTS)).toBe(true);
    expect(new Set(data.map((example) => example.label)).size).toBe(PIXEL_TASKS[task].classes.length);
  });

  it.each(["digits", "omr"] as const)("%s 모델은 실제 역전파로 여러 범주를 학습한다", (task) => {
    const data = createPixelDataset(task); const info = PIXEL_TASKS[task];
    const initial = initializePixelModel(PIXEL_INPUTS, info.hiddenUnits, info.classes.length);
    const before = evaluatePixelModel(initial, data); const trained = trainPixelModel(initial, data, 250, .12); const after = evaluatePixelModel(trained, data);
    expect(after.loss).toBeLessThan(before.loss * .35);
    expect(after.accuracy).toBeGreaterThan(.9);
    const probabilities = forwardPixels(trained, data[0]!.pixels).probabilities;
    expect(probabilities).toHaveLength(info.classes.length);
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
  });

  it.each(["tanh", "relu", "sigmoid"] as const)("승부차기 XOR와 같은 %s 중간값 방식을 쓸 수 있다", (activation) => {
    const data = createPixelDataset("digits");
    const initial = initializePixelModel(PIXEL_INPUTS, 4, 3, 31, activation);
    const trained = trainPixelModel(initial, data, 180, .12);
    expect(trained.activation).toBe(activation);
    expect(evaluatePixelModel(trained, data).loss).toBeLessThan(evaluatePixelModel(initial, data).loss);
  });
});
