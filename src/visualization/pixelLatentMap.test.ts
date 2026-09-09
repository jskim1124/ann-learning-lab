import { describe, expect, it } from "vitest";
import { initializePixelModel, trainPixelModel } from "../core/pixelNetwork";
import { createPixelDataset, PIXEL_INPUTS } from "../data/pixelDatasets";
import { createPixelProjection, projectPixels, projectionAxisDetails } from "./pixelLatentMap";

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
});
