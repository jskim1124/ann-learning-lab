import { describe, expect, it } from "vitest";
import { SWITCH_LESSON } from "./switchLesson";

describe("복도 양쪽 스위치 이해 흐름", () => {
  it("네 경우에서 두 선의 결론까지 한 단계씩 진행한다", () => {
    expect(SWITCH_LESSON.map((step) => step.tab)).toEqual(["네 경우", "선 하나", "선 두 개", "최종 판단"]);
    expect(SWITCH_LESSON.map((step) => step.correct)).toEqual(["different", "no", "on", "between"]);
    expect(SWITCH_LESSON.every((step) => step.question.length > 0 && step.explanation.length > 0)).toBe(true);
  });
});
