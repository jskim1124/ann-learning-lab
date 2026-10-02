import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
const n=(v:number)=>v.toFixed(2);
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function exampleComparison(before:PixelModel,after:PixelModel,point:number[],label:number) {
  const from=forwardPixels(before,point),to=forwardPixels(after,point),delta=to.probabilities[label]!-from.probabilities[label]!;
  return {from,to,delta,result:Math.abs(delta)<1e-9?'same':delta>0?'better':'worse'} as const;
}
export function exampleFeedback(before:PixelModel,after:PixelModel,point:number[],label:number,classes:string[],color:(i:number)=>string):string {
  const c=exampleComparison(before,after,point,label);
  const rival=classes.map((_,i)=>i).filter(i=>i!==label).sort((a,b)=>c.to.probabilities[b]!-c.to.probabilities[a]!)[0];
  const row=(i:number)=>`<div class="example-bar" style="--class-color:${color(i)}" data-answer="${i===label}"><span>${esc(classes[i]!)}${i===label?' · 정답':''}</span><div class="example-track"><i style="width:${c.to.probabilities[i]!*100}%"></i><mark style="left:${c.from.probabilities[i]!*100}%" title="출발점"></mark></div><b>${n(c.to.probabilities[i]!*100)}%</b></div>`;
  return `<section class="example-feedback" data-result="${c.result}" aria-label="고른 자료 한 개의 예상 변화"><header>이 자료의 예상 확률<strong>${c.result==='same'?'변화 없음':c.result==='better'?'↑ 정답의 가능성 증가':'↓ 정답의 가능성 감소'}</strong></header><div class="example-bars">${row(label)}${rival===undefined?'':row(rival)}</div><small>정답과 가장 강한 다른 후보 · 세로 표시: 출발점<br>이 한 자료의 예상입니다. 전체 정답률이 아니에요.</small>${classes.length>2?`<details><summary>모든 클래스의 예상</summary><div class="example-bars">${classes.map((_,i)=>row(i)).join('')}</div></details>`:''}</section>`;
}
