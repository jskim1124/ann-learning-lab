import { describe, expect, it } from "vitest";
import { biasDirectionExample, numberChoices, outputTeachingModel, smallFeatureExample } from "./lessonArithmetic";
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
    expect(values.hidden[0]).toBeCloseTo(Math.tanh(.4*1.4+.2*.5+.2));
    expect(values.logits[0]).toBeCloseTo(values.hidden[0]!*1.2+values.hidden[1]!*(-.8)+.1);
  });
});
