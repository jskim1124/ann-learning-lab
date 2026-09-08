import { describe, expect, it } from "vitest";
import { initializeNetwork } from "../core/initialization";
import { createScratchProjectFiles, zipStored } from "./scratchProject";

describe("official Scratch project export", () => {
  it("contains a native My Block procedure and visible result variables", () => {
    const model = initializeNetwork({ hiddenUnits: 3, activation: "tanh", learningRate: .08, seed: 19 });
    const files = createScratchProjectFiles(model);
    const project = JSON.parse(new TextDecoder().decode(files["project.json"]));
    const sprite = project.targets[1];
    const prototype = sprite.blocks.prototype_neural_lab;
    expect(prototype.opcode).toBe("procedures_prototype");
    expect(prototype.mutation.proccode).toBe("Neural Lab 예측하기 A %s B %s");
    expect((Object.values(sprite.variables) as Array<[string, number]>).map((entry) => entry[0])).toEqual(expect.arrayContaining(["범주 1 확률", "예측 범주", "은닉 H3"]));
    expect(project.extensions).toEqual([]);
  });

  it("writes a valid ZIP container header and central directory", () => {
    const model = initializeNetwork({ hiddenUnits: 2, activation: "relu", learningRate: .08, seed: 19 });
    const archive = zipStored(createScratchProjectFiles(model));
    expect([...archive.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect([...archive.slice(-22, -18)]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });
});
