import { describe, expect, it } from "vitest";
import { pixelLineIndices } from "./pixelCanvas";

describe("픽셀 자유 그리기", () => {
  it("빠르게 대각선으로 그어도 중간 칸이 끊기지 않는다", () => {
    expect(pixelLineIndices(0, 45)).toEqual([0, 15, 30, 45]);
  });

  it("같은 칸에서 움직이지 않으면 그 칸 하나만 칠한다", () => {
    expect(pixelLineIndices(27, 27)).toEqual([27]);
  });
});
