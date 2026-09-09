import { describe, expect, it } from "vitest";
import { emptyDrawing, sampleForClass } from "./pixelDatasets";

describe("OMR 그림 입력", () => {
  it("선지 테두리는 안내선일 뿐 196개 학습값에는 들어가지 않는다", () => {
    expect(emptyDrawing("omr").every((value) => value === 0)).toBe(true);
  });

  it("선택한 선지의 진한 마킹만 픽셀 학습값으로 만든다", () => {
    const first = sampleForClass("omr", 0, 1); const fifth = sampleForClass("omr", 4, 1);
    expect(first.filter((value) => value > 0).length).toBeLessThanOrEqual(9);
    expect(first).not.toEqual(fifth);
  });
});
