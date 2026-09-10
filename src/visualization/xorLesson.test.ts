import { describe, expect, it } from "vitest";
import { XOR_LESSON } from "./xorLesson";

describe("승부차기 XOR 이해 흐름", () => {
  it("네 경우에서 두 선의 결론까지 한 단계씩 진행한다", () => {
    expect(XOR_LESSON.map((step) => step.tab)).toEqual(["네 경우", "노드 1개", "노드 2개", "선 연습"]);
    expect(XOR_LESSON.map((step) => step.correct)).toEqual(["different", "no", "goal", "correct"]);
    expect(XOR_LESSON.every((step) => step.question.length > 0 && step.explanation.length > 0)).toBe(true);
  });
});
