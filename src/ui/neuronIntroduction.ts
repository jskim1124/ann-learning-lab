import { lessonTruth, lessonTruthRule, NEURON_EXAMPLES, neuronCalculation, neuronLessonModel } from "../core/neuronLesson";
import { traceHits, REQUIRED_LINE_HITS, type LessonPoint, type LessonStroke } from "../core/neuronTrace";
import { classBadge, lessonClassification } from './lessonClassification';
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { drawNeuronTrace } from "../visualization/neuronTrace";
import { neuronDiagram } from "./neuronDiagram";
import { neuronArithmeticFlow } from "./neuronArithmeticFlow";

const n = (v: number) => v.toFixed(2);
const identity = { mean:[0,0], horizontal:[1,0], vertical:[0,1], horizontalScale:1, verticalScale:1 };
const axes = { horizontal:{title:"가로 입력",negative:"",positive:""}, vertical:{title:"세로 입력",negative:"",positive:""} };
const titles = ["뉴런은 숫자를 계산해서 보내는 작은 계산기예요", "곱한 두 값을 모아서 더해요", "보라선: 합이 0인 점들을 이은 선", "출력은 답마다 점수를 매기는 마지막 계산기예요", "검은 경계: A와 B 점수가 같은 곳"];

export interface NeuronActivity {
  phase: number;
  answer: number | null;
  point: LessonPoint;
  strokes: LessonStroke[];
  linesShown: boolean;
  foundHidden:boolean;
  foundOutput:boolean;
}
export const newNeuronActivity = (): NeuronActivity => ({phase:0,answer:null,point:[.2,.2],strokes:[],linesShown:false,foundHidden:false,foundOutput:false});

