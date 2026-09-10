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

  it("완료한 이해 장면은 이전과 다음 장면으로 다시 오갈 수 있다", () => {
    const store = new PixelLabStore("digits"); store.nextUnderstand(); store.nextUnderstand();
    store.setUnderstandStep(1); expect(store.snapshot.understandStep).toBe(1);
    store.setUnderstandStep(3); expect(store.snapshot.understandStep).toBe(3);
    store.setUnderstandStep(4); expect(store.snapshot.understandStep).toBe(3);
  });

  it("연습 특징을 바꾸면 해당 지도로 모델을 처음부터 다시 만든다", () => {
    const store = new PixelLabStore("omr"); const learned = store.snapshot.projection.horizontal;
    store.train(2); store.setTrainingFeature("position");
    expect(store.snapshot.trainingFeatureView).toBe("position"); expect(store.snapshot.model.epoch).toBe(0);
    expect(store.snapshot.projection.horizontal).not.toEqual(learned);
  });

  it("직접 그린 자료는 맨 앞에 추가되고 해당 특징 지도도 다시 계산한다", () => {
    const store = new PixelLabStore("omr"); const originalLength = store.snapshot.data.length; store.clear(); store.paintMany([2, 3, 17], 1); store.selectLabel(4); store.addDrawing();
    expect(store.snapshot.data).toHaveLength(originalLength + 1); expect(store.snapshot.data[0]?.label).toBe(4); expect(store.snapshot.data[0]?.pixels[2]).toBe(1); expect(store.snapshot.latestAddedIndex).toBe(0); expect(store.snapshot.model.epoch).toBe(0);
    expect(store.snapshot.drawing).toEqual(store.snapshot.data[0]?.pixels);
    expect(store.snapshot.drawing).not.toBe(store.snapshot.data[0]?.pixels);
  });

  it("추가한 그림을 고친 뒤에는 이전 자료가 방금 추가로 남지 않는다", () => {
    const store = new PixelLabStore("digits"); store.addDrawing(); expect(store.snapshot.latestAddedIndex).toBe(0);
    store.paint(0, 1); expect(store.snapshot.latestAddedIndex).toBeNull();
  });

  it.each([["digits", "3"], ["omr", "미표기"]] as const)("%s에 새 클래스를 더하면 출력 뉴런과 새 자료가 함께 늘어난다", (task, name) => {
    const store = new PixelLabStore(task); const originalClassCount = store.snapshot.classes.length; const originalDataCount = store.snapshot.data.length;
    expect(store.addClass(name)).toBeNull();
    expect(store.snapshot.classes).toHaveLength(originalClassCount + 1); expect(store.snapshot.classes.at(-1)).toBe(name);
    expect(store.snapshot.selectedLabel).toBe(originalClassCount); expect(store.snapshot.model.classCount).toBe(originalClassCount + 1); expect(store.snapshot.model.epoch).toBe(0);
    store.clear(); store.paintMany([15, 16, 29, 30], 1); store.addDrawing(); store.train(1);
    expect(store.snapshot.data).toHaveLength(originalDataCount + 1); expect(store.snapshot.data[0]?.label).toBe(originalClassCount); expect(store.probabilities()).toHaveLength(originalClassCount + 1);
  });

  it("빈 이름과 같은 이름은 새 클래스로 추가하지 않는다", () => {
    const store = new PixelLabStore("digits"); const before = store.snapshot.classes;
    expect(store.addClass("   ")).toBe("새 클래스 이름을 입력해 주세요.");
    expect(store.addClass("0")).toBe("이미 있는 클래스 이름입니다.");
    expect(store.snapshot.classes).toEqual(before);
  });

  it("삐져나간 OMR 자국에서도 진한 위치 특징이 유용한 분류 성능을 낸다", () => {
    const store = new PixelLabStore("omr"); store.setTrainingFeature("position"); store.setHiddenUnits(6); store.train(1000);
    expect(store.metrics().accuracy).toBeGreaterThan(.8);
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
