/** Conservative checks: mentioning “정답” alone must never count as understanding the cause. */
export function lessonAnswerCorrect(step: number, answer: string, expectedNumber = 0, tolerance = .06): boolean {
  const text = answer.trim().replace(/\s+/g, "");
  if (step === 1 || step === 3) return text !== "" && Number.isFinite(Number(text)) && Math.abs(Number(text) - expectedNumber) < tolerance;
  if (step === 2) return /^(아니|아니다|아니요|아니오|no)[.!]?$/i.test(text);
  if (/같아서|같기때문|맞아서|맞기때문/.test(text)) return false;
  return /(?:예상|예측).*정답.*(?:다르|달라|차이)|정답.*(?:예상|예측).*(?:다르|달라|차이)|오차.*(?:줄|낮)|틀린.*(?:줄|고치)/.test(text);
}
