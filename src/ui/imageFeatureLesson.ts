import { drawImagePixels } from "../core/imageInput";
import { featureCalculation, featureScore, imageFeatureLegend } from "../core/imageFeatures";
import { smallFeatureExample, outputTeachingModel, biasDirectionExample, numberChoices } from "../core/lessonArithmetic";
import { featureMovementExample } from "../core/featureLessonModel";
import { forwardPixels } from "../core/pixelNetwork";
import { projectPixels } from "../core/pixelProjection";
import type { ImageLabStore } from "../state/imageLabStore";
import { drawPixelLatentMap, drawPixelNeuronMovement, hiddenPlane, pixelHiddenLineValue, pixelMapExampleAt } from "../visualization/pixelLatentMap";
import { NEURON_COLORS } from "../visualization/neuronColors";
import { workspacePanels } from "./workspacePanels";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Number(v.toFixed(2)).toString();
const identity = { mean: [0, 0], horizontal: [1, 0], vertical: [0, 1], horizontalScale: 1, verticalScale: 1 };
type Choice = { text: string; correct: boolean };

/** Small examples and real data are separate. Animation frames always show real arithmetic. */
export class ImageFeatureLesson {
  private step = 1;
  private reveal = 0;
  private sample = 0;
  private pixel = 0;
  private timer = 0;
  private frame = 0;
  private example = true;
  private passed = new Set<number>();
  private answer: number | null = null;
  private prediction: string | null = null;
  private paint = Array<number>(196).fill(0);
  private signature = "";
  private movement: ReturnType<typeof featureMovementExample> | null = null;
  private focus = [.4, .2];
  private bias = biasDirectionExample();
  constructor(private root: HTMLElement, private store: ImageLabStore, private next: () => void, private message: (s: string) => void) {
    root.innerHTML = `<div class="image-understanding feature-lesson">
      <section class="image-panel image-lesson-visual"><div class="image-heading"><h2 id="flVisualTitle"></h2><button id="flOther">다른 자료</button></div>
        <div id="flExampleTabs" class="lesson-source-tabs"><button data-fl-source="example">작은 예제로 배우기</button><button data-fl-source="data">내 자료에서 확인</button></div>
        <p id="flSourceNote"></p><div id="flTiny" class="tiny-calculation"></div><canvas id="flPicture" width="420" height="420" hidden aria-label="실제 그림의 칸을 눌러 계산 확인"></canvas>
        <canvas id="flMap" width="720" height="460" hidden aria-label="특징 분포와 뉴런·최종 경계"></canvas>
        <div id="flPointControl"><label>점의 가로 위치 <input id="flPointX" type="range" min="-.9" max=".9" step=".05" value=".4"></label><label>점의 세로 위치 <input id="flPointY" type="range" min="-.9" max=".9" step=".05" value=".2"></label></div>
        <p id="flVisualNote"></p><div id="flSelected"></div>
      </section>
      <section class="image-panel image-lesson-copy"><nav class="image-lesson-tabs" aria-label="이해 순서">${["특징 계산", "분포·선택", "뉴런·출력", "선 움직임"].map((s,i)=>`<button data-fl-step="${i+1}">${i+1} ${s}</button>`).join("")}</nav>
        <h2 id="flTitle"></h2><p id="flText"></p>
        <div class="feature-axis-pair"><label>가로 특징<select id="flX"></select></label><label>세로 특징<select id="flY"></select></label><button id="flCreate">+ 특징 만들기</button></div>
        <div id="flCalculation" class="image-calculation" aria-live="polite"></div>
        <div id="flPredict" class="image-quiz" hidden><strong id="flPredictTitle">정답 B의 점수를 높이려면 더해주는 값을?</strong><div><button data-fl-predict="up">0.1 더한다</button><button data-fl-predict="down">0.1 뺀다</button></div></div>
        <div class="lesson-playback"><button id="flReplay">처음부터</button><button id="flAction" class="button primary"></button><button id="flPlay" aria-label="계산 과정 자동 재생">▶ 재생</button></div>
        <section id="flQuiz" class="image-quiz"><strong id="flQuestion"></strong><div id="flChoices" class="lesson-choice-grid"></div><p id="flFeedback" role="status"></p></section>
        <button id="flNext" class="button secondary">다음 →</button>
      </section></div>
      <dialog id="flEditor"><form method="dialog" class="feature-editor"><div class="image-heading"><h2>어느 부분을 셀까요?</h2><button value="cancel" aria-label="특징 만들기 닫기">×</button></div><p>주황 칸은 더하고, 보라 칸은 뺍니다. 빈 칸은 세지 않습니다.</p><input id="flName" maxlength="18" placeholder="예: 위쪽 가운데 진하기" aria-label="새 특징 이름"><div class="feature-brush"><label><input type="radio" name="flBrush" value="1" checked> +1</label><label><input type="radio" name="flBrush" value="-1"> −1</label><label><input type="radio" name="flBrush" value="0"> 0</label></div><canvas id="flMask" width="420" height="420" aria-label="더하고 뺄 칸 고르기"></canvas><p id="flEditorError" role="status"></p><button id="flSave" type="button" class="button primary">특징 추가</button></form></dialog>`;
    const click = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn);
    root.addEventListener("click", e => {
      const target = e.target as HTMLElement, step = target.closest<HTMLElement>("[data-fl-step]"), source = target.closest<HTMLElement>("[data-fl-source]"), prediction = target.closest<HTMLElement>("[data-fl-predict]");
      if (step) { this.stop(); this.step = Number(step.dataset.flStep); this.reveal = 0; this.frame = 0; this.answer = null; this.prediction = null; this.render(); }
      if (source) { this.stop(); this.example = source.dataset.flSource === "example"; this.reveal = 0; this.frame = 0; this.answer = null; this.render(); }
      if (prediction) { this.prediction = prediction.dataset.flPredict!; this.render(); }
    });
    ["flX", "flY"].forEach(id => this.el(id).addEventListener("change", () => {
      this.stop(); const error = store.setAxes(this.el<HTMLSelectElement>("flX").value, this.el<HTMLSelectElement>("flY").value);
      if (error) message(error); else { this.reveal = 0; this.frame = 0; this.answer = null; this.passed.clear(); this.signature = ""; }
      this.render();
    }));
    click("flOther", () => { this.sample = (this.sample + 1) % store.snapshot.data.length; this.reveal = 0; this.answer = null; this.render(); });
    this.el<HTMLCanvasElement>("flPicture").addEventListener("click", e => { const r = this.el("flPicture").getBoundingClientRect(); this.pixel = Math.min(195, Math.max(0, Math.floor((e.clientY-r.top)/r.height*14)*14+Math.floor((e.clientX-r.left)/r.width*14))); this.render(); });
    this.el<HTMLCanvasElement>("flMap").addEventListener("click", e => { if (this.step !== 2) return; const s = store.snapshot, i = pixelMapExampleAt(this.el("flMap"),e.clientX,e.clientY,s.projection,s.data); if (i !== null) { this.sample = i; this.render(); } });
    ["flPointX", "flPointY"].forEach(id => this.el(id).addEventListener("input", () => { this.focus = [Number(this.el<HTMLInputElement>("flPointX").value), Number(this.el<HTMLInputElement>("flPointY").value)]; this.render(); }));
    click("flReplay", () => { this.stop(); this.reveal = 0; this.frame = 0; this.answer = null; this.render(); });
    click("flAction", () => { this.stop(); this.advance(); });
    click("flPlay", () => {
      if (this.timer) { this.stop(); return this.render(); }
      if (this.step === 4 && !this.prediction && this.example) return message("먼저 어느 쪽으로 고칠지 골라 보세요.");
      if (this.complete()) { this.reveal = 0; this.frame = 0; }
      const tick = () => { this.advance(); if (!this.complete()) this.timer = window.setTimeout(tick, 1000); else this.timer = 0; this.render(); }; tick();
    });
    click("flNext", () => { if (!this.passed.has(this.step)) return message("아래 선택형 문제를 확인해 주세요."); this.stop(); if (this.step === 4) { store.setMode("map"); this.next(); } else { this.step++; this.reveal = 0; this.frame = 0; this.answer = null; this.example = true; this.render(); } });
    click("flCreate", () => { this.paint.fill(0); this.el<HTMLInputElement>("flName").value = ""; this.el("flEditorError").textContent = ""; this.drawMask(); this.el<HTMLDialogElement>("flEditor").showModal(); });
    let painting = false; const mask = this.el<HTMLCanvasElement>("flMask");
    const paint = (e: PointerEvent) => { if (!painting) return; const r = mask.getBoundingClientRect(), x = Math.floor((e.clientX-r.left)/r.width*14), y = Math.floor((e.clientY-r.top)/r.height*14); if (x<0||x>=14||y<0||y>=14) return; this.paint[y*14+x] = Number(root.querySelector<HTMLInputElement>('input[name="flBrush"]:checked')!.value); this.drawMask(); };
    mask.addEventListener("pointerdown", e=>{ painting=true; mask.setPointerCapture(e.pointerId); paint(e); }); mask.addEventListener("pointermove", paint); mask.addEventListener("pointerup", ()=>painting=false); mask.addEventListener("pointercancel", ()=>painting=false);
    click("flSave", () => { const error = store.addFeature(this.el<HTMLInputElement>("flName").value, this.paint); if (error) this.el("flEditorError").textContent = error; else { this.el<HTMLDialogElement>("flEditor").close(); this.render(); message("추가한 특징을 가로 또는 세로에서 골라 보세요."); } });
    workspacePanels(root, [...root.querySelector(".image-understanding")!.children], ["예제·그래프", "설명·확인"], () => this.render());
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T { return this.root.querySelector(`#${id}`) as T; }
  stop():void { window.clearTimeout(this.timer); this.timer = 0; }
  reset():void { this.stop(); this.step = 1; this.sample = 0; this.reveal = 0; this.frame = 0; this.example = true; this.answer = null; this.prediction = null; this.passed.clear(); this.signature = ""; }
  openFeatures():void { this.step = 2; this.reveal = 0; this.render(); }
  private limit():number { return this.step === 1 ? this.example ? 7 : 3 : this.step === 2 ? 1 : this.step === 3 ? 3 : this.example ? 8 : 30; }
  private complete():boolean { return (this.step === 4 ? this.frame : this.reveal) >= this.limit(); }
  private advance():void { if (this.step === 4) { if (this.example && !this.prediction) return this.message("먼저 고칠 방향을 골라 보세요."); this.frame = Math.min(this.limit(), this.frame + 1); } else this.reveal = Math.min(this.limit(), this.reveal + 1); this.render(); }
  private drawMask():void { const ctx = this.el<HTMLCanvasElement>("flMask").getContext("2d")!; this.paint.forEach((v,i)=>{ ctx.fillStyle=v>0?"#ffe0bf":v<0?"#dbccff":"white"; ctx.fillRect(i%14*30,Math.floor(i/14)*30,30,30); ctx.strokeStyle="#d6dbe2"; ctx.strokeRect(i%14*30,Math.floor(i/14)*30,30,30); }); }
  private quiz(question:string, choices:Choice[], explanation:string):void {
    this.el("flQuestion").textContent = question;
    const target = this.el("flChoices"); target.replaceChildren();
    choices.forEach((choice,i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = choice.text; b.dataset.flChoice = String(i);
      if (this.answer !== null && choice.correct) b.classList.add("correct");
      if (this.answer === i && !choice.correct) b.classList.add("wrong");
      b.setAttribute("aria-pressed", String(this.answer === i));
      b.addEventListener("click", () => { this.answer = i; if (choice.correct) this.passed.add(this.step); else this.passed.delete(this.step); this.render(); }); target.append(b);
    });
    const right = this.answer !== null && choices[this.answer]?.correct;
    this.el("flFeedback").textContent = this.answer === null ? "" : `${right ? "맞아요. " : "정답 표시를 확인해 보세요. "}${explanation}`;
    this.el("flFeedback").className = right ? "correct" : this.answer !== null ? "wrong" : "";
  }
  render():void {
    const s = this.store.snapshot; if (!s.data.length) return;
    this.sample = Math.min(this.sample, s.data.length - 1);
    const signature = `${s.revision}:${s.xFeature}:${s.yFeature}`;
    if (signature !== this.signature) { this.stop(); this.movement = featureMovementExample(s.data,s.projection,s.classes.length); this.signature = signature; this.frame = 0; }
    for (const [id,value] of [["flX",s.xFeature],["flY",s.yFeature]]) { const select = this.el<HTMLSelectElement>(id!); select.innerHTML = s.features.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join(""); select.value = value!; }
    this.root.querySelectorAll<HTMLElement>("[data-fl-step]").forEach(b=>{ const selected=Number(b.dataset.flStep)===this.step; b.classList.toggle("active",selected); b.classList.toggle("done",this.passed.has(Number(b.dataset.flStep))); b.setAttribute("aria-pressed",String(selected)); });
    this.root.querySelectorAll<HTMLElement>("[data-fl-source]").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.flSource==="example")===this.example)));
    this.el("flExampleTabs").hidden = this.step===2 || this.step===3;
    this.el("flSourceNote").textContent = this.step===2 ? "내 자료 · 한 점은 한 장의 그림입니다." : this.example || this.step===3 ? "원리를 배우는 작은 예제 · 실제 학습 자료와는 별개입니다." : "내 자료 · 실제 계산값을 확인합니다. 표시한 수는 반올림했습니다.";
    this.el("flTiny").hidden = this.step!==1 || !this.example;
    this.el("flPicture").hidden = this.step!==1 || this.example;
    this.el("flMap").hidden = this.step===1;
    this.el("flOther").hidden = this.step>2 || this.step===1&&this.example;
    this.el("flPointControl").hidden = this.step!==3;
    const pair = this.root.querySelector<HTMLElement>(".feature-axis-pair")!; pair.hidden = this.step>=3;
    (pair.querySelector("label:nth-child(2)") as HTMLElement).hidden=this.step===1;
    this.el("flCreate").hidden=this.step!==2;
    this.el("flSelected").replaceChildren(); this.el("flVisualNote").textContent="";
    if (this.step===1) this.renderCalculation(); else if (this.step===2) this.renderDistribution(); else if (this.step===3) this.renderOutput(); else this.renderMovement();
    const done=this.complete();
    this.el("flPredict").hidden=this.step!==4||!this.example||this.frame>0;
    this.root.querySelectorAll<HTMLElement>("[data-fl-predict]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.flPredict===this.prediction)));
    this.el("flQuiz").hidden=!done; this.el<HTMLButtonElement>("flNext").disabled=!this.passed.has(this.step);
    this.el("flNext").textContent=this.step===4?"고른 특징으로 직접 학습하기 →":"다음 내용 →";
    this.el("flAction").textContent=done?"확인 완료":this.step===4?`한 번 고치기 (${this.frame}/${this.limit()})`:`다음 계산 (${this.reveal}/${this.limit()})`;
    this.el<HTMLButtonElement>("flAction").disabled=done;
    this.el("flPlay").hidden=this.step===2;this.el("flPlay").textContent=this.timer?"Ⅱ 멈춤":"▶ 재생";
  }
  private renderCalculation():void {
    const s=this.store.snapshot, feature=s.features.find(f=>f.id===s.xFeature)!, row=s.data[this.sample]!, calc=featureCalculation(feature,row.pixels), small=smallFeatureExample(feature.id), box=this.el("flCalculation");
    this.el("flTitle").textContent = this.example ? "칸의 진하기를 어떻게 더할까요?" : "같은 방법을 196칸에 적용해요";
    this.el("flVisualTitle").textContent = this.example ? `4×4 예제 · ${small.feature.name}` : `정답 ${s.classes[row.label]} · ${feature.name}`;
    this.el("flText").textContent = this.example ? "흰 칸은 0, 검정 칸은 1, 반쯤 진한 회색은 0.5입니다. 먼저 각 칸에 곱할 수를 정하고, 곱한 결과를 더해요." : feature.description;
    if (this.example) {
      const terms = small.calculation.terms.map((t,i)=>({...t,index:i})).filter(t=>t.pixel!==0), active = Math.min(terms.length-1,Math.max(0,this.reveal-2));
      this.el("flTiny").innerHTML = `<div class="tiny-grid">${small.pixels.map((v,i)=>`<div class="${this.reveal>=2&&terms[active]?.index===i?"current":""}" style="--ink:${Math.round(255*(1-v))};--text:${v>.65?'white':'#202633'};--term-color:${small.feature.weights[i]!<0?'#7446f5':'#f17605'}"><span>${n(v)}</span>${this.reveal>=1?`<b>× ${n(small.feature.weights[i]!)}</b>`:""}</div>`).join("")}</div><div class="tiny-key">흰색 0 · 회색 0.5 · 검정 1</div>`;
      const t=terms[active]!;
      const weightHelp = small.feature.id==="position"?"왼쪽부터 열 번호 1·2·3·4를 곱해요. 같은 진하기라도 오른쪽 칸에서 곱한 값이 커져요.":small.feature.id==="lr"?"오른쪽은 ×1로 더하고, 왼쪽은 ×−1로 빼요.":small.feature.id==="tb"?"위쪽은 ×1로 더하고, 아래쪽은 ×−1로 빼요.":small.feature.id==="center"?"가운데 네 칸은 ×1, 나머지는 ×0이라 세지 않아요.":"모든 칸에 ×1을 해요. 원래 진하기가 그대로 남아요.";
      if (small.feature.id !== feature.id) this.el("flSourceNote").textContent = "작은 예제는 ‘오른쪽 − 왼쪽’으로 계산을 배웁니다. 선택한 특징은 ‘내 자료에서 확인’에서 봅니다.";
      box.innerHTML = this.reveal===0 ? `<b>1칸의 진하기 → 1개의 수</b><span>검정 1칸과 회색 1칸은 1 + 0.5 = 1.5입니다.</span>` : this.reveal===1 ? `<b>먼저 ‘무엇을 셀지’ 정해요</b><span>${weightHelp}</span><span>이 곱셈표는 특징의 뜻에 따라 사람이 정한 것입니다. 학습으로 고치는 뉴런 연결값과는 달라요.</span>` : this.reveal<7 ? `<b class="calculation-pop">${Math.floor(t.index/4)+1}행 ${t.index%4+1}열: ${n(t.pixel)} × (${n(t.weight)}) = ${n(t.product)}</b><span>지금까지 더하면 ${terms.slice(0,active+1).map(t=>`(${n(t.product)})`).join(" + ")} = <b>${n(terms.slice(0,active+1).reduce((v,t)=>v+t.product,0))}</b></span><span>흰 칸은 무엇을 곱해도 0이라 합을 바꾸지 않습니다.</span>` : `<b>더할 값 ${n(small.calculation.positive)} − 뺄 값 ${n(-small.calculation.negative)} = ${n(small.calculation.total)}</b><span>계산한 ${n(small.calculation.total)}은 ‘${small.feature.name}’ 특징값입니다. 각 칸을 세어 만든 수이지, 정답 번호가 아닙니다.</span>`;
      this.quiz(`이 작은 그림의 ‘${small.feature.name}’ 값은?`,numberChoices(small.calculation.total).map(v=>({text:n(v),correct:Math.abs(v-small.calculation.total)<.006})),`${n(small.calculation.positive)} − ${n(-small.calculation.negative)} = ${n(small.calculation.total)}입니다.`);
    } else {
      drawImagePixels(this.el("flPicture"),row.pixels,true,this.pixel);
      const t=calc.terms[this.pixel]!, raw=s.data.map(r=>featureScore(feature,r.pixels)), mean=raw.reduce((a,b)=>a+b,0)/raw.length, maxDistance=Math.max(.001,...raw.map(v=>Math.abs(v-mean))), scale=maxDistance/.9;
      box.innerHTML = this.reveal===0 ? `<b>${Math.floor(this.pixel/14)+1}행 ${this.pixel%14+1}열: 진하기 ${n(t.pixel)}</b><span>그림의 칸을 누르세요. ${esc(feature.description)}</span>` : this.reveal===1 ? `<b>${n(t.pixel)} × (${n(t.weight)}) = ${n(t.product)}</b><span>이 칸에서 곱한 값입니다. 같은 계산을 196칸에 합니다.</span>` : this.reveal===2 ? `<b>${n(calc.positive)} − ${n(-calc.negative)} = ${n(calc.total)}</b><span>곱한 값 중 양수는 더하고, 음수는 그 크기만큼 빼요. 이것이 실제 특징값입니다.</span>` : `<b>지도 좌표 ≈ ${n((calc.total-mean)/scale)}</b><span>① 자료 ${raw.length}장의 특징값 합 ${n(raw.reduce((a,b)=>a+b,0))} ÷ ${raw.length} = 평균 ${n(mean)}</span><span>② 평균에서 가장 먼 거리 ${n(maxDistance)} ÷ 0.9 = 줄일 비율 ${n(scale)}</span><span>③ (${n(calc.total)} − ${n(mean)}) ÷ ${n(scale)} ≈ ${n((calc.total-mean)/scale)}</span><span>평균을 가운데 0에 두고, 가장 먼 점도 지도 안에 들어오게 줄였습니다.</span>`;
      this.quiz("이 특징값은 무엇을 계산한 값일까요?",[{text:"정답 번호를 바꾼 값",correct:false},{text:"칸의 진하기에 곱셈표를 적용한 합",correct:true}],"그림의 진하기로 계산합니다. 정답 번호는 계산에 넣지 않습니다.");
    }
  }
  private renderDistribution():void {
    const s=this.store.snapshot, row=s.data[this.sample]!, feature=s.features.find(f=>f.id===s.xFeature)!, pos=projectPixels(s.projection,row.pixels);
    this.el("flTitle").textContent="두 특징을 바꾸어 비교해요"; this.el("flVisualTitle").textContent="내 자료의 분포";
    this.el("flText").textContent="같은 색 점이 모이나요? 다른 색과 겹치나요? 특징을 바꾸거나, 더하고 뺄 칸을 직접 만들어 비교하세요.";
    drawPixelLatentMap(this.el("flMap"),s.model,s.data,row.pixels,s.projection,{view:"placement",axisLegend:imageFeatureLegend(s.features,s.xFeature,s.yFeature),focusLabel:`정답 ${s.classes[row.label]}`});
    this.el("flCalculation").innerHTML=`<span>가로 ‘${esc(feature.name)}’: 특징값 ${n(featureScore(feature,row.pixels))} → 좌표 ${n(pos.x)}</span><span>세로 ‘${esc(s.features.find(f=>f.id===s.yFeature)!.name)}’: 특징값 ${n(featureScore(s.features.find(f=>f.id===s.yFeature)!,row.pixels))} → 좌표 ${n(pos.y)}</span><span>점은 그림 한 장입니다. 그림은 같아도 무엇을 세느냐에 따라 자리가 달라집니다.</span>`;
    this.quiz("어떤 특징 조합을 먼저 시험해 볼까요?",[{text:"서로 다른 클래스가 덜 겹치는 조합",correct:true},{text:"모든 점이 한곳에 겹치는 조합",correct:false}],"덜 겹치면 구분에 도움이 될 수 있습니다. 새 그림도 잘 맞히는지는 따로 시험해야 합니다.");
  }
  private renderOutput():void {
    const model=outputTeachingModel(), result=forwardPixels(model,this.focus), sums=model.inputHidden.map((w,i)=>w[0]!*this.focus[0]!+w[1]!*this.focus[1]!+model.hiddenBias[i]!);
    this.el("flTitle").textContent=["입력값을 곱하고 더해요","합을 신호로 바꿔요","출력 노드가 신호를 합쳐요","1등인 답이 바뀌는 곳이 최종 경계예요"][this.reveal]!;
    this.el("flVisualTitle").textContent="색 선 → 뉴런 신호 → 검은 경계";
    this.el("flText").textContent=this.reveal===0?"예제의 연결값은 계산을 보기 쉽게 정했습니다. 실제 연습에서는 처음에 임의로 정한 연결값을 학습으로 고칩니다.":this.reveal===1?"합을 −1~1 사이의 신호로 부드럽게 줄입니다. 큰 합일수록 큰 신호입니다. 복잡한 변환 공식 대신 아래 실제 값을 비교하세요.":this.reveal===2?"출력 A와 B는 같은 두 신호에 서로 다른 연결값을 곱해 더합니다. 출력값이 더 큰 답을 고릅니다.":"지도 곳곳에서 같은 계산을 합니다. 가장 큰 두 출력값이 같아져 1등이 바뀌는 곳을 이으면 검은 경계가 됩니다. 색 선 하나를 그대로 복사한 것이 아닙니다.";
    drawPixelLatentMap(this.el("flMap"),model,[],this.focus,identity,{view:"decision",onlyNeuron:this.reveal<1?0:undefined,showNeuronBoundaries:true,showDecisionBoundary:this.reveal>=3,axisLegend:{horizontal:{title:"가로 입력값",negative:"−1",positive:"+1"},vertical:{title:"세로 입력값",negative:"−1",positive:"+1"}},focusLabel:"움직이는 예제 점"});
    const rows=model.inputHidden.map((w,i)=>`<span style="color:${NEURON_COLORS[i]}">뉴런 ${i+1}: ${n(this.focus[0]!)} × ${n(w[0]!)} + ${n(this.focus[1]!)} × (${n(w[1]!)}) + (${n(model.hiddenBias[i]!)}) ≈ <b>${n(sums[i]!)}</b>${this.reveal>=1?` → 신호 ${n(result.hidden[i]!)}`:""}</span>`).join("");
    this.el("flCalculation").innerHTML=this.reveal<2?`${rows}<span>곱할 값은 연결값, 마지막에 더하는 값은 선의 위치를 조절하는 값입니다. 색 선 위의 합은 0입니다. 점을 움직여 확인하세요.</span>`:model.hiddenOutput.map((w,c)=>`<span>출력 ${c?'B':'A'}: ${n(result.hidden[0]!)} × (${n(w[0]!)}) + ${n(result.hidden[1]!)} × (${n(w[1]!)}) + (${n(model.outputBias[c]!)}) ≈ <b>${n(result.logits[c]!)}</b></span>`).join("")+`<b>지금은 ${result.logits[0]!>result.logits[1]!?"A":"B"}의 출력값이 더 큽니다.</b><span>퍼센트 막대는 출력값들을 비교하기 쉽게 바꾼 값입니다. 정답 보장은 아닙니다.</span>`;
    this.el("flSelected").innerHTML=`<div class="lesson-signal-flow" aria-label="입력에서 은닉 뉴런을 거쳐 출력으로 이어지는 계산"><span>입력<br><b>${n(this.focus[0]!)} · ${n(this.focus[1]!)}</b></span><i>→</i><span><b style="color:${NEURON_COLORS[0]}">뉴런 1: ${n(result.hidden[0]!)}</b><br><b style="color:${NEURON_COLORS[1]}">뉴런 2: ${n(result.hidden[1]!)}</b></span><i>→</i><span>출력 A <b>${n(result.logits[0]!)}</b><br>출력 B <b>${n(result.logits[1]!)}</b></span></div>`;
    this.quiz("검은 최종 경계는 어떤 곳일까요?",[{text:"뉴런 1개의 합이 0인 곳",correct:false},{text:"가장 큰 두 출력값이 같아지는 곳",correct:true}],"색 선은 개별 뉴런의 기준이고, 검은 선은 뉴런 신호를 합친 최종 판단의 경계입니다.");
  }
  private renderMovement():void {
    const s=this.store.snapshot, toy=this.example, movement=this.movement!, data=toy?[{pixels:this.bias.point,label:1}]:s.data, projection=toy?identity:s.projection, focus=toy?this.bias.point:movement.example.pixels, before=toy?this.bias.frames[0]!:movement.frames[0]!, after=toy?this.bias.frames[this.frame]!:movement.frames[this.frame]!, p=projectPixels(projection,focus), oldPlane=hiddenPlane(before,projection,0), plane=hiddenPlane(after,projection,0), label=toy?1:movement.example.label;
    this.el("flTitle").textContent=toy?"한 값만 바꾸어 방향을 확인해요":"내 자료에서도 연결값이 바뀌어요"; this.el("flVisualTitle").textContent="대표 뉴런 1개의 선 움직임";
    this.el("flText").textContent=toy?"정답은 B인데 A로 예상했습니다. 이번 작은 실험에서는 두 연결값을 고정하고 ‘더해주는 값’만 바꿉니다. 세 후보 중 B의 점수가 가장 높은 값을 고릅니다.":"실제 연습과 같은 계산입니다. 이 그림의 오차를 줄이도록 여러 연결값과 더해주는 값을 함께 바꿉니다. 여기서는 대표선 하나만 관찰합니다.";
    drawPixelNeuronMovement(this.el("flMap"),before,after,data,focus,projection,toy?"정답 B":"고른 그림",0,toy?undefined:imageFeatureLegend(s.features,s.xFeature,s.yFeature));
    this.el("flCalculation").innerHTML=toy?`${this.frame===0?`<span>처음 상태에서 세 가지를 비교하면</span><div class="bias-candidates">${this.bias.candidates.map(c=>`<span>${c.change<0?"0.1 빼기":c.change>0?"0.1 더하기":"그대로"}<b>B ${(c.probability*100).toFixed(1)}%</b></span>`).join("")}</div>`:""}<span>더해주는 값: −0.6 + (0.1 × ${this.frame}번) = <b>${n(after.hiddenBias[0]!)}</b></span><b>${n(p.x)} × 1 + ${n(p.y)} × 0.5 + (${n(after.hiddenBias[0]!)}) = ${n(pixelHiddenLineValue(after,focus,0))}</b><span>현재 B 점수 ${(forwardPixels(after,focus).probabilities[1]!*100).toFixed(1)}%. 합이 커지면 B 쪽 신호가 커집니다. 같은 점은 고정인데, 합이 0인 선은 반대쪽으로 이동합니다.</span>`:`<span>전: ${n(p.x)} × ${n(oldPlane.horizontal)} + ${n(p.y)} × (${n(oldPlane.vertical)}) + (${n(oldPlane.constant)}) ≈ ${n(pixelHiddenLineValue(before,focus,0))}</span><span>후: ${n(p.x)} × ${n(plane.horizontal)} + ${n(p.y)} × (${n(plane.vertical)}) + (${n(plane.constant)}) ≈ ${n(pixelHiddenLineValue(after,focus,0))}</span><span>정답 점수 ${(forwardPixels(before,focus).probabilities[label]!*100).toFixed(1)}% → ${(forwardPixels(after,focus).probabilities[label]!*100).toFixed(1)}%</span><span>‘작은 예제’의 세 후보 비교는 방향 이해용입니다. 실제 학습은 현재 오차에 따라 여러 값을 조금씩 고칩니다.</span>`;
    if (toy && this.frame > 0 && this.prediction) { const feedback=document.createElement("span"); feedback.className=this.prediction==="up"?"correct":"wrong"; feedback.textContent=this.prediction==="up"?"예측이 맞아요. 이 예제에서는 0.1 더할 때 B 점수가 커집니다.":"방향을 다시 확인해요. 이 예제에서는 0.1 더할 때 B 점수가 커집니다.";this.el("flVisualNote").append(feedback); }
    this.quiz(toy?"이 예제에서 더해주는 값을 늘린 이유는?":"실제 학습에서 계산값을 바꾸는 목적은?",[{text:"선을 언제나 같은 방향으로 보내려고",correct:false},{text:"지금 그림의 정답 점수를 높이려고",correct:true}],"그림을 옮긴 것이 아니라 계산에 쓰는 값을 바꿨습니다. 다른 모델·그림에서는 고칠 방향이 달라집니다.");
  }
}
