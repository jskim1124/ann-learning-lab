/** An exact teaching example: h = max(0, x - y - threshold). */
export function lessonMovement(before:number, after:number, y=.25, x=.75) {
  return {beforeX:y+before,afterX:y+after,beforeSignal:Math.max(0,x-y-before),afterSignal:Math.max(0,x-y-after),direction:after<before?'left-up':after>before?'right-down':'still'} as const;
}
export const LESSON_CHAPTERS=['특징 계산','분포·선택','뉴런·선','뉴런·출력'];
export const CHAPTER_STARTS=[0,3,5,7];
export const lessonChapter=(scene:number)=>scene<3?0:scene<5?1:scene<7?2:3;
