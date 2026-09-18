import { neuronCalculation, neuronLessonModel } from "../core/neuronLesson";
import { traceHits, type LessonPoint, type LessonStroke } from "../core/neuronTrace";
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { drawNeuronTrace } from "../visualization/neuronTrace";
import { neuronDiagram } from "./neuronDiagram";
import { neuronArithmeticFlow } from "./neuronArithmeticFlow";

const n = (v: number) => String(Number(v.toFixed(2)));
const identity = { mean:[0,0], horizontal:[1,0], vertical:[0,1], horizontalScale:1, verticalScale:1 };
const axes = { horizontal:{title:"가로 입력",negative:"",positive:""}, vertical:{title:"세로 입력",negative:"",positive:""} };
const titles = ["뉴런은 숫자를 계산해서 보내는 작은 계산기예요", "곱한 두 값을 모아서 더해요", "보라선: 합이 0인 점들을 이은 선", "출력은 답마다 점수를 매기는 마지막 계산기예요", "검은 경계: A와 B 점수가 같은 곳"];

export interface NeuronActivity {
  phase: number;
  answer: number | null;
  point: LessonPoint;
  strokes: LessonStroke[];
}
export const newNeuronActivity = (): NeuronActivity => ({phase:0,answer:null,point:[.2,.2],strokes:[]});

