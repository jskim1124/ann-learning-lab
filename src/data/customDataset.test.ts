import { describe, expect, it } from "vitest";
import { addCustomClass, centroidAccuracy, createCustomDraft, createCustomExample, featuresForInput, projectCustomDataset, removeCustomClass, textFeatures, validateCustomDataset } from "./customDataset";

describe("직접 정한 숫자·텍스트 자료", () => {
  it("빈 자료와 같은 가로·세로 특징을 막는다", () => {
    expect(validateCustomDataset(createCustomDraft())).toMatch(/클래스마다 사례를 두 개/);
    const example = createCustomExample(); example.yFeature = example.xFeature;
    expect(validateCustomDataset(example)).toMatch(/서로 다른/);
  });
  it("분리하기 좋은 특징 조합을 실제 좌표로 비교한다", () => {
    const draft = createCustomExample(), strong = centroidAccuracy(projectCustomDataset(draft).points);
    draft.xFeature = 1; draft.yFeature = 2;
    expect(strong).toBeGreaterThan(centroidAccuracy(projectCustomDataset(draft).points));
  });
  it("텍스트는 뜻이 아니라 명시한 글자 통계로 계산한다", () => {
    expect(textFeatures("안녕 2026")).toEqual([6,2,expect.closeTo(500/6,10),expect.closeTo(400/6,10)]);
    expect(textFeatures("")).toEqual([0,0,0,0]);
  });
  it("이미지 입력은 임의의 다섯 특징으로 바꾸지 않는다", () => {
    expect(featuresForInput("webcam")).toEqual([]);
    expect(featuresForInput("drawing")).toEqual([]);
  });
  it("클래스 삭제 시 사례 번호를 다시 연결하고 최소 두 클래스를 지킨다", () => {
    const draft = createCustomExample(); expect(addCustomClass(draft,"C 종류")).toBeNull();
    draft.rows.push({ id:9, name:"관찰 9", label:2, values:[5,5,5] });
    expect(removeCustomClass(draft,1)).toBeNull();
    expect(draft.classes).toEqual(["A 종류","C 종류"]);
    expect(draft.rows.find((r) => r.id === 9)?.label).toBe(1);
    expect(removeCustomClass(draft,0)).toMatch(/두 개 이상/);
  });
});
