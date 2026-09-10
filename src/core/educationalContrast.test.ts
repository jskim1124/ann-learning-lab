import { describe, expect, it } from "vitest";
import { initializeNetwork } from "./initialization";
import { evaluate, train } from "./neuralNetwork";
import { clonePreset } from "../data/presets";
import { hiddenNodeCount, networkGraphMarkup } from "../visualization/networkGraph";

describe("educational contrast", () => {
  it("shows a stronger XOR result with two hidden units under fixed conditions", () => {
    const data = clonePreset("xor");
    const one = train(initializeNetwork({ hiddenUnits: 1, activation: "tanh", learningRate: 0.08, seed: 19 }), data, 1000);
    const two = train(initializeNetwork({ hiddenUnits: 2, activation: "tanh", learningRate: 0.08, seed: 19 }), data, 1000);
    const oneMetrics = evaluate(one, data);
    const twoMetrics = evaluate(two, data);
    expect(twoMetrics.accuracy ?? 0).toBeGreaterThan(oneMetrics.accuracy ?? 0);
    expect(twoMetrics.loss ?? 1).toBeLessThan(oneMetrics.loss ?? 0);
    expect(twoMetrics.correct).toBe(4);
  });

  it("keeps parameter and graph node counts aligned", () => {
    const model = initializeNetwork({ hiddenUnits: 5, activation: "relu", learningRate: 0.08, seed: 19 });
    expect(model.parameters.inputHidden).toHaveLength(5);
    expect(model.parameters.hiddenOutput).toHaveLength(5);
    expect(hiddenNodeCount(networkGraphMarkup(model, Array(5).fill(0)))).toBe(5);
  });

  it.each([
    ["sound", 2, 1000, 0.83],
    ["sketch", 4, 2000, 0.84],
    ["digits", 4, 2000, 0.84],
  ] as const)("learns the visible %s investigation", (preset, hiddenUnits, epochs, minimumAccuracy) => {
    const data = clonePreset(preset);
    const model = train(initializeNetwork({ hiddenUnits, activation: "tanh", learningRate: 0.08, seed: 19 }), data, epochs);
    expect(evaluate(model, data).accuracy ?? 0).toBeGreaterThanOrEqual(minimumAccuracy);
  });
});
