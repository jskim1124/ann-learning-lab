import { describe, expect, it } from "vitest";
import { emptyDrawing, sampleForClass } from "./pixelDatasets";

describe("OMR 그림 입력", () => {
  it("다섯 선지의 옅은 테두리도 196개 픽셀값에 들어간다", () => {
    const empty = emptyDrawing("omr");
    expect(empty).toHaveLength(196);
    expect(empty.some((value) => value > 0 && value < .4)).toBe(true);
    expect(empty.every((value) => value < .4)).toBe(true);
  });

  it("선택한 답 칸은 통째로 채우지 않고 연필 선처럼 표시한다", () => {
    const first = sampleForClass("omr", 0, 1); const fifth = sampleForClass("omr", 4, 1);
    expect(first.filter((value) => value >= .4).length).toBeGreaterThan(3);
    expect(first.filter((value) => value >= .4).length).toBeLessThan(14);
    expect(first).not.toEqual(fifth);
    const darkColumns = [...new Set(first.map((value, index) => value >= .4 ? index % 14 : -1).filter((index) => index >= 0))];
    expect(darkColumns).toEqual([0, 1]);
  });

  it("일부 OMR 예시는 답 칸 밖으로 나간 연필 자국도 포함한다", () => {
    const marked = sampleForClass("omr", 1, 0); const darkColumns = [...new Set(marked.map((value, index) => value >= .4 ? index % 14 : -1).filter((index) => index >= 0))];
    expect(darkColumns).toContain(3); expect(darkColumns).toContain(4); expect(darkColumns).toContain(5);
  });
});
