import { describe, expect, it } from "vitest";
import { emptyDrawing, sampleForClass, starterDrawing } from "./pixelDatasets";

describe("처음 보여 주는 그림", () => {
  it("숫자 0은 가운데에 한 칸 굵기로 시작한다", () => {
    const starter = starterDrawing("digits"); const thickVariation = sampleForClass("digits", 0, 0);
    expect(starter.filter((value) => value >= .4).length).toBeLessThan(thickVariation.filter((value) => value >= .4).length);
    expect(starter.filter((value, index) => value >= .4 && index % 14 === 3)).toHaveLength(8);
  });

  it("OMR은 첫 번째 답 칸에 가는 연필 선 하나로 시작한다", () => {
    const starter = starterDrawing("omr");
    expect(starter.filter((value) => value >= .4).length).toBeGreaterThan(3);
    expect(starter.filter((value) => value >= .4).length).toBeLessThan(14);
  });
});

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
