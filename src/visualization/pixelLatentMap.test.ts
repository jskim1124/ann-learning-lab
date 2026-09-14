import { describe, expect, it } from "vitest";
import { forwardPixels, initializePixelModel, trainPixelModel } from "../core/pixelNetwork";
import { constrainPixelModelToProjection, createPixelFeatureProjection, createPixelProjection, pixelAxisLegend, projectPixels, projectionAxisDetails, reconstructProjectedPixels } from "../core/pixelProjection";
import { createPixelDataset, PIXEL_INPUTS } from "../data/pixelDatasets";
import { pixelFeatureAccuracy, pixelFeatureCoordinates, pixelMapExampleAt } from "./pixelLatentMap";

describe("고정된 픽셀 그림 지도", () => {
  it("모델을 학습해도 같은 그림의 가로·세로 위치는 바뀌지 않는다", () => {
    const data = createPixelDataset("digits"); const projection = createPixelProjection(data); const before = projectPixels(projection, data[0]!.pixels);
    const model = initializePixelModel(PIXEL_INPUTS, 2, 3); trainPixelModel(model, data, 100, .12);
    const after = projectPixels(projection, data[0]!.pixels);
    expect(after).toEqual(before);
    expect(Math.abs(before.x)).toBeLessThanOrEqual(1); expect(Math.abs(before.y)).toBeLessThanOrEqual(1);
  });

  it("색으로 보여 주는 196칸의 영향을 더하면 실제 지도 점수가 된다", () => {
    const data = createPixelDataset("omr"); const projection = createPixelProjection(data); const pixels = data[7]!.pixels;
    const horizontal = projectionAxisDetails(projection, pixels, "horizontal"); const vertical = projectionAxisDetails(projection, pixels, "vertical"); const point = projectPixels(projection, pixels);
    expect(horizontal.contributions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(horizontal.rawScore, 10);
    expect(vertical.contributions.reduce((sum, value) => sum + value, 0)).toBeCloseTo(vertical.rawScore, 10);
    expect(point.x).toBeCloseTo(horizontal.mapScore, 10); expect(point.y).toBeCloseTo(vertical.mapScore, 10);
  });

  it("자료 점의 실제 예측과 같은 좌표의 배경 예측이 정확히 일치한다", () => {
    const data = createPixelDataset("digits"); const projection = createPixelProjection(data); let model = constrainPixelModelToProjection(initializePixelModel(PIXEL_INPUTS, 4, 3), projection);
    for (let epoch = 0; epoch < 30; epoch += 1) model = constrainPixelModelToProjection(trainPixelModel(model, data, 1, .12), projection);
    data.slice(0, 12).forEach((example) => {
      const point = projectPixels(projection, example.pixels); const actual = forwardPixels(model, example.pixels).probabilities; const map = forwardPixels(model, reconstructProjectedPixels(projection, point.x, point.y)).probabilities;
      actual.forEach((value, index) => expect(map[index]).toBeCloseTo(value, 8));
    });
  });

  it("OMR의 진한 부분 위치를 쓰면 ①부터 ⑤까지 좌우 순서로 놓인다", () => {
    const data = createPixelDataset("omr"); const projection = createPixelProjection(data); const points = pixelFeatureCoordinates(data, projection, "omr", "position");
    const means = [0, 1, 2, 3, 4].map((label) => { const selected = points.filter((_, index) => data[index]?.label === label); return selected.reduce((sum, point) => sum + point.x, 0) / selected.length; });
    expect(means).toEqual([...means].sort((left, right) => left - right));
    expect(means[4]! - means[0]!).toBeGreaterThan(1);
  });

  it("OMR 특징을 바꾸면 실제 계산 축과 범례가 함께 바뀐다", () => {
    expect(pixelAxisLegend("omr", "position")).toMatchObject({ horizontal: { title: "마킹 좌우 위치" }, vertical: { title: "마킹 위아래 위치" } });
    expect(pixelAxisLegend("omr", "ink")).toMatchObject({ horizontal: { title: "칠한 양" }, vertical: { title: "마킹 자국 퍼짐" } });
    expect(pixelAxisLegend("omr", "learned")).toMatchObject({ horizontal: { title: "그림 차이 1" }, vertical: { title: "그림 차이 2" } });
  });

  it("위에 그린 자국은 위치 지도의 위쪽에, 아래 자국은 아래쪽에 놓인다", () => {
    const top = Array<number>(196).fill(0); const bottom = Array<number>(196).fill(0); top[7] = 1; bottom[13 * 14 + 7] = 1;
    const data = [{ pixels: top, label: 0 }, { pixels: bottom, label: 1 }]; const projection = createPixelFeatureProjection(data, "omr", "position");
    expect(projectPixels(projection, top).y).toBeGreaterThan(projectPixels(projection, bottom).y);
  });

  it("그래프에서는 누른 점만 고르고 빈 곳은 임의의 점으로 바꾸지 않는다", () => {
    const data = createPixelDataset("omr"); const projection = createPixelFeatureProjection(data, "omr", "position"); const canvas = document.createElement("canvas");
    const rect = { left: 20, top: 30, width: 700, height: 420, right: 720, bottom: 450, x: 20, y: 30, toJSON: () => ({}) }; canvas.getBoundingClientRect = () => rect;
    const point = projectPixels(projection, data[0]!.pixels); const x = rect.left + 50 + (point.x + 1) / 2 * (700 - 50 - 14); const y = rect.top + 13 + (1 - (point.y + 1) / 2) * (420 - 13 - 39);
    expect(pixelMapExampleAt(canvas, x, y, projection, data)).toBe(0);
    expect(pixelMapExampleAt(canvas, rect.left + 8, rect.top + 8, projection, data)).toBeNull();
  });

  it("현재 OMR 자료에서는 위치 특징도 학습 특징만큼 잘 나눈다고 정직하게 보여 준다", () => {
    const data = createPixelDataset("omr"); const learned = createPixelFeatureProjection(data, "omr", "learned"); const position = createPixelFeatureProjection(data, "omr", "position");
    expect(pixelFeatureAccuracy(data, position, "omr", "position")).toBeGreaterThan(.95);
    expect(pixelFeatureAccuracy(data, position, "omr", "position")).toBeGreaterThanOrEqual(pixelFeatureAccuracy(data, learned, "omr", "learned") - .03);
  });
});