export function renderNeuronIntroduction(root: HTMLElement, stage: number, activity: NeuronActivity, playing=false): void {
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const model = neuronLessonModel(), interactive = stage===2 || stage===4;
  const hits=interactive?traceHits(activity.strokes,stage===4):[];
  if(hits.length>=REQUIRED_LINE_HITS){if(stage===2)activity.foundHidden=true;else activity.foundOutput=true;}
  activity.linesShown=stage===4?activity.foundOutput:activity.foundHidden;
  const point: LessonPoint = interactive ? [Number(activity.point[0].toFixed(2)),Number(activity.point[1].toFixed(2))] : [.2,.2];
  if(interactive)get("flSourceNote").textContent="계산용 가상 예제 · 점 색은 정답, 배경색은 모델의 예상";
  const r = neuronCalculation(model, point), phase=activity.phase;
  get("flTitle").textContent = titles[stage]!;
  get("flVisualTitle").textContent = interactive ? "누른 채 그리며 계산값을 확인하세요" : "입력 → 곱하기 → 더하기";
  get("flText").textContent = [
    "1과 0.5는 예제를 만든 사람이 계산하기 쉽게 정한 ‘연결값’입니다. 그림에서 계산한 특징값이나 학습의 결과가 아닙니다.",
    "연결값 1은 입력을 그대로, 0.5는 절반만 반영합니다. 곱한 두 결과에 ‘더해주는 값’을 마지막으로 더해요.",
    "선을 숨겨 두었습니다. 직접 그리며 합이 0인 자리를 찾아보세요. 그 자리를 지나면 보라 점이 채워집니다. 이 선은 정답 클래스의 경계가 아닙니다.",
    "은닉 뉴런이 보낸 값을 ‘신호’라고 부릅니다. 이 예제의 출력 A는 1에서 신호를 빼고, B는 신호를 그대로 씁니다. 더 큰 쪽을 예상 답으로 고릅니다.",
    "선을 숨겨 두었습니다. A·B 점수가 같아지는 자리를 찾아 그려 보세요. 파란 점이 채워집니다. 검은 선은 현재 모델의 예상 경계이며, 실제 정답을 보장하지 않습니다.",
  ][stage]!;
  if(interactive&&activity.linesShown)get('flText').textContent=stage===2?'찾은 점들을 이으면 보라선입니다. 이 선 위에서는 뉴런의 합이 0입니다. 다음 장면에서도 선을 볼 수 있어요.':'찾은 점들을 이으면 검은 경계입니다. 이곳에서 A·B의 점수가 같고, 선 양쪽의 예상이 달라집니다.';
  let calculation = "";
  if (stage===0) calculation='<b>뉴런은 입력을 계산해 다음으로 보내는 계산기예요.</b><div class="neuron-terms"><span>연결값 1<br>0.2 × 1 = <b>0.2 · 그대로</b></span><span>연결값 0.5<br>0.2 × 0.5 = <b>0.1 · 절반</b></span></div><span>실제 연습에서는 임의의 연결값으로 시작해, 예상과 정답의 차이가 줄도록 조금씩 고칩니다. 1이 항상 더 좋은 값이라는 뜻은 아니에요.</span>';
  if (stage===1) {
    get("flArithmeticFlow").innerHTML=neuronArithmeticFlow(phase,playing);
    const messages=["① 가로 0.2에 연결된 수 1을 곱할 차례예요.","① 1을 곱하면 그대로예요. 가로에서 온 값은 0.2입니다.","② 세로 0.2에 0.5를 곱하면 절반인 0.1입니다.","③ 마지막으로 더해주는 값 0을 가져옵니다. 곱하는 수가 아니에요.","④ 세 값을 더한 0.3을 보냅니다. 30%라는 뜻은 아닙니다."];
    calculation=`<p class="arithmetic-explanation">${messages[phase]}</p>`;
    if (phase===4) calculation+=`<section class="arithmetic-check" aria-label="직접 계산 확인"><strong>이번엔 가로만 0.4로 바꿔 볼까요?</strong><span>0.4 × 1 + 0.2 × 0.5 + 0 = ?</span><div class="lesson-choice-grid">${[.5,.6,.4].map((v,i)=>`<button data-neuron-answer="${i}" aria-pressed="${activity.answer===i}" class="${activity.answer===i?(i===0?'correct':'wrong'):''}">${v}</button>`).join("")}</div><p role="status" class="${activity.answer===0?'correct':'wrong'}">${activity.answer===null?'':activity.answer===0?'맞아요. 0.4 + 0.1 + 0 = 0.5입니다.':'오답입니다. 두 곱셈을 먼저 확인해 보세요.'}</p></section>`;
  }
  if (stage===2) calculation=`<b>지금 합 ${n(r.sum)}</b><span>목표: 합이 0인 자리를 지나 보세요. 정답 A·B를 가르는 활동과는 달라요.</span>`;
  if (stage===3) calculation=`${classBadge('A로 분류',0)}<span>연결지도에서 더 큰 출력 점수를 고릅니다. 지금 비교하는 숫자는 퍼센트가 아니에요.</span>`;
  if (stage===4) calculation=`${Math.abs(r.logits[0]!-r.logits[1]!)<1e-9?'<strong>A·B 같은 점수</strong>':classBadge(r.logits[0]!>r.logits[1]!?'A로 분류':'B로 분류',r.logits[0]!>r.logits[1]!?0:1)}<span>목표: A와 B의 점수가 같은 자리를 지나 보세요.</span>`;
  if (interactive) {
    const hits=traceHits(activity.strokes,stage===4), last=hits.at(-1);
    calculation+=`<div class="trace-result"><b role="status">${activity.linesShown?`${REQUIRED_LINE_HITS}곳을 찾았어요 · 남은 점 0개`:`찾은 점 ${Math.min(hits.length,REQUIRED_LINE_HITS)}/${REQUIRED_LINE_HITS} · 남은 점 ${Math.max(0,REQUIRED_LINE_HITS-hits.length)}개`}</b><progress max="${REQUIRED_LINE_HITS}" value="${Math.min(hits.length,REQUIRED_LINE_HITS)}" aria-label="찾은 점"></progress><span>${last?`최근 찾은 점 (${n(last[0])}, ${n(last[1])}) · ${stage===4?'A = B = 0.5':'합 = 0'}`:'여러 높이에서 가로질러 그리면 만난 자리가 채워집니다.'}</span><button data-neuron-clear>그린 자국 지우기</button></div>`;
  }
  get("flCalculation").innerHTML=calculation+(interactive?`<p class="lesson-truth-rule">${lessonTruthRule()}</p>${lessonClassification(lessonTruth(point),r.logits)}`:'');
  const truth=lessonTruth(point), same=Math.abs(r.logits[0]!-r.logits[1]!)<1e-9;
  const predicted=same?'동점':r.logits[0]!>r.logits[1]!?'A':'B';
  const truthText=`정답 ${['A','B'][truth]}`;
  get("flSelected").innerHTML=stage===1?'':neuronDiagram(model,point,stage===0?1:stage);
  get("flVisualNote").textContent='';
  if(stage!==1)drawPixelLatentMap(get("flMap"),model,interactive?NEURON_EXAMPLES:[],point,identity,{view:stage>=2?"decision":"placement",neutralBackground:stage<4||!activity.linesShown,classLabels:["A","B"],showDataLabels:interactive,showNeuronBoundaries:stage>=2&&activity.foundHidden,showDecisionBoundary:stage>=4&&activity.foundOutput,axisLegend:axes,focusLabel:interactive?`${truthText} · 예상 ${predicted}`:`(${n(point[0])}, ${n(point[1])})`});
  if(interactive)drawNeuronTrace(get("flMap"),activity.strokes,stage===4);
}
