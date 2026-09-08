import { describe, expect, it } from "vitest";
import { initializeNetwork } from "./initialization";
import { activate, evaluate, forward, sigmoid, train, trainOne } from "./neuralNetwork";
import { clonePreset } from "../data/presets";
import { createStoredModel, parseStoredModel } from "./modelSchema";
import { serializeModel } from "../export/modelJson";

const config = { hiddenUnits: 2, activation: "tanh" as const, learningRate: 0.08, seed: 19 };

describe("neural network engine", () => {
  it("reproduces a forward pass for the same model and input", () => {
    const model = initializeNetwork(config);
    expect(forward(model, 0.25, -0.4)).toEqual(forward(structuredClone(model), 0.25, -0.4));
  });

  it("calculates sigmoid, tanh, and ReLU correctly", () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 12);
    expect(activate(0.7, "tanh")).toBeCloseTo(Math.tanh(0.7), 12);
    expect(activate(-2, "relu")).toBe(0);
    expect(activate(0.7, "sigmoid")).toBeCloseTo(sigmoid(0.7), 12);
  });

  it("usually decreases loss after a training step", () => {
    const data = clonePreset("xor");
    const before = initializeNetwork(config);
    const after = trainOne(before, data);
    expect(evaluate(after, data).loss ?? 1).toBeLessThan(evaluate(before, data).loss ?? 0);
  });

  it("restores predictions exactly after JSON serialization", () => {
    const data = clonePreset("xor");
    const trained = train(initializeNetwork(config), data, 50);
    const metrics = evaluate(trained, data);
    const stored = createStoredModel("xor", data, trained, metrics.loss ?? 0, metrics.accuracy ?? 0);
    const restored = parseStoredModel(serializeModel(stored));
    expect(forward(restored.model, -0.33, 0.72).probability).toBeCloseTo(forward(trained, -0.33, 0.72).probability, 14);
  });

  it("rejects parameter-size mismatches", () => {
    const model = initializeNetwork(config);
    const metrics = evaluate(model, clonePreset("xor"));
    const stored = createStoredModel("xor", clonePreset("xor"), model, metrics.loss ?? 0, metrics.accuracy ?? 0);
    stored.model.parameters.hiddenBias.pop();
    expect(() => parseStoredModel(JSON.stringify(stored))).toThrow(/파라미터 크기/);
  });
});
