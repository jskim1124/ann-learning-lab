export const LESSON_CLASS_COLORS=['#f17605','#df466f','#7446f5'];
export function classBadge(label:string,index:number):string {
  return `<strong class="class-badge" style="--class-color:${LESSON_CLASS_COLORS[index]}">${label}</strong>`;
}
/** Truth and prediction are separate. Ties are not silently assigned to A. */
export function lessonClassification(truth:number,scores:number[],labels=['A','B','C']):string {
  const best=Math.max(...scores), winners=scores.flatMap((v,i)=>Math.abs(v-best)<1e-9?[i]:[]);
  const prediction=winners.length===1?classBadge(`모델 예상 ${labels[winners[0]!]}`,winners[0]!):`<strong>${winners.map(i=>labels[i]).join('·')} 동점</strong>`;
  return `<div class="point-truth">${classBadge(`정답 ${labels[truth]}`,truth)} · ${prediction}<span class="truth-check">${winners.length>1?'동점':winners[0]===truth?'일치':'불일치'}</span></div>`;
}
