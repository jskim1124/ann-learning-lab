import { forwardPixels } from "../core/pixelNetwork";
import { biasDirectionExample, interpolatePixelModel, outputScoreBreakdown, outputTeachingModel } from "../core/lessonArithmetic";
import { featureMovementExample } from "../core/featureLessonModel";
import { imageFeatureLegend } from "../core/imageFeatures";
import type { ImageState } from "../state/imageLabStore";
import { drawPixelLatentMap, hiddenPlane, pixelHiddenLineValue } from "../visualization/pixelLatentMap";
import { drawLessonMovement } from "../visualization/lessonMovement";
import { projectPixels } from "../core/pixelProjection";
import { NEURON_COLORS } from "../visualization/neuronColors";

import { neuronDiagram } from "./neuronDiagram";

const n=(v:number)=>Number(v.toFixed(2)).toString();
const identity={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const axes={horizontal:{title:"가로 입력값",negative:"−1",positive:"+1"},vertical:{title:"세로 입력값",negative:"−1",positive:"+1"}};
export interface SceneQuiz { question:string; choices:Array<{text:string;correct:boolean}>; explanation:string; }
const el=<T extends HTMLElement=HTMLElement>(root:HTMLElement,id:string)=>root.querySelector<T>(`#${id}`)!;

export function renderOutputScene(root:HTMLElement,focus:number[],stage:number,hidden:number):SceneQuiz {
  const model=outputTeachingModel(hidden),r=outputScoreBreakdown(model,focus),labels=["A","B","C"];
  const sums=model.inputHidden.map((w,i)=>w[0]!*focus[0]!+w[1]!*focus[1]!+model.hiddenBias[i]!);
  el(root,"flTitle").textContent=["곱하고 더해서 뉴런의 합 만들기","합이 음수면 0, 양수면 그대로","클래스마다 출력 점수 하나씩","출력 점수를 합계 100%로 바꾸기","은닉 뉴런 수와 클래스 수는 달라요"][stage]!;
  el(root,"flVisualTitle").textContent="뉴런이 몇 개든 A·B·C 세 가지를 비교해요";
  el(root,"flText").textContent=["앞 예제의 처음 계산에 답 C를 하나 더 붙였습니다. 가로·세로 점을 움직이며 같은 계산을 다시 확인해 보세요.","이 예제는 가장 간단한 변환을 씁니다. 합이 −0.2면 신호 0, 합이 0.6이면 신호 0.6입니다.","출력 A·B·C는 각 뉴런 신호에 연결값을 곱해 더합니다. 가장 큰 점수의 답을 고릅니다.","음수도 가능한 출력값을 같은 변환표로 양수로 바꿉니다. 그 뒤 전체 합으로 나누고 100을 곱합니다. 아래는 실제 계산값입니다.","은닉 뉴런은 판단에 쓸 기준을 만듭니다. 출력은 클래스마다 하나씩입니다. 은닉 뉴런 1개여도 A·B·C 점수 3개를 계산하지만, 잘 구분할 수 있다는 보장은 아닙니다."][stage]!;
  let html="";
  if(stage<2)html=model.inputHidden.map((w,i)=>`<span style="color:${NEURON_COLORS[i]}">뉴런 ${i+1}: ${n(focus[0]!)} × ${n(w[0]!)} + ${n(focus[1]!)} × (${n(w[1]!)}) + ${n(model.hiddenBias[i]!)} = <b>${n(sums[i]!)}</b>${stage===1?` → 신호 <b>${n(r.hidden[i]!)}</b>`:""}</span>`).join("")+"<span>이 예제의 연결값은 계산하기 쉽게 정했습니다. 실제 연습에서는 학습으로 바뀝니다.</span>";
  else if(stage===2)html=model.hiddenOutput.map((w,c)=>`<span>출력 ${labels[c]}: ${w.map((v,h)=>`${n(r.hidden[h]!)} × (${n(v)})`).join(" + ")} + ${n(model.outputBias[c]!)} = <b>${n(r.logits[c]!)}</b></span>`).join("")+"<span>검은 경계는 1등 출력이 바뀌는 곳입니다. 색 선 한 개를 그대로 복사한 선이 아닙니다.</span>";
  else if(stage===3)html=`<div class="score-conversion">${labels.map((label,i)=>`<span><b>${label}</b> 출력 ${n(r.logits[i]!)} → 양수 ${r.positive[i]!.toFixed(3)}</span>`).join("")}</div><b>B: ${r.positive[1]!.toFixed(3)} ÷ ${r.total.toFixed(3)} × 100 ≈ ${(r.probabilities[1]!*100).toFixed(1)}%</b><span>전체 합 ${r.positive.map(v=>v.toFixed(3)).join(" + ")} ≈ ${r.total.toFixed(3)}</span><details class="conversion-help"><summary>양수는 어떤 규칙으로 바뀌나요?</summary><p>항상 같은 곡선의 변환표를 씁니다. 예를 들어 −1 → 0.368, 0 → 1, 1 → 2.718입니다. 출력이 클수록 더 큰 양수가 됩니다. 계산기 내부의 식은 exp(출력값)이며, 이 식을 외울 필요는 없습니다.</p></details>`;
  else html=`<div class="neuron-count-example"><b>은닉 ${hidden}개 → 출력 3개</b><span>은닉 뉴런 수를 바꾸어 비교하세요.</span><div>${[1,2].map(count=>`<button data-output-neurons="${count}" aria-pressed="${count===hidden}">은닉 뉴런 ${count}개</button>`).join("")}</div></div><span>세 클래스의 경계 개수가 꼭 3개인 것도 아닙니다. 각 위치에서 1등인 답이 바뀌는 곳에만 경계가 있습니다.</span>`;
  el(root,"flCalculation").innerHTML=html;
  el(root,"flSelected").innerHTML=`<div class="lesson-signal-flow"><span>입력<br><b>${n(focus[0]!)} · ${n(focus[1]!)}</b></span><i>→</i><span>${r.hidden.map((v,i)=>`<b style="color:${NEURON_COLORS[i]}">뉴런 ${i+1}: ${n(v)}</b>`).join("<br>")}</span><i>→</i><span>${labels.map((l,i)=>`${l} ${stage>=3?`${(r.probabilities[i]!*100).toFixed(1)}%`:n(r.logits[i]!)}`).join("<br>")}</span></div>`;
  el(root,"flVisualNote").textContent="배경색 = 1등 클래스 · 검은 선 = 최종 경계 · 색 선 = 은닉 뉴런의 합이 0인 곳";
  drawPixelLatentMap(el(root,"flMap"),model,[],focus,identity,{view:"decision",classLabels:labels,showNeuronBoundaries:true,showDecisionBoundary:stage>=2,axisLegend:axes,focusLabel:"움직여 볼 점"});
  return {question:"클래스가 3개이고 은닉 뉴런이 1개라면?",choices:[{text:"출력 점수는 3개, 잘 구분하는지는 학습 후 확인",correct:true},{text:"은닉 뉴런이 1개이므로 클래스도 1개",correct:false}],explanation:"이 다중 분류 모델은 클래스마다 출력 하나를 둡니다. 은닉 뉴런 수는 클래스 수를 정하지 않습니다."};
}

export function renderMovementScene(root:HTMLElement,s:ImageState,toy:boolean,frame:number,bias:ReturnType<typeof biasDirectionExample>,movement:ReturnType<typeof featureMovementExample>):SceneQuiz {
  const frames=toy?bias.frames:movement.frames,lo=Math.floor(frame),hi=Math.min(frames.length-1,lo+1);
  const before=frames[0]!,after=interpolatePixelModel(frames[lo]!,frames[hi]!,frame-lo),point=toy?bias.point:movement.example.pixels,projection=toy?identity:s.projection;
  const r=forwardPixels(after,point),old=forwardPixels(before,point),p=projectPixels(projection,point),label=toy?1:movement.example.label;
  el(root,"flTitle").textContent=toy?"선을 왼쪽으로 옮기면 이 점은?":"같은 원리를 내 자료에 적용해요";
  el(root,"flVisualTitle").textContent="점은 고정 · 계산값과 경계가 함께 이동";
  el(root,"flText").textContent=toy?"점의 위치는 (0.2, 0.2), 정답은 B입니다. 다른 값은 고정하고 더해주는 값만 0.1씩 늘려 봅니다. 퍼센트가 아닌 ‘출력 점수’로 비교합니다.":"실제 학습은 오차가 줄어드는 방향을 계산해 여러 연결값을 함께 고칩니다. 이 예제에서는 한 그림을 반복 학습하고 대표선 하나를 봅니다.";
  if(toy){const b=after.hiddenBias[0]!;
    el(root,"flCalculation").innerHTML=`<span>① 뉴런의 합: 0.2 × 1 + 0.2 × 0.5 + <b>${n(b)}</b> = <b>${n(.3+b)}</b></span><div class="movement-scores"><span>A <b>${n(r.logits[0]!)}</b></span><span>B <b>${n(r.logits[1]!)}</b></span><strong>${Math.abs(r.logits[0]!-r.logits[1]!)<1e-8?"같은 점수":r.logits[0]!>r.logits[1]! ? "지금 예상 A":"지금 예상 B"}</strong></div><span>더해주는 값이 0.1 커지면 신호는 0.1 커지고, A는 0.1 작아지고 B는 0.1 커집니다.</span>`;
    el(root,"flSelected").innerHTML=neuronDiagram(after,point,3);
    el(root,"flCalculation").innerHTML+=`<span>검은 경계는 신호가 0.5인 곳. 세로 0.2에서는<br>가로 + 0.1 + ${n(b)} = 0.5 → 가로 <b>${n(.4-b)}</b></span>`;
    el(root,"flVisualNote").textContent="보라선: 은닉 뉴런의 합 0 · 검은 선: A와 B가 같은 점수 · 파란 화살표: 검은 경계의 이동";
  }else{const a=hiddenPlane(before,projection,0),b=hiddenPlane(after,projection,0);
    el(root,"flCalculation").innerHTML=`<span>전: ${n(p.x)} × ${n(a.horizontal)} + ${n(p.y)} × (${n(a.vertical)}) + (${n(a.constant)}) ≈ ${n(pixelHiddenLineValue(before,point,0))}</span><span>후: ${n(p.x)} × ${n(b.horizontal)} + ${n(p.y)} × (${n(b.vertical)}) + (${n(b.constant)}) ≈ ${n(pixelHiddenLineValue(after,point,0))}</span><span>정답의 출력 점수: ${n(old.logits[label]!)} → <b>${n(r.logits[label]!)}</b></span><span>다른 출력들과 함께 비교합니다. 한 뉴런의 값이 커진다고 언제나 정답 점수가 커지는 것은 아닙니다.</span>`;
    el(root,"flVisualNote").textContent="점 색은 정답, 배경은 모델의 현재 예상입니다. 은닉 기준선과 최종 경계는 다를 수 있습니다.";
  }
  drawLessonMovement(el(root,"flMap"),before,after,toy?[{pixels:point,label:1}]:s.data,point,projection,toy?["A","B"]:s.classes,toy?axes:imageFeatureLegend(s.features,s.xFeature,s.yFeature),toy);
  return {question:toy?"이 예제에서 더해주는 값을 늘리면?":"학습이 선을 움직이는 목적은?",choices:[{text:toy?"고정된 점이 오른쪽으로 이동한다":"선을 언제나 같은 방향으로 보내려고",correct:false},{text:toy?"점은 그대로, B 점수가 커지고 경계는 왼쪽으로":"정답과의 오차를 줄이려고",correct:true}],explanation:toy?"점은 움직이지 않습니다. 경계 위 합은 같아야 하므로 더해주는 값이 늘면 가로 위치는 줄어듭니다.":"실제 학습은 여러 값을 함께 고칩니다. 어떤 방향으로 고칠지는 자료와 현재 모델에 따라 달라집니다."};
}
