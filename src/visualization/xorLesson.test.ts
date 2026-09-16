import { describe, expect, it } from "vitest";
import { XOR_LESSON, createXorLearningTrace, XOR_FOCUS } from "./xorLesson";
import { forward, trainOne } from "../core/neuralNetwork";

describe("승부차기 XOR 이해 흐름", () => {
  it("네 경우에서 두 선의 결론까지 한 단계씩 진행한다", () => {
    expect(XOR_LESSON.map((step) => step.tab)).toEqual(["네 경우", "뉴런 1개", "뉴런 2개", "선 연습"]);
    expect(XOR_LESSON.map((step) => step.correct)).toEqual(["different", "no", "goal", "correct"]);
    expect(XOR_LESSON.every((step) => step.question.length > 0 && step.explanation.length > 0)).toBe(true);
  });

  it("대표 분류선은 오답을 줄이는 방향으로 연속해서 움직인다", () => {
    const trace = createXorLearningTrace();
    const probabilities = trace.map((model) => forward(model, XOR_FOCUS.x, XOR_FOCUS.y).probability);
    expect(probabilities[0]).toBeLessThan(.5);
    expect(probabilities.at(-1)).toBeGreaterThan(.9);
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]).toEqual(trainOne(trace[i - 1]!, [XOR_FOCUS]));
      expect(probabilities[i]).toBeGreaterThan(probabilities[i - 1]!);
    }
    expect(trace[0]!.parameters.inputHidden[1]).not.toEqual(trace.at(-1)!.parameters.inputHidden[1]);
  });
});
