import { beforeEach, describe, expect, it, vi } from "vitest";
import { LabStore } from "./labStore";

describe("lab interactions", () => {
  beforeEach(() => localStorage.clear());

  it("adds and undoes points while resetting learned history", () => {
    const store = new LabStore();
    store.trainEpochs(10);
    const previousLength = store.snapshot.data.length;
    store.addDataPoint(0.2, -0.3);
    expect(store.snapshot.data).toHaveLength(previousLength + 1);
    expect(store.snapshot.model.epoch).toBe(0);
    expect(store.snapshot.history).toHaveLength(1);
    store.undoDataPoint();
    expect(store.snapshot.data).toHaveLength(previousLength);
  });

  it("rejects empty and single-class training data", () => {
    const store = new LabStore();
    store.setPreset("custom");
    expect(store.trainEpochs(1)).toMatch(/두 범주/);
    store.addDataPoint(0, 0);
    expect(store.trainEpochs(1)).toMatch(/범주 0과 범주 1/);
  });

  it("changes tabs and synchronizes clamped probe input", () => {
    const store = new LabStore();
    store.setView("neurons");
    store.setTestInput(3, -4);
    expect(store.snapshot.view).toBe("neurons");
    expect(store.snapshot.testInput).toEqual({ x: 1, y: -1 });
  });

  it("moves through the causal explanation and quiz without changing the model", () => {
    const store = new LabStore();
    const model = store.snapshot.model;
    store.setExplanationStep(3);
    store.setSelectedNeuron(1);
    store.answerQuiz("no");
    expect(store.snapshot).toMatchObject({ explanationStep: 3, selectedNeuron: 1, quizAnswer: "no" });
    expect(store.snapshot.model).toBe(model);
    store.nextQuiz();
    expect(store.snapshot).toMatchObject({ explanationStep: 4, quizAnswer: null });
  });

  it("opens lessons in order and selects the recommended model size", () => {
    const store = new LabStore();
    store.setPreset("focus");
    expect(store.snapshot.model.config.hiddenUnits).toBe(4);
    store.nextLesson();
    expect(store.snapshot).toMatchObject({ lessonStep: 2, furthestLessonStep: 2 });
  });

  it("records and deletes trained experiments", () => {
    const store = new LabStore();
    expect(store.saveExperiment()).toMatch(/먼저/);
    store.trainEpochs(1);
    expect(store.saveExperiment()).toBeNull();
    expect(store.snapshot.experiments).toHaveLength(1);
    store.deleteExperiment(store.snapshot.experiments[0]?.id ?? "missing");
    expect(store.snapshot.experiments).toHaveLength(0);
  });

  it("persists validated settings for the next session", () => {
    const first = new LabStore();
    first.setPreset("and");
    first.setConfig({ hiddenUnits: 4, activation: "relu", learningRate: 0.12 });
    const restored = new LabStore();
    expect(restored.snapshot.preset).toBe("and");
    expect(restored.snapshot.model.config).toMatchObject({ hiddenUnits: 4, activation: "relu", learningRate: 0.12 });
  });

  it("starts and pauses continuous training", () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 1));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    const store = new LabStore();
    expect(store.toggleAuto()).toBeNull();
    expect(store.snapshot.autoTraining).toBe(true);
    store.toggleAuto();
    expect(store.snapshot.autoTraining).toBe(false);
    vi.unstubAllGlobals();
  });
});
