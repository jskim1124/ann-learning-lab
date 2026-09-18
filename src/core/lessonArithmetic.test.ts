import { describe, expect, it } from "vitest";
import { biasDirectionExample, interpolatePixelModel, numberChoices, outputScoreBreakdown, outputTeachingModel, smallFeatureExample } from "./lessonArithmetic";
import { forwardPixels } from "./pixelNetwork";

describe("한눈에 따라 계산하는 작은 예제", () => {
  it("4×4 칸의 몫을 더한 값과 문제 정답이 같다", () => {
    const expected: Record<string,number> = { ink:4.5, lr:-.5, tb:.5, center:3.5, position:11 };
    for (const [kind,value] of Object.entries(expected)) {
      const example=smallFeatureExample(kind);
      expect(example.calculation.total).toBe(value);
      expect(example.calculation.positive+example.calculation.negative).toBe(value);
      expect(numberChoices(value).filter(v=>v===value)).toHaveLength(1);
    }
  });
  it("한 값만 바꾼 비교 실험은 그 값만 바꾸며 정답 점수가 실제로 오른다", () => {
    const {frames,point,candidates}=biasDirectionExample();
    expect(candidates[2]!.probability).toBeGreaterThan(candidates[0]!.probability);
    frames.slice(1).forEach((frame,i)=>{
      expect(frame.inputHidden).toEqual(frames[0]!.inputHidden);
      expect(frame.hiddenOutput).toEqual(frames[0]!.hiddenOutput);
      expect(frame.hiddenBias[0]!-frames[i]!.hiddenBias[0]!).toBeCloseTo(.1,12);
      expect(forwardPixels(frame,point).probabilities[1]).toBeGreaterThan(forwardPixels(frames[i]!,point).probabilities[1]!);
    });
    expect(forwardPixels(frames[0]!,point).probabilities[1]).toBeLessThan(.5);
    expect(forwardPixels(frames.at(-1)!,point).probabilities[1]).toBeGreaterThan(.5);
  });
  it("출력값은 변환된 뉴런 신호에 연결값을 곱한 합이다",()=>{
    const model=outputTeachingModel(), values=forwardPixels(model,[.4,.2]);
    expect(values.hidden[0]).toBeCloseTo(.4+.2*.5);
    expect(values.logits[0]).toBeCloseTo(-values.hidden[0]!+1);
    expect(values.logits[2]).toBeCloseTo(values.hidden[0]!*.5+values.hidden[1]!+.3);
  });
  it("애니메이션 중간 계산과 경계 위치도 실제 모델과 일치한다",()=>{
    const {frames,point}=biasDirectionExample(), original=JSON.stringify(frames);
    const model=interpolatePixelModel(frames[0]!,frames[1]!, .5);
    expect(model.hiddenBias[0]).toBeCloseTo(.05);
    const r=forwardPixels(model,point);
    expect(r.logits[0]).toBeCloseTo(.65);expect(r.logits[1]).toBeCloseTo(.35);
    for(const frame of frames){const b=frame.hiddenBias[0]!,boundary=forwardPixels(frame,[.4-b,.2]);expect(boundary.logits[0]).toBeCloseTo(boundary.logits[1]!);}
    expect(JSON.stringify(frames)).toBe(original);
  });
  it.each([1,2])("은닉 %i개에서도 출력은 세 개이고 양수 비율은 실제 확률과 같다",hidden=>{
    const model=outputTeachingModel(hidden),r=outputScoreBreakdown(model,[.4,.2]);
    expect(r.hidden).toHaveLength(hidden);expect(r.logits).toHaveLength(3);
    r.positive.forEach((v,i)=>expect(v/r.total).toBeCloseTo(r.probabilities[i]!,12));
  });
  it("세 클래스 예제도 같은 뉴런과 A/B 출력 계산에서 시작한다",()=>{
    const {point,frames}=biasDirectionExample(),a=forwardPixels(frames[0]!,point),b=forwardPixels(outputTeachingModel(1),point);
    expect(b.hidden).toEqual(a.hidden);expect(b.logits.slice(0,2)).toEqual(a.logits);
    // A new output changes the normalization, not the old output scores.
    expect(b.probabilities[0]).not.toBe(a.probabilities[0]);
  });
});
