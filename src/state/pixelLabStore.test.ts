import { describe, expect, it } from "vitest";
import { PixelLabStore } from "./pixelLabStore";

describe("그림 지도 설명 상태", () => {
  it("최종 경계부터 시작하고 점을 고르면 해당 학습 그림을 설명한다", () => {
    const store = new PixelLabStore("digits");
    expect(store.snapshot.showNeuronGradient).toBe(true); expect(store.snapshot.showDecisionBoundary).toBe(true);
    store.selectMapExample(4);
    expect(store.snapshot.mapExampleIndex).toBe(4);
    store.paint(0, 1);
    expect(store.snapshot.mapExampleIndex).toBeNull();
  });

  it("뉴런 분류선과 최종 경계를 독립적으로 겹쳐 볼 수 있다", () => {
    const store = new PixelLabStore("omr");
    store.setLayers({ showNeuronGradient: false }); expect(store.snapshot.showNeuronGradient).toBe(false); expect(store.snapshot.showDecisionBoundary).toBe(true);
    store.setLayers({ showNeuronGradient: true, showDecisionBoundary: false }); expect(store.snapshot.showNeuronGradient).toBe(true); expect(store.snapshot.showDecisionBoundary).toBe(false);
  });

  it.each(["digits", "omr"] as const)("%s의 두 그림 기준으로 실제 분류 성능을 낸다", (task) => {
    const store = new PixelLabStore(task); store.train(300);
    expect(store.metrics().accuracy).toBeGreaterThan(.8);
  });
});
