import { describe, expect, it } from "vitest";
import { createPixelDataset, PIXEL_INPUTS, PIXEL_TASKS } from "../data/pixelDatasets";
import { evaluatePixelModel, forwardPixels, initializePixelModel, trainPixelModel } from "./pixelNetwork";

describe("실제 픽셀 다중 분류 신경망", () => {
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
});
