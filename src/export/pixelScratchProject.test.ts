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

  it("화면에서 고른 중간값 방식을 Scratch 계산에도 넣는다", () => {
    const model = initializePixelModel(196, 3, 3, 31, "relu");
    const files = createPixelScratchProjectFiles(model, ["0", "1", "2"]);
    const project = JSON.parse(new TextDecoder().decode(files["project.json"]!));
    const blocks = Object.values(project.targets[1].blocks) as Array<{ opcode: string; fields: Record<string, [string, string | null]> }>;
    expect(blocks.some((block) => block.opcode === "operator_mathop" && block.fields.OPERATOR?.[0] === "abs")).toBe(true);
  });

  it("Scratch 3 필수 무대 배경과 참조된 모든 에셋을 ZIP에 포함한다", () => {
    const model = initializePixelModel(196, 4, 5);
    const files = createPixelScratchProjectFiles(model, ["①", "②", "③", "④", "⑤"]);
    const project = JSON.parse(new TextDecoder().decode(files["project.json"]!));
    project.targets.forEach((target: { costumes: Array<{ assetId: string; md5ext: string }> }) => {
      expect(target.costumes.length).toBeGreaterThan(0);
      target.costumes.forEach((costume) => { expect(costume.assetId).toMatch(/^[a-f0-9]{32}$/i); expect(ArrayBuffer.isView(files[costume.md5ext])).toBe(true); });
    });
  });
});
