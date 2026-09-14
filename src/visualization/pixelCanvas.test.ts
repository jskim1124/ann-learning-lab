import { describe, expect, it } from "vitest";
import { pixelIndexAt, pixelLineIndices } from "./pixelCanvas";

describe("픽셀 자유 그리기", () => {
  it("빠르게 대각선으로 그어도 중간 칸이 끊기지 않는다", () => {
    expect(pixelLineIndices(0, 45)).toEqual([0, 15, 30, 45]);
  });

  it("같은 칸에서 움직이지 않으면 그 칸 하나만 칠한다", () => {
    expect(pixelLineIndices(27, 27)).toEqual([27]);
  });

  it("그림판 가장자리를 벗어나도 같은 줄의 끝 칸에 정확히 찍는다", () => {
    const canvas = document.createElement("canvas"); const rect = { left: 100, top: 50, width: 280, height: 280, right: 380, bottom: 330, x: 100, y: 50, toJSON: () => ({}) }; canvas.getBoundingClientRect = () => rect;
    expect(pixelIndexAt(canvas, 90, 50 + 5.5 * 20)).toBe(5 * 14);
    expect(pixelIndexAt(canvas, 390, 50 + 5.5 * 20)).toBe(5 * 14 + 13);
  });
});
