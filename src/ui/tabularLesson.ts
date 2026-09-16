import { lessonAnswerCorrect } from "../core/lessonQuiz";
import type { CustomDatasetDraft } from "../data/customDataset";
import { projectCustomDataset } from "../data/customDataset";
import { featureMovementExample } from "../core/featureLessonModel";
import { forwardPixels } from "../core/pixelNetwork";
import { drawPixelLatentMap, drawPixelNeuronMovement, pixelHiddenLineValue, pixelMapExampleAt } from "../visualization/pixelLatentMap";
import { workspacePanels } from "./workspacePanels";

const projection={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const fmt=(v:number)=>Number(v.toFixed(3));
export class TabularLesson {
  private step=1;private sample=0;private revealed=false;private frame=0;private timer=0;private prediction="";private passed=false;
  private draft!:CustomDatasetDraft;
  constructor(private root:HTMLElement,private changed:()=>void,private message:(s:string)=>void){
    const panel=root.querySelector<HTMLElement>(".custom-axis-panel")!;
    const nav=document.createElement("nav");nav.className="image-lesson-tabs";nav.innerHTML=["특징 계산","분포·선택","뉴런의 선","선 움직임"].map((s,i)=>`<button data-tl-step="${i+1}">${i+1} ${s}</button>`).join("");panel.prepend(nav);
    panel.querySelector(".page-kicker")!.remove();panel.querySelector("h2")!.id="tlTitle";
    panel.querySelector<HTMLElement>(".custom-separation")!.hidden=true;
    const body=document.createElement("div");body.className="tabular-lesson-body";body.innerHTML='<p id="tlText"></p><div id="tlCalc" class="image-calculation"></div><div id="tlPrediction" hidden><button data-tl-predict="up">뉴런 값이 커진다</button><button data-tl-predict="down">뉴런 값이 작아진다</button></div><button id="tlAction" class="button primary">계산 확인</button><form id="tlQuiz" class="image-quiz" hidden><label id="tlQuestion" for="tlAnswer"></label><div class="feature-answer"><input id="tlAnswer" aria-label="특징 이해 답"><button>확인</button></div><p id="tlFeedback" role="status"></p></form>';
    panel.append(body);root.classList.add("image-workspace");panel.classList.add("image-panel");
    root.addEventListener("click",e=>{const b=(e.target as HTMLElement).closest<HTMLElement>("[data-tl-step]");if(b){this.stop();this.step=Number(b.dataset.tlStep);this.revealed=false;this.frame=0;this.passed=false;this.prediction="";this.changed();}const p=(e.target as HTMLElement).closest<HTMLElement>("[data-tl-predict]");if(p){this.prediction=p.dataset.tlPredict!;this.changed();}});
    this.el("tlAction").addEventListener("click",()=>{if(this.step===4){if(!this.prediction)return this.message("움직이기 전에 값이 커질지 예상해 보세요.");this.stop();this.frame=0;const tick=()=>{this.frame++;this.revealed=true;this.timer=this.frame<30?window.setTimeout(tick,100):0;this.changed();};tick();}else{this.revealed=true;this.changed();}});
    this.el<HTMLFormElement>("tlQuiz").addEventListener("submit",e=>{e.preventDefault();const a=this.el<HTMLInputElement>("tlAnswer").value.trim(),row=this.draft.rows[this.sample]!;const right=lessonAnswerCorrect(this.step,a,this.step===1?row.values[this.draft.xFeature]!:0,.05);this.passed=right;this.el("tlFeedback").textContent=right?"맞아요. 다음 단계로 이어가 봅시다.":"위의 값과 그래프를 다시 확인해 보세요.";});
    document.getElementById("customFeatureNext")!.addEventListener("click",e=>{if(!this.passed){e.stopImmediatePropagation();return this.message("확인 문제를 먼저 풀어 주세요.");}if(this.step<4){e.stopImmediatePropagation();this.stop();this.step++;this.revealed=false;this.passed=false;this.el<HTMLInputElement>("tlAnswer").value="";this.el("tlFeedback").textContent="";this.changed();}},true);
    this.el<HTMLCanvasElement>("customFeatureCanvas").addEventListener("click",e=>{if(this.step===4)return;const data=projectCustomDataset(this.draft).points.map(p=>({pixels:[p.x,p.y],label:p.label}));const i=pixelMapExampleAt(e.currentTarget as HTMLCanvasElement,e.clientX,e.clientY,projection,data);if(i!==null){this.sample=i;this.revealed=false;this.changed();}});
    root.querySelectorAll("select").forEach(select=>select.addEventListener("change",()=>{this.stop();this.revealed=false;this.frame=0;this.passed=false;}));
    workspacePanels(root,[panel,root.querySelector("article")!],["탐구·확인","분포 지도"],this.changed);
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector(`#${id}`) as T;}
  stop():void{window.clearTimeout(this.timer);this.timer=0;}
  reset():void{this.stop();this.step=1;this.sample=0;this.revealed=false;this.frame=0;this.prediction="";this.passed=false;this.el<HTMLInputElement>("tlAnswer").value="";this.el("tlFeedback").textContent="";}
  render(draft:CustomDatasetDraft):void{
    this.draft=draft;if(!draft.rows.length)return;this.sample=Math.min(this.sample,draft.rows.length-1);
    const projected=projectCustomDataset(draft),data=projected.points.map(p=>({pixels:[p.x,p.y],label:p.label})),movement=featureMovementExample(data,projection,draft.classes.length);
    const i=this.step===4?movement.index:this.sample,row=draft.rows[i]!,point=data[i]!,before=movement.frames[0]!,after=movement.frames[this.frame]!;
    const legend={horizontal:{title:projected.axes[0],negative:"작음",positive:"큼"},vertical:{title:projected.axes[1],negative:"작음",positive:"큼"}};
    const canvas=this.el<HTMLCanvasElement>("customFeatureCanvas");
    if(this.step===4)drawPixelNeuronMovement(canvas,before,after,data,point.pixels,projection,row.name,0,legend);
    else drawPixelLatentMap(canvas,before,data,point.pixels,projection,{view:this.step===3&&this.revealed?"decision":"placement",showDecisionBoundary:false,onlyNeuron:0,axisLegend:legend,focusLabel:row.name});
    this.root.querySelectorAll<HTMLElement>(".axis-x,.axis-y").forEach(el=>el.hidden=true);
    this.root.querySelectorAll<HTMLElement>("[data-tl-step]").forEach(el=>el.classList.toggle("active",Number(el.dataset.tlStep)===this.step));
    this.root.querySelectorAll<HTMLElement>("label.field").forEach(el=>el.hidden=this.step>=3);
    const values=draft.rows.map(r=>r.values[draft.xFeature]!),low=Math.min(...values),high=Math.max(...values),v=row.values[draft.xFeature]!;
    this.el("tlTitle").textContent=["한 사례의 특징을 계산해요","두 특징을 바꾸어 분포를 봐요","뉴런의 기준을 선으로 봐요","한 사례의 학습 방향을 예상해요"][this.step-1]!;
    this.el("tlText").textContent=this.step===1?draft.inputKind==="text"?"공백을 뺀 글자 수, 공백으로 나눈 단어 수 등을 셉니다. 글의 의미를 이해하는 모델은 아닙니다.":"직접 측정한 수가 특징값입니다. 서로 다른 단위를 지도에 함께 놓기 위해 범위를 맞춥니다.":this.step===2?"같은 색이 모이는지, 다른 색과 겹치는지 비교해 보세요. 새 숫자 특징은 자료 단계에서 추가할 수 있습니다.":this.step===3?"두 특징에 연결값을 곱해 더한 합이 0인 곳이 뉴런 기준선입니다. 최종 정답 경계와는 다릅니다.":"이 예에서는 뉴런 값이 커져야 정답 점수가 커집니다. 여러 연결값을 고치되 대표선 하나만 관찰합니다.";
    const calc=this.el("tlCalc");calc.replaceChildren();const line=(text:string)=>{const span=document.createElement("span");span.textContent=text;calc.append(span);};
    if(this.step<=2){line(`${row.name} · 정답 ${draft.classes[row.label]}`);line(`${projected.axes[0]} = ${fmt(v)} / ${projected.axes[1]} = ${fmt(row.values[draft.yFeature]!)}`);if(this.revealed||this.step===2){line(Math.abs(high-low)<1e-9?"학습 자료의 값이 모두 같아 가로 좌표는 0입니다.":`가로 좌표 = (${fmt(v)} − ${fmt(low)}) ÷ (${fmt(high)} − ${fmt(low)}) × 1.8 − 0.9 ≈ ${fmt(point.pixels[0]!)}`);line("학습 자료의 최솟값은 −0.9, 최댓값은 +0.9. 값의 순서는 그대로입니다.");}}
    else if(this.step===3){line("가로 × 연결값 + 세로 × 연결값 + 시작값 = 0");line("보라 배경은 양수, 주황은 음수입니다. 화살표는 값이 커지는 쪽입니다.");}
    else{line(`같은 점의 합 ${fmt(pixelHiddenLineValue(before,point.pixels,0))} → ${fmt(pixelHiddenLineValue(after,point.pixels,0))}`);line(`정답 점수 ${(forwardPixels(before,point.pixels).probabilities[row.label]!*100).toFixed(1)}% → ${(forwardPixels(after,point.pixels).probabilities[row.label]!*100).toFixed(1)}%`);line("틀린 정도를 줄이는 방향으로 연결값을 고칩니다. 매번 같은 방향으로 움직이지는 않습니다.");if(this.frame===30)line(`${this.prediction==="up"?"예상대로":"예상과 달리"} 합이 커졌습니다. 점은 그대로이고 연결값과 기준선이 바뀌었습니다.`);}
    this.el("tlPrediction").hidden=this.step!==4||this.frame>=30;this.root.querySelectorAll<HTMLElement>("[data-tl-predict]").forEach(el=>el.setAttribute("aria-pressed",String(el.dataset.tlPredict===this.prediction)));
    this.el("tlAction").textContent=["값이 좌표가 되는 과정 보기","이 분포 확인하기","뉴런 기준선 보기",`${this.frame} / 30 · 실제 학습 보기`][this.step-1]!;
    this.el<HTMLButtonElement>("tlAction").disabled=this.step===4?this.timer!==0:this.revealed;
    this.el("tlQuiz").hidden=this.step===4?this.frame<30:!this.revealed;
    this.el("tlQuestion").textContent=[`${row.name}의 ${projected.axes[0]} 값은 얼마인가요?`,"이 분포에서 잘 모이면 새 자료도 반드시 맞힐까요? (예 / 아니요)","뉴런 기준선에서 합은 얼마인가요?","연결값을 바꾼 이유는 무엇인가요? (한 문장)"][this.step-1]!;
    document.getElementById("customFeatureNext")!.textContent=this.step===4?"이 특징으로 연습하기 →":"다음 탐구 →";
  }
}
