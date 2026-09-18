import { forwardPixels } from "../core/pixelNetwork";
import { biasDirectionExample, interpolatePixelModel } from "../core/lessonArithmetic";
import { featureMovementExample } from "../core/featureLessonModel";
import { imageFeatureLegend } from "../core/imageFeatures";
import type { ImageState } from "../state/imageLabStore";
import { hiddenPlane, pixelHiddenLineValue } from "../visualization/pixelLatentMap";
import { drawLessonMovement } from "../visualization/lessonMovement";
import { projectPixels } from "../core/pixelProjection";


import { neuronDiagram } from "./neuronDiagram";
import { classBadge } from './lessonClassification';

const n=(v:number)=>Number(v.toFixed(2)).toString();
const identity={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const axes={horizontal:{title:"가로 입력값",negative:"−1",positive:"+1"},vertical:{title:"세로 입력값",negative:"−1",positive:"+1"}};
export interface SceneQuiz { question:string; choices:Array<{text:string;correct:boolean}>; explanation:string; }
const el=<T extends HTMLElement=HTMLElement>(root:HTMLElement,id:string)=>root.querySelector<T>(`#${id}`)!;

export { renderOutputScene } from "./outputLesson";

export function renderMovementScene(root:HTMLElement,s:ImageState,toy:boolean,frame:number,bias:ReturnType<typeof biasDirectionExample>,movement:ReturnType<typeof featureMovementExample>):SceneQuiz {
  const frames=toy?bias.frames:movement.frames,lo=Math.floor(frame),hi=Math.min(frames.length-1,lo+1);
  const before=frames[0]!,after=toy?{...before,hiddenBias:[frame/10]}:interpolatePixelModel(frames[lo]!,frames[hi]!,frame-lo),point=toy?bias.point:movement.example.pixels,projection=toy?identity:s.projection;
  const r=forwardPixels(after,point),old=forwardPixels(before,point),p=projectPixels(projection,point),label=toy?1:movement.example.label;
  el(root,"flTitle").textContent=toy?"마지막에 더하는 수만 바꿔 볼까요?":"같은 원리를 내 자료에 적용해요";
  el(root,"flVisualTitle").textContent="점은 고정 · 계산값과 경계가 함께 이동";
  el(root,"flText").textContent=toy?"점 (0.2, 0.2)의 정답은 B입니다. 슬라이더는 보라색 수 한 곳만 바꿉니다. 입력이나 곱할 수는 바꾸지 않아요.":"실제 학습은 오차가 줄어드는 방향을 계산해 여러 연결값을 함께 고칩니다. 이 예제에서는 한 그림을 반복 학습하고 대표선 하나를 봅니다.";
  if(toy){const b=after.hiddenBias[0]!;
    el(root,"flCalculation").innerHTML=`<div class="movement-scores"><span>정답 B 점수<small>처음 0.3 → ${n(r.logits[1]!)}</small></span>${Math.abs(r.logits[0]!-r.logits[1]!)<1e-8?'<strong>같은 점수</strong>':classBadge(r.logits[0]!>r.logits[1]!?'지금 예상 A':'지금 예상 B',r.logits[0]!>r.logits[1]!?0:1)}</div><span>연결지도의 보라색 더할 수만 바뀝니다. 검은 경계의 가로 위치는 ${n(.4-b)}예요.</span>${.3+b<0?'<span>합이 음수라 0을 보냅니다. 여기서는 수를 더 줄여도 B는 0입니다.</span>':''}`;
    el(root,"flSelected").innerHTML=neuronDiagram(after,point,3);
    el(root,"flVisualNote").textContent='';
    el(root,"flSourceNote").textContent="한 수만 직접 바꾸는 작은 실험 · 실제 학습은 여러 연결값을 함께 고칩니다.";
  }else{const a=hiddenPlane(before,projection,0),b=hiddenPlane(after,projection,0);
    el(root,"flCalculation").innerHTML=`<span>전: ${n(p.x)} × ${n(a.horizontal)} + ${n(p.y)} × (${n(a.vertical)}) + (${n(a.constant)}) ≈ ${n(pixelHiddenLineValue(before,point,0))}</span><span>후: ${n(p.x)} × ${n(b.horizontal)} + ${n(p.y)} × (${n(b.vertical)}) + (${n(b.constant)}) ≈ ${n(pixelHiddenLineValue(after,point,0))}</span><span>정답의 출력 점수: ${n(old.logits[label]!)} → <b>${n(r.logits[label]!)}</b></span><span>다른 출력들과 함께 비교합니다. 한 뉴런의 값이 커진다고 언제나 정답 점수가 커지는 것은 아닙니다.</span>`;
    el(root,"flVisualNote").textContent="점 색은 정답, 배경은 모델의 현재 예상입니다. 은닉 기준선과 최종 경계는 다를 수 있습니다.";
  }
  drawLessonMovement(el(root,"flMap"),before,after,toy?[{pixels:point,label:1}]:s.data,point,projection,toy?["A","B"]:s.classes,toy?axes:imageFeatureLegend(s.features,s.xFeature,s.yFeature),toy);
  return {question:toy?"이 예제에서 더해주는 값을 늘리면?":"학습이 선을 움직이는 목적은?",choices:[{text:toy?"고정된 점이 오른쪽으로 이동한다":"선을 언제나 같은 방향으로 보내려고",correct:false},{text:toy?"점은 그대로, B 점수가 커지고 경계는 왼쪽으로":"정답과의 오차를 줄이려고",correct:true}],explanation:toy?"점은 움직이지 않습니다. 경계 위 합은 같아야 하므로 더해주는 값이 늘면 가로 위치는 줄어듭니다.":"실제 학습은 여러 값을 함께 고칩니다. 어떤 방향으로 고칠지는 자료와 현재 모델에 따라 달라집니다."};
}
