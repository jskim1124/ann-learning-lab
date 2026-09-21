import { forwardPixels, type PixelExample } from "../core/pixelNetwork";
import { outputScoreBreakdown, outputTeachingModel } from "../core/lessonArithmetic";
import { LESSON_PROJECTION, lessonTruth, lessonTruthRule, NEURON_EXAMPLES, neuronLessonModel } from "../core/neuronLesson";
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { NEURON_COLORS } from "../visualization/neuronColors";
import { classBadge, lessonClassification } from './lessonClassification';
import type { SceneQuiz } from "./lessonScenes";

export const OUTPUT_LAST_STAGE=6;
export const OUTPUT_EXAMPLES:PixelExample[]=[...NEURON_EXAMPLES,{pixels:[.55,-.1],label:2}].map(e=>({...e,label:lessonTruth(e.pixels,3)}));
export const outputCanExplore=(stage:number)=>stage===4||stage===6;
const n=(v:number)=>v.toFixed(2);
const colors=['#f17605','#df466f','#7446f5'];

/** The check changes only x, from .2 to .3, and uses the same A calculation. */
export function outputPractice() {
  const input=[.3,.2],r=forwardPixels(neuronLessonModel(),input);
  return {input,signal:r.hidden[0]!,answer:r.logits[0]!,choices:[.6,.4,1.4]};
}

