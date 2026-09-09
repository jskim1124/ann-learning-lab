import { describe, expect, it } from "vitest";
import { PixelLabStore } from "./pixelLabStore";

describe("그림 지도 설명 상태", () => {
  it("최종 경계부터 시작하고 점을 고르면 해당 학습 그림을 설명한다", () => {
    const store = new PixelLabStore("digits");
    expect(store.snapshot.showNeuronBoundaries).toBe(true); expect(store.snapshot.showDecisionBoundary).toBe(true);
    store.selectMapExample(4);
    expect(store.snapshot.mapExampleIndex).toBe(4);
    store.paint(0, 1);
    expect(store.snapshot.mapExampleIndex).toBeNull();
  });

  it("뉴런 분류선과 최종 경계를 독립적으로 겹쳐 볼 수 있다", () => {
    const store = new PixelLabStore("omr");
    store.setLayers({ showNeuronBoundaries: false }); expect(store.snapshot.showNeuronBoundaries).toBe(false); expect(store.snapshot.showDecisionBoundary).toBe(true);
    store.setLayers({ showNeuronBoundaries: true, showDecisionBoundary: false }); expect(store.snapshot.showNeuronBoundaries).toBe(true); expect(store.snapshot.showDecisionBoundary).toBe(false);
  });

  it("서로 다른 특징 후보를 같은 자료로 비교한다", () => {
    const store = new PixelLabStore("omr");
    store.setFeatureView("ink"); expect(store.snapshot.featureView).toBe("ink");
    store.setFeatureView("learned"); store.setFeatureView("position"); expect(store.snapshot.featureView).toBe("position");
    expect(store.snapshot.exploredFeatures).toEqual(["ink", "learned", "position"]);
  });

  it("대표 한 칸의 점수 계산을 세 단계로 따라간다", () => {
    const store = new PixelLabStore("digits"); store.nextUnderstand(); store.revealHighlight();
    expect(store.snapshot).toMatchObject({ understandStep: 2, scoreCalcStep: 1 });
    store.advanceScoreCalc(); store.advanceScoreCalc(); store.advanceScoreCalc();
    expect(store.snapshot.scoreCalcStep).toBe(3);
    store.nextUnderstand(); expect(store.snapshot.scoreCalcStep).toBe(0);
  });

  it.each(["digits", "omr"] as const)("%s의 두 그림 기준으로 실제 분류 성능을 낸다", (task) => {
    const store = new PixelLabStore(task); store.train(300);
    expect(store.metrics().accuracy).toBeGreaterThan(.8);
  });

  it("규칙 칸 수와 중간값 방식을 바꾸면 같은 자료로 처음부터 다시 연습한다", () => {
    const store = new PixelLabStore("digits"); store.train(3);
    store.setHiddenUnits(1);
    expect(store.snapshot.model.hiddenUnits).toBe(1); expect(store.snapshot.model.epoch).toBe(0);
    store.setActivation("sigmoid");
    expect(store.snapshot.model.activation).toBe("sigmoid"); expect(store.snapshot.model.hiddenUnits).toBe(1); expect(store.snapshot.model.epoch).toBe(0);
  });
});
