import { describe, expect, it } from "vitest";
import { initializePixelModel, trainPixelModel } from "../core/pixelNetwork";
import { createPixelDataset, PIXEL_INPUTS } from "../data/pixelDatasets";
import { createPixelProjection, projectPixels } from "./pixelLatentMap";

describe("고정된 픽셀 그림 지도", () => {
  it("모델을 학습해도 같은 그림의 가로·세로 위치는 바뀌지 않는다", () => {
    const data = createPixelDataset("digits"); const projection = createPixelProjection(data); const before = projectPixels(projection, data[0]!.pixels);
    const model = initializePixelModel(PIXEL_INPUTS, 2, 3); trainPixelModel(model, data, 100, .12);
    const after = projectPixels(projection, data[0]!.pixels);
    expect(after).toEqual(before);
    expect(Math.abs(before.x)).toBeLessThanOrEqual(1); expect(Math.abs(before.y)).toBeLessThanOrEqual(1);
  });
});
