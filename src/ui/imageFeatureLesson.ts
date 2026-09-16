import { lessonAnswerCorrect } from "../core/lessonQuiz";
import { drawImagePixels } from "../core/imageInput";
import { featureCalculation, featureScore, imageFeatureLegend } from "../core/imageFeatures";
import { featureMovementExample } from "../core/featureLessonModel";
import { forwardPixels } from "../core/pixelNetwork";
import { projectPixels, projectionAxisDetails } from "../core/pixelProjection";
import type { ImageLabStore } from "../state/imageLabStore";
import { drawPixelLatentMap, drawPixelNeuronMovement, pixelHiddenLineValue, pixelMapExampleAt } from "../visualization/pixelLatentMap";
import { workspacePanels } from "./workspacePanels";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Math.abs(v) < .0005 ? "0" : v.toFixed(2);
export class ImageFeatureLesson {
  private step = 1;
  private reveal = 0;
  private pixel = 0;
  private sample = 0;
  private timer = 0;
  private frame = 0;
  private seen = new Set<string>();
  private passed = new Set<number>();
  private movement: ReturnType<typeof featureMovementExample> | null = null;
  private signature = "";
  private paint = Array<number>(196).fill(0);
  private prediction: string | null = null;
  constructor(private root: HTMLElement, private store: ImageLabStore, private next: () => void, private message: (s: string) => void) {
    root.innerHTML = `<div class="image-understanding feature-lesson"><section class="image-panel image-lesson-visual"><div class="image-heading"><h2 id="flVisualTitle">그림에서 특징 세기</h2><button id="flOther">다른 그림</button></div><canvas id="flPicture" width="420" height="420" aria-label="그림의 칸을 눌러 계산 확인"></canvas><canvas id="flMap" width="720" height="460" hidden aria-label="선택한 특징의 분포와 뉴런 기준선"></canvas><p id="flVisualNote"></p><div id="flSelected"></div></section><section class="image-panel image-lesson-copy"><nav class="image-lesson-tabs" aria-label="특징 이해 순서">${["특징 계산", "분포·선택", "뉴런의 선", "선 움직임"].map((s,i)=>`<button data-fl-step="${i+1}">${i+1} ${s}</button>`).join("")}</nav><h2 id="flTitle"></h2><p id="flText"></p><div class="feature-axis-pair"><label>가로 특징<select id="flX"></select></label><label>세로 특징<select id="flY"></select></label><button id="flCreate">+ 특징 만들기</button></div><div id="flCalculation" class="image-calculation"></div><div id="flPredict" class="image-quiz" hidden><strong>같은 점에서 뉴런의 합은 어떻게 바뀔까요?</strong><div><button data-fl-predict="up">커질 것 같아요</button><button data-fl-predict="down">작아질 것 같아요</button></div></div><button id="flAction" class="button primary"></button><form id="flQuiz" class="image-quiz"><label id="flQuestion" for="flAnswer"></label><div class="feature-answer"><input id="flAnswer" type="text" autocomplete="off" aria-label="확인 문제 답"><button>확인</button></div><p id="flFeedback" role="status"></p></form><button id="flNext" class="button secondary">다음 →</button></section></div>
    <dialog id="flEditor"><form method="dialog" class="feature-editor"><div class="image-heading"><h2>어느 부분을 셀까요?</h2><button value="cancel" aria-label="특징 만들기 닫기">×</button></div><p>칸을 누르거나 드래그하세요. 주황은 더하기, 보라는 빼기입니다.</p><input id="flName" maxlength="18" placeholder="예: 위쪽 가운데 진하기" aria-label="새 특징 이름"><div class="feature-brush"><label><input type="radio" name="flBrush" value="1" checked> +1 더하기</label><label><input type="radio" name="flBrush" value="-1"> −1 빼기</label><label><input type="radio" name="flBrush" value="0"> 세지 않기</label></div><canvas id="flMask" width="420" height="420" aria-label="새 특징에서 더하고 뺄 칸 고르기"></canvas><p id="flEditorError" role="status"></p><button id="flSave" type="button" class="button primary">특징 추가</button></form></dialog>`;
    const click = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn);
    root.addEventListener("click", e => {
      const target = e.target as HTMLElement;
      const step = target.closest<HTMLElement>("[data-fl-step]");
      if (step) { this.stop(); this.step = Number(step.dataset.flStep); this.reveal = 0; this.frame = 0; this.prediction = null; this.passed.delete(this.step); this.el<HTMLInputElement>("flAnswer").value=""; this.el("flFeedback").textContent = ""; this.render(); }
      const prediction = target.closest<HTMLElement>("[data-fl-predict]");
      if (prediction) { this.prediction = prediction.dataset.flPredict!; this.render(); }
    });
    ["flX", "flY"].forEach(id => this.el(id).addEventListener("change", () => {
      const error = store.setAxes(this.el<HTMLSelectElement>("flX").value, this.el<HTMLSelectElement>("flY").value);
      if (error) message(error); else { this.seen.add(`${store.snapshot.xFeature}/${store.snapshot.yFeature}`); this.reveal = 0; this.passed.clear(); this.el<HTMLInputElement>("flAnswer").value=""; this.el("flFeedback").textContent=""; this.signature = ""; }
      this.render();
    }));
    click("flOther", () => { this.sample = (this.sample + 1) % Math.max(1, store.snapshot.data.length); this.reveal = 0; this.passed.delete(1); this.render(); });
    this.el<HTMLCanvasElement>("flPicture").addEventListener("click", e => { const r = this.el("flPicture").getBoundingClientRect(); this.pixel = Math.min(195, Math.floor((e.clientY-r.top)/r.height*14)*14+Math.floor((e.clientX-r.left)/r.width*14)); this.render(); });
    this.el<HTMLCanvasElement>("flMap").addEventListener("click", e => { const s = store.snapshot; const i = pixelMapExampleAt(this.el("flMap"),e.clientX,e.clientY,s.projection,s.data); if (i !== null && this.step !== 4) { this.sample = i; this.render(); } });
    click("flAction", () => {
      if (this.step === 4) {
        if (!this.prediction) return message("먼저 값이 커질지, 작아질지 예상해 보세요.");
        this.stop(); this.frame = 0;
        const tick = () => { this.frame++; this.reveal = 1; this.timer = this.frame < 30 ? window.setTimeout(tick, 100) : 0; this.render(); }; tick();
      } else { this.reveal = Math.min(3, this.reveal + 1); this.render(); }
    });
    this.el<HTMLFormElement>("flQuiz").addEventListener("submit", e => {
      e.preventDefault(); const answer = this.el<HTMLInputElement>("flAnswer").value.trim(); const s = store.snapshot;
      const total = featureScore(s.features.find(f=>f.id === s.xFeature)!, s.data[this.sample]?.pixels ?? s.input);
      const right = lessonAnswerCorrect(this.step, answer, this.step === 1 ? total : 0);
      this.el("flFeedback").textContent = right ? "맞아요. 확인한 내용을 다음 단계에 이어서 써 봅시다." : "계산과 그림을 다시 확인해 보세요. 4번에서는 예상과 정답이 어떻게 다른지 적어 보세요.";
      if (right) this.passed.add(this.step);
    });
    click("flNext", () => {
      if (!this.passed.has(this.step)) return message("위의 확인 문제를 먼저 풀어 보세요.");
      if (this.step === 4) { store.setMode("map"); this.next(); } else { this.stop(); this.step++; this.reveal=0; this.el<HTMLInputElement>("flAnswer").value=""; this.el("flFeedback").textContent=""; this.render(); }
    });
    click("flCreate", () => { this.paint.fill(0); this.el<HTMLInputElement>("flName").value=""; this.el("flEditorError").textContent=""; this.drawMask(); this.el<HTMLDialogElement>("flEditor").showModal(); });
    let painting = false;
    const mask = this.el<HTMLCanvasElement>("flMask");
    const paint = (e: PointerEvent) => { if(!painting) return; const r=mask.getBoundingClientRect(); const x=Math.floor((e.clientX-r.left)/r.width*14),y=Math.floor((e.clientY-r.top)/r.height*14); if(x<0||x>=14||y<0||y>=14)return; this.paint[y*14+x]=Number(this.root.querySelector<HTMLInputElement>('input[name="flBrush"]:checked')!.value); this.drawMask(); };
    mask.addEventListener("pointerdown", e=>{painting=true;mask.setPointerCapture(e.pointerId);paint(e);}); mask.addEventListener("pointermove",paint); mask.addEventListener("pointerup",()=>painting=false); mask.addEventListener("pointercancel",()=>painting=false);
    click("flSave",()=>{ const error=store.addFeature(this.el<HTMLInputElement>("flName").value,this.paint); if(error)this.el("flEditorError").textContent=error;else{this.el<HTMLDialogElement>("flEditor").close();message("새 특징을 추가했습니다. 가로 또는 세로에서 선택해 보세요.");this.render();} });
    workspacePanels(root, [...root.querySelector(".image-understanding")!.children], ["그림·그래프", "탐구·확인"], () => { if(this.store.snapshot.data.length)this.render(); });
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T { return this.root.querySelector(`#${id}`) as T; }
  stop(): void { window.clearTimeout(this.timer);this.timer=0; }
  reset(): void {this.stop();this.step=1;this.reveal=0;this.sample=0;this.frame=0;this.signature="";this.seen.clear();this.passed.clear();this.prediction=null;this.el<HTMLInputElement>("flAnswer").value="";this.el("flFeedback").textContent="";}
  openFeatures(): void {this.step=2;this.reveal=0;this.render();}
  private drawMask():void {const c=this.el<HTMLCanvasElement>("flMask"),ctx=c.getContext("2d")!;this.paint.forEach((v,i)=>{ctx.fillStyle=v>0?"#ffe0bf":v<0?"#dbccff":"white";ctx.fillRect(i%14*30,Math.floor(i/14)*30,30,30);ctx.strokeStyle="#d6dbe2";ctx.strokeRect(i%14*30,Math.floor(i/14)*30,30,30);});}
  render(): void {
    const s=this.store.snapshot;if(!s.data.length)return;
    const signature=`${s.revision}:${s.xFeature}:${s.yFeature}`;
    if(signature!==this.signature){this.stop();this.movement=featureMovementExample(s.data,s.projection,s.classes.length);this.signature=signature;this.frame=0;const f=s.features.find(f=>f.id===s.xFeature)!;this.pixel=s.data[this.sample]?.pixels.reduce((best,v,i,all)=>Math.abs(f.weights[i]!)>0 && (v>all[best]! || v===all[best]! && Math.abs(f.weights[i]!)>Math.abs(f.weights[best]!))?i:best,0)??0;}
    this.sample=Math.min(this.sample,s.data.length-1);
    this.seen.add(`${s.xFeature}/${s.yFeature}`);
    const example=s.data[this.step===4?this.movement!.index:this.sample]!;
    const feature=s.features.find(f=>f.id===s.xFeature)!;
    ["flX","flY"].forEach((id,i)=>{ const select=this.el<HTMLSelectElement>(id); const value=i?s.yFeature:s.xFeature; select.innerHTML=s.features.map(f=>`<option value="${f.id}" ${f.id===value?"selected":""}>${esc(f.name)}</option>`).join(""); });
    this.root.querySelectorAll<HTMLElement>("[data-fl-step]").forEach(b=>{b.classList.toggle("active",Number(b.dataset.flStep)===this.step);b.setAttribute("aria-pressed",String(Number(b.dataset.flStep)===this.step));});
    this.el("flPicture").hidden=this.step!==1;this.el("flMap").hidden=this.step===1;this.el("flOther").hidden=this.step>=3;
    (this.root.querySelector(".feature-axis-pair") as HTMLElement).hidden=this.step>=3;
    (this.root.querySelector(".feature-axis-pair label:nth-child(2)") as HTMLElement).hidden=this.step===1;
    this.el("flCreate").hidden=this.step!==2;
    const map=this.el<HTMLCanvasElement>("flMap"),legend=imageFeatureLegend(s.features,s.xFeature,s.yFeature);
    const calc=featureCalculation(feature,example.pixels), pos=projectPixels(s.projection,example.pixels);
    const term=calc.terms[this.pixel]!;
    const before=this.movement!.frames[0]!,after=this.movement!.frames[this.frame]!;
    const titles=["그림에서 어떤 수를 셀까요?","어떤 두 특징이 구별에 도움이 될까요?","뉴런의 기준을 선으로 봐요","이 그림을 다시 배우면 선은 어디로 갈까요?"];
    const texts=[feature.description,"가로·세로를 바꾸거나 직접 특징을 만들어 보세요. 점 하나는 그림 한 장입니다.","은닉 뉴런은 두 특징에 연결값을 곱해 더합니다. 그 합이 0인 곳을 기준선으로 그립니다. 기준선 자체가 최종 정답 경계는 아닙니다.","정답 점수가 낮은 한 그림을 골랐습니다. 이 예에서는 정답 점수를 높이려면 뉴런 값이 커져야 합니다. 실제 학습을 30번 천천히 봅니다."];
    this.el("flTitle").textContent=titles[this.step-1]!;this.el("flText").textContent=texts[this.step-1]!;
    this.el("flVisualTitle").textContent=this.step===1?`정답 ${s.classes[example.label]} · ${feature.name}`:this.step===4?"대표 뉴런 1개의 실제 변화":"고른 두 특징의 분포";
    if(this.step===1){
      const canvas=this.el<HTMLCanvasElement>("flPicture");drawImagePixels(canvas,example.pixels,true,this.pixel);const ctx=canvas.getContext("2d")!,cell=canvas.width/14;
      if(this.reveal)feature.weights.forEach((w,i)=>{if(w===0)return;ctx.fillStyle=w>0?"rgba(241,118,5,.2)":"rgba(116,70,245,.2)";ctx.fillRect(i%14*cell,Math.floor(i/14)*cell,cell,cell);});
    }else if(this.step===4) drawPixelNeuronMovement(map,before,after,s.data,example.pixels,s.projection,`정답 ${s.classes[example.label]}`,0,legend);
    else drawPixelLatentMap(map,before,s.data,example.pixels,s.projection,{view:this.step===2?"placement":"decision",axisLegend:legend,showDecisionBoundary:false,showNeuronBoundaries:this.reveal>0,onlyNeuron:0,focusLabel:`정답 ${s.classes[example.label]}`});
    const detail=projectionAxisDetails(s.projection,example.pixels,"horizontal"), mean=featureScore(feature,s.projection.mean);
    const selected=this.el("flSelected");selected.innerHTML=this.step>1?`<canvas width="70" height="70" aria-label="선택한 점의 그림"></canvas><span>정답 ${esc(s.classes[example.label]!)}<br>가로 ${n(pos.x)} · 세로 ${n(pos.y)}</span>`:"";if(this.step>1)drawImagePixels(selected.querySelector("canvas")!,example.pixels);
    this.el("flVisualNote").textContent=this.step===1?"주황 칸은 더하기 · 보라 칸은 빼기 · 칸을 눌러 한 항씩 확인":this.step===3?"보라 배경: 합이 양수 · 주황 배경: 합이 음수":this.step===4?`점은 그대로 · 회색은 학습 전 · 보라는 ${this.frame}번 학습 후`:"지도 좌표는 학습 자료의 평균을 0으로, 범위를 −0.9~+0.9 안으로 맞춘 값입니다.";
    this.el("flCalculation").innerHTML=this.step===1?`<span>${Math.floor(this.pixel/14)+1}행 ${this.pixel%14+1}열: 진하기 ${n(term.pixel)} × 곱할 값 ${n(term.weight)} ≈ <b>${n(term.product)}</b></span>${this.reveal>=1?`<span>더할 값 합 ${n(calc.positive)} · 뺄 값 합 ${n(Math.abs(calc.negative))}</span>`:""}${this.reveal>=2?`<b>특징값 = ${n(calc.positive)} − ${n(Math.abs(calc.negative))} ≈ ${n(calc.total)}</b>`:""}${this.reveal>=3?`<span>가로 좌표 = (${n(calc.total)} − 평균 ${n(mean)}) ÷ ${n(s.projection.horizontalScale)} ≈ ${n(detail.mapScore)}<br>표시한 수는 반올림했습니다. 줄여도 크기 순서는 같습니다.</span>`:""}`:this.step===2?`<span>이 그림: 가로 특징값 ${n(calc.total)} → 좌표 ${n(pos.x)}<br>세로 특징값 ${n(featureScore(s.features.find(f=>f.id===s.yFeature)!,example.pixels))} → 좌표 ${n(pos.y)}</span><b>${this.seen.size}가지 조합 살펴봄</b>`:this.step===3?`<b>가로 값 × 연결값 + 세로 값 × 연결값 + 시작값</b><span>이 합이 0인 곳 = 색 기준선<br>화살표 = 합이 커지는 쪽<br>여러 뉴런을 합친 최종 답의 경계 = 검은 선</span>`:`<b>같은 점의 합: ${n(pixelHiddenLineValue(before,example.pixels,0))} → ${n(pixelHiddenLineValue(after,example.pixels,0))}</b><span>정답 점수: ${(forwardPixels(before,example.pixels).probabilities[example.label]!*100).toFixed(1)}% → ${(forwardPixels(after,example.pixels).probabilities[example.label]!*100).toFixed(1)}%<br>이 그림에서 틀린 정도를 줄이려고 연결값·시작값을 함께 바꿉니다. 다른 그림에서는 방향이 달라질 수 있습니다.${this.frame===30?`<br>${this.prediction==="up"?"예상대로":"예상과 달리"} 합이 커졌습니다. 선이 점을 지나면서 합이 음수에서 양수로 바뀌었습니다.`:""}</span>`;
    this.el("flPredict").hidden=this.step!==4;
    this.root.querySelectorAll<HTMLElement>("[data-fl-predict]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.flPredict===this.prediction)));
    const action=this.el<HTMLButtonElement>("flAction");action.textContent=this.step===1?["더하고 뺄 칸 보기","합 확인하기","이 값이 좌표가 되는 과정","계산 확인 완료"][this.reveal]!:this.step===2?"이 조합으로 분포 확인":this.step===3?"뉴런 1개의 기준선 보기":this.frame?`${this.frame} / 30번 · 다시 보기`:"예상한 방향과 실제 학습 비교";
    action.disabled=this.step===1?this.reveal>=3:this.step===4?this.timer!==0: this.reveal>0;
    action.hidden=this.step===1&&this.reveal>=3;
    this.el("flQuiz").hidden=this.step===4?this.frame<30: this.step===1?this.reveal<1:!this.reveal;
    this.el("flQuestion").textContent=[`위 합을 이용해 ${feature.name}의 특징값을 계산해 적어 보세요. (소수 둘째 자리)`,"이 두 특징에서 같은 색 점이 모였다고 새 그림도 반드시 맞힐까요? (예 / 아니요)","은닉 뉴런의 기준선에서는 합이 얼마인가요?","이번에 연결값을 바꾼 이유는 무엇인가요? (한 문장)"][this.step-1]!;
    this.el("flNext").textContent=this.step===4?"고른 특징으로 직접 학습하기 →":"다음 →";
  }
}
