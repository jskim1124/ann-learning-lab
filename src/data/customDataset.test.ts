import { describe, expect, it } from "vitest";
import { centroidAccuracy, createCustomDraft, createCustomExample, projectCustomDataset, validateCustomDataset } from "./customDataset";

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
});