export function renderOutputScene(root:HTMLElement,focus:number[],stage:number,hidden:number,practiceAnswer:number|null=null,linesShown=false):SceneQuiz {
  const get=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>(`#${id}`)!;
  // Hundredth-spaced inputs keep every displayed multiplication reproducible.
  const explore=outputCanExplore(stage), point=explore?focus.map(v=>Number(v.toFixed(2))):[.2,.2];
  const model=stage<5?neuronLessonModel():outputTeachingModel(stage===6?hidden:1);
  const r=outputScoreBreakdown(model,point), labels=stage<5?['A','B']:['A','B','C'];
  const sums=model.inputHidden.map((w,i)=>w.reduce((sum,v,j)=>sum+v*point[j]!,model.hiddenBias[i]!));
  const data=stage<5?NEURON_EXAMPLES:OUTPUT_EXAMPLES, truth=lessonTruth(point,labels.length);
  const best=Math.max(...r.logits),winners=labels.filter((_,i)=>Math.abs(r.logits[i]!-best)<1e-9),predicted=winners.length>1?`${winners.join('·')} 동점`:winners[0]!;
  get('flTitle').textContent=["뉴런이 보낸 0.3을 두 출력이 받아요","A는 먼저 신호에 −1을 곱해요","A는 마지막에 1을 더해요","B도 곱하고 더해요. 이번엔 직접 계산!","점수를 비교해서 예상 답을 골라요","C를 추가하면 출력 계산기도 하나 추가해요","은닉 뉴런과 출력은 역할이 달라요"][stage]!;
  get('flText').textContent=[
    "앞의 작은 예제 처음 상태로 돌아왔어요. 곱할 수는 1·0.5, 더할 수는 0입니다. 출력은 답 A·B마다 점수 하나를 계산합니다.",
    "출력에도 연결값이 있어요. A로 가는 −1은 신호의 부호를 바꿉니다. 예제에서 정한 값이지, 뉴런이 보낸 0.3에서 계산해 낸 값은 아니에요.",
    "A의 마지막에 더하는 값 1도 예제에서 정했습니다. ×(−1)로 얻은 −0.3에 1을 더하면 A 점수 0.7입니다.",
    "B의 연결값은 1, 마지막에 더하는 값은 0으로 정했습니다. 그래서 이 예제의 B 점수는 신호와 같아요.",
    "예제 점을 누르거나 다른 좌표를 찍어 보세요. 점에 적힌 정답은 그대로지만 모델의 예상은 틀릴 수 있어요. 두 점수가 같으면 동점입니다.",
    "같은 신호를 C에도 보냅니다. 연결지도에서 절반으로 곱한 뒤 더하는 과정을 보세요. A·B의 점수 계산은 그대로입니다.",
    "뉴런 2는 세로가 음수일 때 0, 양수일 때 세로 값을 넘깁니다. 위와 아래에서 C의 계산이 달라져 경계가 꺾일 수 있어요. 출력은 여전히 A·B·C 세 개입니다.",
  ][stage]!;
  get('flVisualTitle').textContent=explore?'정답과 모델의 예상을 따로 비교해요':`출력 계산 ${stage+1} · 같은 예제 이어 보기`;
  get('flSourceNote').textContent='계산을 위한 예제 · 실제 학습 결과가 아닙니다.';
  let html='';
  if(stage===0)html='<span>왼쪽 연결지도에서 입력 두 개가 하나의 신호로 모입니다. 그 같은 숫자를 A와 B가 각각 받아요.</span>';
  if(stage===1)html='<span>주황색 길을 보세요. −1을 곱하면 부호가 바뀝니다. 아직 마지막 더하기 전이에요.</span>';
  if(stage===2)html='<span>곱한 값에 1을 더하면 A 점수가 완성됩니다. 여기의 1은 100%가 아니에요.</span>';
  if(stage===3){
    const p=outputPractice();
    html='<span>분홍색 길을 보세요. B는 같은 신호에 1을 곱하고 0을 더합니다.</span>';
    html+=`<section class="arithmetic-check" aria-label="출력 직접 계산"><strong>가로만 0.2 → 0.3으로 바꾸면 A 점수는?</strong><span>새 신호: 0.3 × 1 + 0.2 × 0.5 + 0 = ${n(p.signal)}</span><span>A: ${n(p.signal)} × (−1) + 1 = ?</span><div class="lesson-choice-grid">${p.choices.map((value,i)=>`<button data-output-answer="${i}" aria-pressed="${practiceAnswer===i}" class="${practiceAnswer===i?(i===0?'correct':'wrong'):''}">${value}</button>`).join('')}</div><p role="status" class="${practiceAnswer===0?'correct':'wrong'}">${practiceAnswer===null?'':practiceAnswer===0?'맞아요. −0.4 + 1 = 0.6입니다.':'오답입니다. 먼저 −1을 곱한 값을 확인해 보세요.'}</p></section>`;
  }
  if(stage===4)html=`${winners.length===1?classBadge(`${predicted}로 분류`,labels.indexOf(predicted)):'<strong>A·B 동점</strong>'}<span>검은 경계는 A·B 점수가 같은 곳입니다. 실제 정답의 선이 아니라 현재 계산이 만드는 예상 경계예요.</span>`;
  if(stage===5)html='<span>보라색 출력 C가 추가됐습니다. 이제 세 점수 중 가장 큰 답을 고릅니다. 정답 규칙도 오른쪽 아래를 C로 나누어 세 종류로 확장했어요.</span>';
  if(stage===6){
    get('flBendValue').textContent=n(point[1]!);
    get('flBendControl').querySelector<HTMLInputElement>('input')!.value=String(point[1]);
    html=`<div class="neuron-count-example"><b>은닉 ${model.hiddenUnits}개 → 출력 3개</b><div>${[1,2].map(count=>`<button data-output-neurons="${count}" aria-label="은닉 뉴런 ${count}개" aria-pressed="${count===hidden}">${count}개</button>`).join('')}</div></div>
      <span>${hidden===1?'2개로 바꾼 뒤 점을 위·아래로 움직여 보세요.':'뉴런 2 → C: 아래에서는 0, 위에서는 세로 값을 더해요.'}</span>`;
  }
  get('flCalculation').innerHTML=html+(stage>=4?`<p class="lesson-truth-rule">${lessonTruthRule(labels.length)}</p>${lessonClassification(truth,r.logits)}`:'');
  const rows=labels.map((label,i)=>{
    const shown=i===0?stage>=2:i===1?stage>=3:stage>=5,active=i===0?(stage===1||stage===2):i===1?stage===3:stage===5;
    const products=model.hiddenOutput[i]!.map((w,h)=>r.hidden[h]!*w);
    const connection=model.hiddenOutput[i]!.map((w,h)=>`${n(r.hidden[h]!)} × (${n(w)})`).join(' + ');
    const product=products.reduce((a,b)=>a+b,0);
    const reached=i===0?stage>=1:i===1?stage>=3:stage>=5;
    return `<div class="output-route ${active?'is-current':''}" style="--output-color:${colors[i]}"><div class="output-equation">${reached?`${connection} = <b>${n(product)}</b><br>${n(product)} + ${n(model.outputBias[i]!)} = ${shown?`<b>${n(r.logits[i]!)}</b>`:'?'}`:'같은 신호를 기다려요'}</div><strong>${label} <b>${shown?n(r.logits[i]!):'?'}</b></strong></div>`;
  }).join('');
  get('flSelected').innerHTML=`<div class="output-network"><div class="output-signals">${r.hidden.map((v,i)=>`<span style="--signal-color:${NEURON_COLORS[i]}">뉴런 ${i+1}<small>${model.inputHidden[i]!.map((w,j)=>`${n(point[j]!)} × (${n(w)})`).join(' + ')} + ${n(model.hiddenBias[i]!)}</small><small>합 ${n(sums[i]!)} → 보낼 값</small><b>${n(v)}</b></span>`).join('')}</div><span class="signal-arrow" aria-hidden="true">→</span><div class="output-routes">${rows}</div></div>`;
  get('flVisualNote').textContent='';
  if(stage===6)get('flSelected').insertAdjacentHTML('beforeend','<button data-output-percent class="plain-help">점수와 퍼센트는 어떻게 다른가요?</button>');
  drawPixelLatentMap(get('flMap'),model,data,point,LESSON_PROJECTION,{view:'decision',neutralBackground:!linesShown,emphasizeClass:stage===1||stage===2?0:stage===3?1:stage===5?2:undefined,showNeuronBoundaries:linesShown,showDecisionBoundary:linesShown,showDataLabels:true,classLabels:labels,axisLegend:{horizontal:{title:'가로 입력',negative:'',positive:''},vertical:{title:'세로 입력',negative:'',positive:''}},focusLabel:`정답 ${labels[truth]}`});
  // Percent conversion is optional, separate from the middle-school arithmetic path.
  get('flPercent').innerHTML=`<div class="image-heading"><h2>출력 점수 ≠ 맞힌 비율</h2><form method="dialog"><button aria-label="퍼센트 설명 닫기">닫기</button></form></div><p>퍼센트는 지금 그림에 대한 모델의 예상입니다. 80%라고 해서 실제로 100장 중 80장을 맞혔다는 뜻은 아니에요.</p><p>음수도 가능한 점수를 계산기의 같은 변환으로 양수로 만든 다음, 합으로 나눕니다. 이 추가 변환식은 지금 외울 필요가 없어요.</p><div class="score-conversion">${labels.map((l,i)=>`<span>${l}: 점수 ${n(r.logits[i]!)} → 변환값 ${r.positive[i]!.toFixed(2)}</span>`).join('')}</div><p>B: ${r.positive[1]!.toFixed(2)} ÷ ${r.total.toFixed(2)} × 100 ≈ ${(r.probabilities[1]!*100).toFixed(2)}%</p><details><summary>계산기의 변환 규칙</summary><p>exp(점수)로 바꿉니다. 예: 0 → 1, 0.3 → 약 1.350, 0.7 → 약 2.014. 이 양수들의 합으로 나누는 방법을 softmax라고 합니다. 표시값은 반올림했고 계산은 원래 값으로 합니다.</p></details>`;
  return {question:'뉴런 2를 추가하면 왜 경계가 꺾일까요?',choices:[{text:'위·아래에서 더하는 값이 달라져서',correct:true},{text:'클래스가 하나 더 생겨서',correct:false}],explanation:'C에 아래는 0, 위는 세로 값을 더해요. 모든 뉴런이 늘 이 모양을 만드는 것은 아니에요.'};
}
