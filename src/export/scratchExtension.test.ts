import { describe, expect, it } from "vitest";
import { initializeNetwork } from "../core/initialization";
import { forward, train } from "../core/neuralNetwork";
import { clonePreset } from "../data/presets";
import { generateScratchExtension } from "./scratchExtension";

interface ScratchExtensionInstance { probability(args: { X: number; Y: number }): number; hidden(args: { X: number; Y: number; N: number }): number; category(args: { X: number; Y: number }): number; }

describe("Scratch export", () => {
  it("uses the same calculation as the web model", () => {
    const model = train(initializeNetwork({ hiddenUnits: 2, activation: "tanh", learningRate: 0.08, seed: 19 }), clonePreset("xor"), 125);
    let registered: ScratchExtensionInstance | null = null;
    const Scratch = {
      extensions: { unsandboxed: true, register(value: ScratchExtensionInstance) { registered = value; } },
      BlockType: { REPORTER: "reporter" }, ArgumentType: { NUMBER: "number" },
    };
    new Function("Scratch", generateScratchExtension(model))(Scratch);
    expect(registered).not.toBeNull();
    const extension = registered as unknown as ScratchExtensionInstance;
    const args = { X: -0.37, Y: 0.61 };
    const web = forward(model, args.X, args.Y);
    expect(extension.probability(args)).toBeCloseTo(web.probability, 12);
    expect(extension.hidden({ ...args, N: 1 })).toBeCloseTo(web.hidden[0] ?? 0, 12);
    expect(extension.category(args)).toBe(web.probability >= 0.5 ? 1 : 0);
  });
});

