import { describe, expect, it } from "vitest";
import { addCustomClass, centroidAccuracy, createCustomDraft, createCustomExample, createWebcamDraft, differenceFeatures, imageFeatures, projectCustomDataset, removeCustomClass, textFeatures, validateCustomDataset } from "./customDataset";

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
    expect(validateCustomDataset(draft)).toMatch(/클래스마다 사례를 두 개/);
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

  it("웹캠 활동은 가위바위보 세 클래스와 구별에 쓸 두 특징으로 연다", () => {
    const draft = createWebcamDraft();
    expect(draft.inputKind).toBe("webcam");
    expect(draft.classes).toEqual(["가위", "바위", "보"]);
    expect(projectCustomDataset(draft).axes).toEqual(["손 모양이 차지한 양", "위쪽 갈라짐"]);
  });

  it("자유 문제의 클래스는 추가·삭제되고 지운 클래스의 사례와 번호도 함께 정리된다", () => {
    const draft = createCustomExample(); expect(addCustomClass(draft, "C 종류")).toBeNull();
    draft.rows.push({ id: 9, name: "관찰 9", label: 2, values: [5, 5, 5] });
    expect(removeCustomClass(draft, 1)).toBeNull();
    expect(draft.classes).toEqual(["A 종류", "C 종류"]); expect(draft.rows.some((row) => row.label === 2)).toBe(false); expect(draft.rows.some((row) => row.label === 1)).toBe(true);
    expect(removeCustomClass(draft, 0)).toMatch(/두 개 이상/);
  });

  it("웹캠 배경과 달라진 부분의 위치만 특징으로 잰다", () => {
    const background = new Uint8ClampedArray(4 * 3 * 4).fill(255);
    const left = background.slice();
    for (let y = 0; y < 3; y += 1) { const offset = (y * 4) * 4; left[offset] = 0; left[offset + 1] = 0; left[offset + 2] = 0; }
    const values = differenceFeatures(left, background, 4, 3);
    expect(values[0]).toBeGreaterThan(20);
    expect(values[1]).toBeLessThan(1);
  });

  it("위쪽이 두 갈래인 손 모양은 한 덩어리보다 갈라짐 점수가 높다", () => {
    const onePiece = new Uint8ClampedArray(6 * 6 * 4).fill(255);
    const twoPieces = onePiece.slice();
    const darken = (image: Uint8ClampedArray, x: number, y: number) => { const offset = (y * 6 + x) * 4; image[offset] = 0; image[offset + 1] = 0; image[offset + 2] = 0; image[offset + 3] = 255; };
    for (let y = 0; y < 5; y += 1) { darken(onePiece, 2, y); darken(onePiece, 3, y); darken(twoPieces, 1, y); darken(twoPieces, 4, y); }
    expect(imageFeatures(twoPieces, 6, 6)[4]).toBeGreaterThan(imageFeatures(onePiece, 6, 6)[4] ?? 0);
  });
});
