import { expect, it } from "vitest";
import { lessonAnswerCorrect } from "./lessonQuiz";

it("키워드만 적거나 반대 이유를 적어도 정답으로 처리하지 않는다",()=>{
  for(const text of ["정답", "정답과 예상이 같아서", "답을 맞아서", "차이", "항상 같은 방향"]) expect(lessonAnswerCorrect(4,text)).toBe(false);
  for(const text of ["예상과 정답이 달라서", "정답과 예상의 차이", "오차를 줄이려고", "틀린 정도를 고치려고"]) expect(lessonAnswerCorrect(4,text)).toBe(true);
  expect(lessonAnswerCorrect(2,"아니요")).toBe(true);expect(lessonAnswerCorrect(2,"아니요가 아니라 예")).toBe(false);
  expect(lessonAnswerCorrect(3,"",0)).toBe(false);expect(lessonAnswerCorrect(3,"0",0)).toBe(true);
});
