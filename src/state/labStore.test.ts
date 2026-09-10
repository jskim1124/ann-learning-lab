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

  it("keeps the switch problem selected when a point is added or undone", () => {
    const store = new LabStore();
    store.setPreset("xor");
    const previousLength = store.snapshot.data.length;
    store.addDataPoint(0.2, -0.3);
    expect(store.snapshot.preset).toBe("xor");
    expect(store.snapshot.data).toHaveLength(previousLength + 1);
    store.undoDataPoint();
    expect(store.snapshot.preset).toBe("xor");
    expect(store.snapshot.data).toHaveLength(previousLength);
  });

  it("rejects empty and single-class training data", () => {
    const store = new LabStore();
    store.setPreset("custom");
    expect(store.trainEpochs(1)).toMatch(/두 범주/);
    store.addDataPoint(0, 0);
    expect(store.trainEpochs(1)).toMatch(/범주 0과 범주 1/);
  });

  it("직접 입력한 자료를 새 모델에 넣는다", () => {
    const store = new LabStore();
    store.setCustomData([{ x: -.5, y: -.4, label: 0 }, { x: .5, y: .4, label: 1 }]);
    expect(store.snapshot).toMatchObject({ preset: "custom", data: [{ x: -.5, y: -.4, label: 0 }, { x: .5, y: .4, label: 1 }] });
    expect(store.snapshot.model.epoch).toBe(0);
  });

  it("분류선과 최종 경계선을 독립적으로 겹쳐 보고 탐침 입력을 제한한다", () => {
    const store = new LabStore();
    expect(store.snapshot).toMatchObject({ showNeuronBoundaries: true, showDecisionBoundary: true });
    store.setLayers({ showNeuronBoundaries: false });
    store.setTestInput(3, -4);
    expect(store.snapshot).toMatchObject({ showNeuronBoundaries: false, showDecisionBoundary: true });
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
    store.setPreset("sketch");
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
    first.setPreset("digits");
    first.setConfig({ hiddenUnits: 4, activation: "relu", learningRate: 0.12 });
    const restored = new LabStore();
    expect(restored.snapshot.preset).toBe("digits");
    expect(restored.snapshot.model.config).toMatchObject({ hiddenUnits: 4, activation: "relu", learningRate: 0.12 });
  });

  it("reveals one highlighted change before resetting the next quiz", () => {
    const store = new LabStore();
    store.revealHighlight();
    expect(store.snapshot.highlightRevealed).toBe(true);
    store.answerQuiz("height"); store.nextQuiz();
    expect(store.snapshot).toMatchObject({ explanationStep: 2, highlightRevealed: false, quizAnswer: null });
  });

  it("shows a completed example before starting the learner's own practice", () => {
    const store = new LabStore();
    expect(store.prepareExplanationModel()).toBeNull();
    expect(store.snapshot.model.epoch).toBe(store.snapshot.epochGoal);
    store.setLessonStep(3); store.beginPractice();
    expect(store.snapshot).toMatchObject({ lessonStep: 4 });
    expect(store.snapshot.model.epoch).toBe(0);
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
