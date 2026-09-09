import { describe, expect, it } from "vitest";
import { PixelLabStore } from "./pixelLabStore";

describe("그림 지도 설명 상태", () => {
  it("최종 경계부터 시작하고 점을 고르면 해당 학습 그림을 설명한다", () => {
    const store = new PixelLabStore("digits");
    expect(store.snapshot.view).toBe("decision");
    store.selectMapExample(4);
    expect(store.snapshot.mapExampleIndex).toBe(4);
    store.paint(0, 1);
    expect(store.snapshot.mapExampleIndex).toBeNull();
  });

  it("뉴런 신호와 최종 판단 화면을 오갈 수 있다", () => {
    const store = new PixelLabStore("omr");
    store.setView("neurons"); expect(store.snapshot.view).toBe("neurons");
    store.setView("decision"); expect(store.snapshot.view).toBe("decision");
  });

  it.each(["digits", "omr"] as const)("%s의 두 그림 기준으로 실제 분류 성능을 낸다", (task) => {
    const store = new PixelLabStore(task); store.train(300);
    expect(store.metrics().accuracy).toBeGreaterThan(.8);
  });
});
