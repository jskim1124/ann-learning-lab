import { describe, expect, it } from "vitest";
import { emptyDrawing, sampleForClass } from "./pixelDatasets";

describe("OMR 그림 입력", () => {
  it("다섯 선지의 옅은 테두리도 196개 픽셀값에 들어간다", () => {
    const empty = emptyDrawing("omr");
    expect(empty).toHaveLength(196);
    expect(empty.some((value) => value > 0 && value < .4)).toBe(true);
    expect(empty.every((value) => value < .4)).toBe(true);
  });

  it("선택한 답 칸은 내부까지 진하게 채운다", () => {
    const first = sampleForClass("omr", 0, 1); const fifth = sampleForClass("omr", 4, 1);
    expect(first.filter((value) => value >= .4).length).toBeGreaterThan(10);
    expect(first.filter((value) => value >= .4).length).toBeLessThan(first.filter((value) => value > 0).length);
    expect(first).not.toEqual(fifth);
    const darkColumns = [...new Set(first.map((value, index) => value >= .4 ? index % 14 : -1).filter((index) => index >= 0))];
    expect(darkColumns).toEqual([0, 1]);
  });
});
