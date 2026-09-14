import { describe, expect, it } from "vitest";
import { centroidAccuracy, createCustomDraft, createCustomExample, createWebcamDraft, differenceFeatures, imageFeatures, projectCustomDataset, textFeatures, validateCustomDataset } from "./customDataset";

describe("직접 만드는 자료", () => {
  it("고른 두 특징을 -0.9부터 0.9 사이의 점으로 바꾼다", () => {
    const draft = createCustomExample();
    draft.xFeature = 1; draft.yFeature = 2;
    const projection = projectCustomDataset(draft);
    expect(projection.axes).toEqual(["무게", "밝기"]);
    expect(projection.points).toHaveLength(draft.rows.length);
    expect(projection.points.every((point) => Math.abs(point.x) <= .9 && Math.abs(point.y) <= .9)).toBe(true);
  });

  it("빈 자료와 같은 가로·세로 특징을 막는다", () => {
    const draft = createCustomDraft();
    expect(validateCustomDataset(draft)).toMatch(/네 개/);
    const example = createCustomExample(); example.yFeature = example.xFeature;
    expect(validateCustomDataset(example)).toMatch(/서로 다른/);
  });

  it("분리하기 좋은 특징 조합을 수치로 비교한다", () => {
    const draft = createCustomExample();
    const strong = centroidAccuracy(projectCustomDataset(draft).points);
    draft.xFeature = 1; draft.yFeature = 2;
    const weak = centroidAccuracy(projectCustomDataset(draft).points);
    expect(strong).toBeGreaterThan(weak);
  });

  it("텍스트와 그림을 비교 가능한 숫자 특징으로 바꾼다", () => {
    expect(textFeatures("안녕 2026")).toEqual([6, 2, expect.any(Number), expect.any(Number)]);
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const features = imageFeatures(pixels, 2, 1);
    expect(features[0]).toBe(50); expect(features[1]).toBe(0);
  });

  it("웹캠 활동은 손의 가로 위치를 첫 번째 지도 특징으로 연다", () => {
    const draft = createWebcamDraft();
    expect(draft.inputKind).toBe("webcam");
    expect(draft.classes).toEqual(["손이 왼쪽", "손이 오른쪽"]);
    expect(projectCustomDataset(draft).axes).toEqual(["손의 가로 위치", "배경과 달라진 양"]);
  });

  it("웹캠 배경과 달라진 부분의 위치만 특징으로 잰다", () => {
    const background = new Uint8ClampedArray(4 * 3 * 4).fill(255);
    const left = background.slice();
    for (let y = 0; y < 3; y += 1) { const offset = (y * 4) * 4; left[offset] = 0; left[offset + 1] = 0; left[offset + 2] = 0; }
    const values = differenceFeatures(left, background, 4, 3);
    expect(values[0]).toBeGreaterThan(20);
    expect(values[1]).toBeLessThan(1);
  });
});
