import { forwardPixels, type PixelExample } from "../core/pixelNetwork";
import { outputScoreBreakdown, outputTeachingModel } from "../core/lessonArithmetic";
import { LESSON_PROJECTION, lessonTruth, NEURON_EXAMPLES, neuronLessonModel } from "../core/neuronLesson";
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { NEURON_COLORS } from "../visualization/neuronColors";
import type { SceneQuiz } from "./lessonScenes";

export const OUTPUT_LAST_STAGE=6;
export const OUTPUT_EXAMPLES:PixelExample[]=[...NEURON_EXAMPLES,{pixels:[.55,-.1],label:2}];
export const outputCanExplore=(stage:number)=>stage===4||stage===6;
const n=(v:number)=>String(Number(v.toFixed(3)));
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
  const r=outputScoreBreakdown(model,point), labels=stage<5?['A','B']:['A','B','C'],signal=r.hidden[0]!;
  const sums=model.inputHidden.map((w,i)=>w.reduce((sum,v,j)=>sum+v*point[j]!,model.hiddenBias[i]!));
  const data=stage<5?NEURON_EXAMPLES:OUTPUT_EXAMPLES, truth=lessonTruth(point,data);
  const best=Math.max(...r.logits),winners=labels.filter((_,i)=>Math.abs(r.logits[i]!-best)<1e-9),predicted=winners.length>1?`${winners.join('·')} 동점`:winners[0]!;
  get('flTitle').textContent=["뉴런이 보낸 0.3을 두 출력이 받아요","A는 먼저 신호에 −1을 곱해요","A는 마지막에 1을 더해요","B도 곱하고 더해요. 이번엔 직접 계산!","점수를 비교해서 예상 답을 골라요","C를 추가하면 출력 계산기도 하나 추가해요","은닉 뉴런과 출력은 역할이 달라요"][stage]!;
  get('flText').textContent=[
    "앞의 작은 예제 처음 상태로 돌아왔어요. 곱할 수는 1·0.5, 더할 수는 0입니다. 출력은 답 A·B마다 점수 하나를 계산합니다.",
    "출력에도 연결값이 있어요. A로 가는 −1은 신호의 부호를 바꿉니다. 예제에서 정한 값이지, 뉴런이 보낸 0.3에서 계산해 낸 값은 아니에요.",
    "A의 마지막에 더하는 값 1도 예제에서 정했습니다. ×(−1)로 얻은 −0.3에 1을 더하면 A 점수 0.7입니다.",
    "B의 연결값은 1, 마지막에 더하는 값은 0으로 정했습니다. 그래서 이 예제의 B 점수는 신호와 같아요.",
    "예제 점을 누르거나 다른 좌표를 찍어 보세요. 점에 적힌 정답은 그대로지만 모델의 예상은 틀릴 수 있어요. 두 점수가 같으면 동점입니다.",
    "같은 신호를 C에도 보냅니다. C의 연결값은 0.5, 마지막 더할 값은 0.3으로 정했어요. A·B의 점수 계산은 그대로입니다.",
    "은닉 뉴런은 판단에 쓸 신호를 만들고, 출력은 답마다 점수를 계산합니다. 이 모델은 A·B·C 세 클래스이므로 출력도 3개입니다.",
  ][stage]!;
  get('flVisualTitle').textContent=explore?'정답과 모델의 예상을 따로 비교해요':`출력 계산 ${stage+1} · 같은 예제 이어 보기`;
  get('flSourceNote').textContent='계산을 위한 예제 · 실제 학습 결과가 아닙니다.';
  let html='';
  if(stage===0)html='<b>0.2 × 1 + 0.2 × 0.5 + 0 = 0.3</b><span>합이 양수라 0.3을 보냅니다. 이 예제에서는 음수인 합은 0으로 바꿔 보내요.</span><span>이제 A·B가 같은 0.3을 서로 다르게 계산합니다.</span>';
  if(stage===1)html='<div class="output-equation">뉴런 신호 <b>0.3</b> × A의 연결값 <mark>−1</mark> = <b class="arithmetic-token">−0.3</b></div><span>신호가 커질수록 이 곱셈 결과는 작아집니다. 아직 A의 최종 점수가 아니에요.</span>';
  if(stage===2)html='<div class="output-equation">곱한 값 <b>−0.3</b> + A의 더할 값 <mark>1</mark> = <b class="arithmetic-token">0.7</b></div><span>A 점수 = 1 − 신호. 여기의 1은 100%를 뜻하지 않습니다.</span>';
  if(stage===3){
    const p=outputPractice();
    html='<b>B: 0.3 × 1 + 0 = 0.3</b><span>A는 0.7, B는 0.3입니다. 출력 점수이지 확률은 아니에요.</span>';
    html+=`<section class="arithmetic-check" aria-label="출력 직접 계산"><strong>가로만 0.2 → 0.3으로 바꾸면 A 점수는?</strong><span>새 신호: 0.3 × 1 + 0.2 × 0.5 + 0 = ${n(p.signal)}</span><span>A: ${n(p.signal)} × (−1) + 1 = ?</span><div class="lesson-choice-grid">${p.choices.map((value,i)=>`<button data-output-answer="${i}" aria-pressed="${practiceAnswer===i}" class="${practiceAnswer===i?(i===0?'correct':'wrong'):''}">${value}</button>`).join('')}</div><p role="status" class="${practiceAnswer===0?'correct':'wrong'}">${practiceAnswer===null?'':practiceAnswer===0?'맞아요. −0.4 + 1 = 0.6입니다.':'오답입니다. 먼저 −1을 곱한 값을 확인해 보세요.'}</p></section>`;
  }
  if(stage===4)html=`<span>(${n(point[0]!)} × 1) + (${n(point[1]!)} × 0.5) + 0 → 신호 <b>${n(signal)}</b></span><div class="movement-scores"><span>A: 1 − ${n(signal)} = <b>${n(r.logits[0]!)}</b></span><span>B: <b>${n(r.logits[1]!)}</b></span><strong>예상 ${predicted}</strong></div><span>검은 경계는 A·B 점수가 같은 곳입니다. 실제 정답의 선이 아니라 현재 계산이 만드는 예상 경계예요.</span>`;
  if(stage===5)html='<b>C: 0.3 × 0.5 + 0.3</b><span>① 0.3의 절반 = 0.15</span><span>② 0.15 + 0.3 = <b>0.45</b></span><div class="movement-scores"><span>A 0.7</span><span>B 0.3</span><span>C 0.45</span></div><span>C가 추가되어도 A·B 점수는 그대로입니다. 이제 세 점수를 비교해요.</span>';
  if(stage===6)html=`<div class="neuron-count-example"><b>은닉 ${model.hiddenUnits}개 → 출력 3개</b><div>${[1,2].map(count=>`<button data-output-neurons="${count}" aria-pressed="${count===hidden}">은닉 뉴런 ${count}개</button>`).join('')}</div></div><span>${hidden===1?'신호 하나를 A·B·C가 서로 다르게 계산합니다.':'뉴런 2는 세로 입력을 보내되, 음수면 0을 보냅니다. C에만 더하도록 정한 예제입니다.'}</span><span>뉴런을 늘린다고 무조건 잘 맞히지는 않아요. 연습한 자료와 새 자료 모두 확인해야 합니다.</span><button data-output-percent class="plain-help">점수와 퍼센트는 어떻게 다른가요?</button>`;
  get('flCalculation').innerHTML=html;
  const rows=labels.map((label,i)=>{
    const shown=i===0?stage>=2:i===1?stage>=3:stage>=5,active=i===0?(stage===1||stage===2):i===1?stage===3:stage===5;
    const connection=model.hiddenOutput[i]!.map((w,h)=>`${model.hiddenUnits>1?`신호 ${h+1} `:''}× (${n(w)})`).join(' + ')+` + (${n(model.outputBias[i]!)})`;
    return `<div class="output-route ${active?'is-current':''}" style="--output-color:${colors[i]}"><span>${connection}</span><strong>${label} <b>${shown?n(r.logits[i]!):'?'}</b></strong></div>`;
  }).join('');
  get('flSelected').innerHTML=`<div class="point-truth">${truth===null?'정답 미지정':`정답 ${labels[truth]}`} ${stage>=4?`· 모델 예상 ${predicted}`:''}</div><div class="output-network"><div class="output-signals">${r.hidden.map((v,i)=>`<span style="--signal-color:${NEURON_COLORS[i]}">뉴런 ${i+1}<b>${n(v)}</b>${stage===6&&sums[i]!<0?`<small>합 ${n(sums[i]!)}</small>`:''}</span>`).join('')}</div><span aria-hidden="true">→</span><div class="output-routes">${rows}</div></div>`;
  get('flVisualNote').textContent=explore?'점을 눌러 계산을 확인하세요. 좌표는 0.01 간격이며 새 좌표의 정답은 미지정입니다.':'먼저 고정된 점 (0.2, 0.2)으로 계산합니다. 점수 비교 장면부터 직접 찍을 수 있어요.';
  drawPixelLatentMap(get('flMap'),model,data,point,LESSON_PROJECTION,{view:'decision',neutralBackground:!linesShown,showNeuronBoundaries:linesShown,showDecisionBoundary:linesShown,showDataLabels:true,classLabels:labels,axisLegend:{horizontal:{title:'가로 입력',negative:'',positive:''},vertical:{title:'세로 입력',negative:'',positive:''}},focusLabel:truth===null?`정답 미지정 · (${n(point[0]!)}, ${n(point[1]!)})`:`정답 ${labels[truth]} · (${n(point[0]!)}, ${n(point[1]!)})`});
  // Percent conversion is optional, separate from the middle-school arithmetic path.
  get('flPercent').innerHTML=`<div class="image-heading"><h2>출력 점수 ≠ 맞힌 비율</h2><form method="dialog"><button aria-label="퍼센트 설명 닫기">닫기</button></form></div><p>퍼센트는 지금 그림에 대한 모델의 예상입니다. 80%라고 해서 실제로 100장 중 80장을 맞혔다는 뜻은 아니에요.</p><p>음수도 가능한 점수를 계산기의 같은 변환으로 양수로 만든 다음, 합으로 나눕니다. 이 추가 변환식은 지금 외울 필요가 없어요.</p><div class="score-conversion">${labels.map((l,i)=>`<span>${l}: 점수 ${n(r.logits[i]!)} → 변환값 ${r.positive[i]!.toFixed(3)}</span>`).join('')}</div><p>B: ${r.positive[1]!.toFixed(3)} ÷ ${r.total.toFixed(3)} × 100 ≈ ${(r.probabilities[1]!*100).toFixed(1)}%</p><details><summary>계산기의 변환 규칙</summary><p>exp(점수)로 바꿉니다. 예: 0 → 1, 0.3 → 약 1.350, 0.7 → 약 2.014. 이 양수들의 합으로 나누는 방법을 softmax라고 합니다. 표시값은 반올림했고 계산은 원래 값으로 합니다.</p></details>`;
  return {question:'클래스가 3개이고 은닉 뉴런이 1개라면?',choices:[{text:'출력 점수는 3개, 잘 구분하는지는 학습 후 확인',correct:true},{text:'은닉 뉴런이 1개이므로 클래스도 1개',correct:false}],explanation:'이 다중 분류 모델은 클래스마다 출력 하나를 둡니다. 은닉 뉴런 수는 클래스 수를 정하지 않습니다.'};
}
