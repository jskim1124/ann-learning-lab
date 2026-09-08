import { describe, expect, it } from "vitest";
import { initializePixelModel } from "../core/pixelNetwork";
import { createPixelScratchProjectFiles } from "./pixelScratchProject";

describe("픽셀 모델 Scratch 내보내기", () => {
  it("196개 그림 목록과 실제 계산용 나의 블록을 포함한다", () => {
    const model = initializePixelModel(196, 8, 3);
    const files = createPixelScratchProjectFiles(model, ["0", "1", "2"]);
    const project = JSON.parse(new TextDecoder().decode(files["project.json"]!)); const sprite = project.targets[1];
    expect(sprite.blocks.prototype.mutation.proccode).toBe("픽셀 그림 예측하기");
    expect(sprite.lists.list_pixels[1]).toHaveLength(196);
    expect(sprite.lists.list_w1[1]).toHaveLength(196 * 8);
    expect(sprite.lists.list_w2[1]).toHaveLength(8 * 3);
    expect(Object.values(sprite.blocks).some((block) => (block as { opcode: string }).opcode === "control_repeat")).toBe(true);
  });
});
