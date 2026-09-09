import { describe, expect, it } from "vitest";
import { PixelLabStore } from "./pixelLabStore";

describe("그림 지도 설명 상태", () => {
  it("그림 위치부터 시작하고 점을 고르면 해당 학습 그림을 설명한다", () => {
    const store = new PixelLabStore("digits");
    expect(store.snapshot.view).toBe("placement");
    store.selectMapExample(4);
    expect(store.snapshot.mapExampleIndex).toBe(4);
    store.paint(0, 1);
    expect(store.snapshot.mapExampleIndex).toBeNull();
  });

  it("좌표·뉴런 신호·최종 판단 화면을 순서와 관계없이 다시 볼 수 있다", () => {
    const store = new PixelLabStore("omr");
    store.setView("neurons"); expect(store.snapshot.view).toBe("neurons");
    store.setView("decision"); expect(store.snapshot.view).toBe("decision");
    store.setView("placement"); expect(store.snapshot.view).toBe("placement");
  });
});