export function renderNeuronIntroduction(root: HTMLElement, stage: number, activity: NeuronActivity, playing=false): void {
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const model = neuronLessonModel(), interactive = stage===2 || stage===4;
  const point: LessonPoint = interactive ? activity.point : [.2,.2];
  const r = neuronCalculation(model, point), phase=activity.phase;
  get("flTitle").textContent = titles[stage]!;
  get("flVisualTitle").textContent = interactive ? "누른 채 그리며 계산값을 확인하세요" : "입력 → 곱하기 → 더하기";
  get("flText").textContent = [
    "은닉 뉴런은 입력과 출력 사이에서 계산해 값을 보내요. 선 자체가 뉴런은 아닙니다. 여기서는 계산을 쉽게 따라가도록 곱할 수를 정했습니다.",
    "가로·세로에 각각 연결된 수를 곱합니다. 그 결과 두 개에 ‘더해주는 값’을 마지막으로 더해요.",
    "그래프에 직접 그려 보세요. 보라선을 지나는 자리에 보라 점이 채워집니다. 그 자리의 합은 0입니다. 아직 A·B의 경계는 아니에요.",
    "은닉 뉴런이 보낸 값을 ‘신호’라고 부릅니다. 이 예제의 출력 A는 1에서 신호를 빼고, B는 신호를 그대로 씁니다. 더 큰 쪽을 예상 답으로 고릅니다.",
    "검은 선을 가로질러 그려 보세요. A·B 점수가 같은 자리에 파란 점이 채워집니다. 경계를 지나면 더 큰 점수의 클래스도 바뀝니다.",
  ][stage]!;
  let calculation = "";
  if (stage===0) calculation='<b>가로 0.2 · 세로 0.2를 넣어 볼까요?</b><span>다음 장면에서 화살표를 따라 한 항씩 계산합니다.</span>';
  if (stage===1) {
    get("flArithmeticFlow").innerHTML=neuronArithmeticFlow(phase,playing);
    const messages=["① 가로 0.2에 연결된 수 1을 곱할 차례예요.","① 1을 곱하면 그대로예요. 가로에서 온 값은 0.2입니다.","② 세로 0.2에 0.5를 곱하면 절반인 0.1입니다.","③ 마지막으로 더해주는 값 0을 가져옵니다. 곱하는 수가 아니에요.","④ 세 값을 더한 0.3을 보냅니다. 30%라는 뜻은 아닙니다."];
    const term=(label:string,formula:string,value:string,index:number)=>`<span class="arithmetic-term ${phase===index?'is-current':''} ${phase<index?'is-pending':''}"><small>${label}</small>${formula}<b class="${phase===index?'arithmetic-token':''}">${phase>=index?value:'?'}</b></span>`;
    calculation=`<div class="neuron-terms">${term("가로에서","0.2 × 1","0.2",1)}${term("세로에서","0.2 × 0.5","0.1",2)}${term("마지막에 더하기","더해주는 값","0",3)}</div><p class="arithmetic-explanation">${messages[phase]}</p><div class="arithmetic-sum ${phase===4?'is-current':''}">합 = ${phase>=1?'0.2':'□'} + ${phase>=2?'0.1':'□'} + ${phase>=3?'0':'□'} = <b>${phase>=4?'0.3':'?'}</b></div>`;
    if (phase===4) calculation+=`<section class="arithmetic-check" aria-label="직접 계산 확인"><strong>이번엔 가로만 0.4로 바꿔 볼까요?</strong><span>0.4 × 1 + 0.2 × 0.5 + 0 = ?</span><div class="lesson-choice-grid">${[.5,.6,.4].map((v,i)=>`<button data-neuron-answer="${i}" aria-pressed="${activity.answer===i}" class="${activity.answer===i?(i===0?'correct':'wrong'):''}">${v}</button>`).join("")}</div><p role="status" class="${activity.answer===0?'correct':'wrong'}">${activity.answer===null?'':activity.answer===0?'맞아요. 0.4 + 0.1 + 0 = 0.5입니다.':'오답입니다. 두 곱셈을 먼저 확인해 보세요.'}</p></section>`;
  }
  if (stage===2) calculation=`<b>(${n(point[0])} × 1) + (${n(point[1])} × 0.5) + 0 = ${n(r.sum)}</b><span>보낼 값: ${n(r.hidden[0]!)} · 합이 음수면 0, 양수면 그대로 보냅니다.</span>`;
  if (stage===3) calculation='<div class="movement-scores"><span>A: 1 − 0.3 = <b>0.7</b></span><span>B: 0.3 × 1 = <b>0.3</b></span></div><b>0.7이 더 크므로 이 점의 예상은 A</b><span>지금은 퍼센트가 아니라 출력 점수를 비교합니다.</span>';
  if (stage===4) calculation=`<span>(${n(point[0])} × 1) + (${n(point[1])} × 0.5) + 0 = <b>${n(r.sum)}</b> → 보낼 값 ${n(r.hidden[0]!)}</span><div class="movement-scores"><span>A: 1 − ${n(r.hidden[0]!)} = <b>${n(r.logits[0]!)}</b></span><span>B: <b>${n(r.logits[1]!)}</b></span><strong>${Math.abs(r.logits[0]!-r.logits[1]!)<1e-9?"같은 점수":r.logits[0]!>r.logits[1]!?"A로 분류":"B로 분류"}</strong></div>`;
  if (interactive) {
    const hits=traceHits(activity.strokes,stage===4), last=hits.at(-1);
    calculation+=`<div class="trace-result"><span>${last?`선을 지난 자리 (${n(last[0])}, ${n(last[1])}) · ${stage===4?'A = B = 0.5':'합 = 0'}`:'선을 가로질러 그리면 만난 자리가 채워집니다.'}</span><button data-neuron-clear>그린 자국 지우기</button></div>`;
  }
  get("flCalculation").innerHTML=calculation;
  get("flSelected").innerHTML=neuronDiagram(model,point,stage,stage===1?phase:undefined);
  get("flVisualNote").textContent="선을 그리는 기준도 이 연결지도에서 계산합니다.";
  if(stage===2)get("flVisualNote").textContent="보라 점: 합이 정확히 0인 교차점 · 좌표·계산값은 반올림 표시";
  if(stage===4)get("flVisualNote").textContent="주황 배경 A · 분홍 배경 B · 파란 점: 두 출력 점수가 같은 교차점";
  if(stage!==1)drawPixelLatentMap(get("flMap"),model,[],point,identity,{view:stage>=2?"decision":"placement",neutralBackground:stage<4,classLabels:stage>=4?["A","B"]:undefined,showNeuronBoundaries:stage>=2,showDecisionBoundary:stage>=4,axisLegend:axes,focusLabel:`(${n(point[0])}, ${n(point[1])})`});
  if(interactive)drawNeuronTrace(get("flMap"),activity.strokes,stage===4);
}
