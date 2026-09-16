import { describe, expect, it } from "vitest";
import { FeatureLabStore } from "./featureLabStore";

describe("여러 클래스를 쓰는 특징 지도 모델", () => {
  it("세 클래스가 실제 출력 뉴런 세 개와 확률 세 개를 만든다", () => {
    const store = new FeatureLabStore();
    store.setDataset([
      { x: -.8, y: -.8, label: 0 }, { x: -.7, y: -.6, label: 0 },
      { x: .8, y: -.8, label: 1 }, { x: .7, y: -.6, label: 1 },
      { x: 0, y: .8, label: 2 }, { x: .1, y: .6, label: 2 },
    ], ["가위", "바위", "보"]);
    store.setHiddenUnits(3); store.train(500);
    expect(store.snapshot.model.classCount).toBe(3);
    expect(store.probabilities()).toHaveLength(3);
    expect(store.probabilities().reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 8);
    expect(store.metrics().accuracy).toBeGreaterThan(.8);
  });

  it("클래스 구성이 바뀌면 학습 전 모델로 다시 만든다", () => {
    const store = new FeatureLabStore(); store.train(2);
    store.setDataset([{ x: -1, y: 0, label: 0 }, { x: 1, y: 0, label: 1 }], ["A", "B"]);
    expect(store.snapshot.model.epoch).toBe(0); expect(store.snapshot.model.classCount).toBe(2);
  });
});
