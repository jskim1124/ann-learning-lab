import { describe, expect, it } from "vitest";
import { ImageLabStore } from "./imageLabStore";
import { createPixelProjection, projectPixels, reconstructProjectedPixels } from "../core/pixelProjection";
import { forwardPixels } from "../core/pixelNetwork";

describe("공통 이미지 학습 상태", () => {
  it("웹캠은 빈 가위바위보 자료와 196칸 전체 모델로 시작한다", () => {
    const store = new ImageLabStore("webcam");
    expect(store.snapshot.classes).toEqual(["가위", "바위", "보"]);
    expect(store.snapshot.data).toEqual([]);
    expect(store.snapshot.mode).toBe("pixels");
    expect(store.snapshot.model.inputHidden.every((weights) => weights.length === 196)).toBe(true);
    expect(store.coverageError()).toContain("가위");
  });
  it("사진을 추가해도 196칸과 원본을 변형하지 않고 맨 앞에 복사한다", () => {
    const store = new ImageLabStore("webcam"), pixels = Array.from({ length: 196 }, (_, i) => i / 195);
    store.setInput(pixels, "data:image/jpeg;base64,example", "webcam"); store.selectClass(2); store.addInput();
    const sample = store.snapshot.data[0]!;
    expect(sample.pixels).toEqual(pixels); expect(sample.source).toBe("webcam"); expect(sample.label).toBe(2);
    expect(sample.image).toBe("data:image/jpeg;base64,example");
    pixels[0] = .8; store.setInput(Array(196).fill(0));
    expect(sample.pixels[0]).toBe(0);
  });
  it.each(["digits", "omr"] as const)("%s 기본 모델은 실제로 그림 전체를 학습한다", (task) => {
    const store = new ImageLabStore(task), before = store.metrics().loss;
    expect(store.train(250)).toBeNull();
    expect(store.metrics().loss).toBeLessThan(before * .35);
    expect(store.metrics().accuracy).toBeGreaterThan(.9);
    const s = store.snapshot, weights = s.model.inputHidden[0]!;
    const horizontal = weights.reduce((sum, w, i) => sum + w * s.projection.horizontal[i]!, 0);
    const vertical = weights.reduce((sum, w, i) => sum + w * s.projection.vertical[i]!, 0);
    const residual = weights.reduce((sum, w, i) => sum + (w - horizontal * s.projection.horizontal[i]! - vertical * s.projection.vertical[i]!) ** 2, 0);
    expect(residual).toBeGreaterThan(.01); // Full model is not secretly restricted to two directions.
  });
  it("별도 지도 실험에서만 점의 예상과 배경의 예상이 수치까지 일치한다", () => {
    const store = new ImageLabStore("omr"); store.setMode("map"); store.setFeature("position"); store.train(20);
    const s = store.snapshot;
    s.data.forEach((sample) => {
      const p = projectPixels(s.projection, sample.pixels);
      const actual = forwardPixels(s.model, sample.pixels).probabilities;
      const surface = forwardPixels(s.model, reconstructProjectedPixels(s.projection, p.x, p.y)).probabilities;
      actual.forEach((v, i) => expect(surface[i]).toBeCloseTo(v, 10));
    });
  });
  it("클래스 추가와 삭제는 자료 번호·출력 개수·학습 상태를 함께 바꾼다", () => {
    const store = new ImageLabStore("digits"); store.train(1); store.addClass("3");
    expect(store.snapshot.model.epoch).toBe(0); expect(store.snapshot.model.classCount).toBe(4);
    expect(store.coverageError()).toContain("3");
    store.setInput(Array(196).fill(.3)); store.addInput(); store.setInput(Array(196).fill(.4)); store.addInput();
    expect(store.coverageError()).toBeNull();
    const sampleId = store.snapshot.data[0]!.id; store.removeClass(1);
    expect(store.snapshot.classes).toEqual(["0", "2", "3"]);
    expect(store.snapshot.data.find((s) => s.id === sampleId)?.label).toBe(2);
    expect(store.snapshot.data.every((s) => s.label < 3)).toBe(true);
  });
  it("새 그림 점수만 기록하고 같은 그림의 중복 기록을 막는다", () => {
    const store = new ImageLabStore(); store.train(2);
    store.setInput(store.snapshot.data[0]!.pixels); expect(store.recordTest(0)).toContain("새 그림");
    store.setInput(Array(196).fill(.456)); expect(store.recordTest(0)).toBeNull();
    expect(store.recordTest(0)).toContain("이미 기록"); expect(store.snapshot.testCount).toBe(1);
    store.train(1); expect(store.snapshot.testCount).toBe(0); expect(store.recordTest(0)).toBeNull();
  });
  it("지도 방향을 정할 때 정답 이름을 미리 보지 않는다", () => {
    const store = new ImageLabStore("digits"), data = store.snapshot.data;
    expect(createPixelProjection(data.map((s) => ({ ...s, label: (s.label + 1) % 3 })))).toEqual(createPixelProjection(data));
    const binary = data.filter((s) => s.label < 2), projection = createPixelProjection(binary);
    expect(projection.vertical.reduce((sum, v) => sum + v * v, 0)).toBeCloseTo(1, 10);
    expect(projection.horizontal.reduce((sum, v, i) => sum + v * projection.vertical[i]!, 0)).toBeCloseTo(0, 10);
  });
  it("탐색 지도와 학습 지도는 똑같은 고정 계산을 사용한다", async () => {
    const { pixelFeatureCoordinates } = await import("../visualization/pixelLatentMap");
    const store = new ImageLabStore("omr"); store.setFeature("position");
    const { data, projection } = store.snapshot;
    const points = pixelFeatureCoordinates(data, projection, "omr", "position");
    expect(points).toEqual(data.map((s) => projectPixels(projection, s.pixels)));
    expect(pixelFeatureCoordinates([...data, { pixels: Array(196).fill(1), label: 0 }], projection, "omr", "position").slice(0, data.length)).toEqual(points);
  });
});
