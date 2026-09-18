import { drawImagePixels } from "../core/imageInput";
import { featureCalculation, featureScore, imageFeatureLegend } from "../core/imageFeatures";
import { smallFeatureExample, biasDirectionExample, numberChoices } from "../core/lessonArithmetic";
import { featureMovementExample } from "../core/featureLessonModel";
import { projectPixels } from "../core/pixelProjection";
import type { ImageLabStore } from "../state/imageLabStore";
import { drawPixelLatentMap, pixelMapExampleAt, pixelMapInputAt } from "../visualization/pixelLatentMap";
import { renderMovementScene, renderOutputScene } from "./lessonScenes";
import { workspacePanels } from "./workspacePanels";
import { LESSON_PROJECTION, NEURON_EXAMPLES, NEURON_INTRO_STEPS } from "../core/neuronLesson";
import { newNeuronActivity, renderNeuronIntroduction } from "./neuronIntroduction";
import { OUTPUT_EXAMPLES, OUTPUT_LAST_STAGE, outputCanExplore } from "./outputLesson";

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const n = (v: number) => Number(v.toFixed(2)).toString();
type Choice = { text: string; correct: boolean };

/** Small examples and real data are separate. Animation frames always show real arithmetic. */
export class ImageFeatureLesson {
  private step = 1;
  private reveal = 0;
  private sample = 0;
  private pixel = 0;
  private timer = 0;
  private animation = 0;
  private playing = false;
  private outputNeurons = 1;
  private outputAnswer: number | null = null;
  private frame = 0;
  private example = true;
  private passed = new Set<number>();
  private answer: number | null = null;
  private biasChecked: boolean | null = null;
  private activity = newNeuronActivity();
  private paint = Array<number>(196).fill(0);
  private signature = "";
  private movement: ReturnType<typeof featureMovementExample> | null = null;
  private focus = [.2, .2];
  private bias = biasDirectionExample();
  constructor(private root: HTMLElement, private store: ImageLabStore, private next: () => void, private message: (s: string) => void) {
    root.innerHTML = `<div class="image-understanding feature-lesson">
      <section class="image-panel image-lesson-visual"><div class="image-heading"><h2 id="flVisualTitle"></h2><button id="flOther">다른 자료</button></div>
        <div id="flExampleTabs" class="lesson-source-tabs"><button data-fl-source="example">작은 예제로 배우기</button><button data-fl-source="data">내 자료에서 확인</button></div>
        <p id="flSourceNote"></p><div id="flTiny" class="tiny-calculation"></div><canvas id="flPicture" width="420" height="420" hidden aria-label="실제 그림의 칸을 눌러 계산 확인"></canvas>
        <div id="flArithmeticFlow" hidden></div><canvas id="flMap" width="720" height="460" hidden tabindex="0" aria-label="특징 분포와 뉴런·최종 경계. 누른 채 그리거나 방향키로 점을 움직이세요."></canvas>
        <div id="flGraphTools" hidden><button id="flShowLines" aria-pressed="false">숨은 선 확인</button></div><p id="flPointControl">그래프를 누르거나 그려 보세요. 방향키로도 움직일 수 있어요.</p>
        <p id="flVisualNote"></p><div id="flSelected"></div>
      </section>
      <section class="image-panel image-lesson-copy"><nav class="image-lesson-tabs" aria-label="이해 순서">${["특징 계산", "분포·선택", "뉴런·선", "뉴런·출력"].map((s,i)=>`<button data-fl-step="${i+1}">${i+1} ${s}</button>`).join("")}</nav>
        <h2 id="flTitle"></h2><p id="flText"></p>
        <div class="feature-axis-pair"><label>가로 특징<select id="flX"></select></label><label>세로 특징<select id="flY"></select></label><button id="flCreate">+ 특징 만들기</button></div>
        <div id="flCalculation" class="image-calculation" aria-live="polite"></div>
        <div id="flPredict" class="bias-experiment" hidden><strong id="flPredictTitle">정답 B의 점수를 처음보다 높여 보세요.</strong><label for="flBias">마지막에 더해주는 값 <output id="flBiasValue" for="flBias">0</output></label><input id="flBias" type="range" min="-.5" max=".8" step=".1" value="0"><div class="bias-scale"><span>−0.5</span><span>처음 0</span><span>+0.8</span></div><div class="bias-check-row"><button id="flBiasCheck">이 값 확인</button><span id="flBiasFeedback" role="status"></span></div></div>
        <div class="lesson-playback"><button id="flReplay">처음부터</button><button id="flPrevious" aria-label="이전 장면" hidden>←</button><button id="flAction" class="button primary"></button><button id="flPlay" aria-label="계산 과정 자동 재생">▶ 재생</button></div>
        <section id="flQuiz" class="image-quiz"><strong id="flQuestion"></strong><div id="flChoices" class="lesson-choice-grid"></div><p id="flFeedback" role="status"></p></section>
        <button id="flNext" class="button secondary">다음 →</button>
      </section></div>
      <dialog id="flPercent" class="lesson-percent" aria-label="점수와 퍼센트 더 알아보기"></dialog><dialog id="flEditor"><form method="dialog" class="feature-editor"><div class="image-heading"><h2>어느 부분을 셀까요?</h2><button value="cancel" aria-label="특징 만들기 닫기">×</button></div><p>주황 칸은 더하고, 보라 칸은 뺍니다. 빈 칸은 세지 않습니다.</p><input id="flName" maxlength="18" placeholder="예: 위쪽 가운데 진하기" aria-label="새 특징 이름"><div class="feature-brush"><label><input type="radio" name="flBrush" value="1" checked> +1</label><label><input type="radio" name="flBrush" value="-1"> −1</label><label><input type="radio" name="flBrush" value="0"> 0</label></div><canvas id="flMask" width="420" height="420" aria-label="더하고 뺄 칸 고르기"></canvas><p id="flEditorError" role="status"></p><button id="flSave" type="button" class="button primary">특징 추가</button></form></dialog>`;
    const click = (id: string, fn: () => void) => this.el(id).addEventListener("click", fn);
    root.addEventListener("click", e => {
      const target = e.target as HTMLElement, step = target.closest<HTMLElement>("[data-fl-step]"), source = target.closest<HTMLElement>("[data-fl-source]");
      if (step) { this.stop(); this.step = Number(step.dataset.flStep); this.reveal = 0; this.frame = 0; this.answer = null; this.biasChecked = null; this.activity = newNeuronActivity(); this.outputAnswer=null;this.focus=[.2,.2];this.render(); }
      if (source) { this.stop(); this.example = source.dataset.flSource === "example"; this.reveal = 0; this.frame = 0; this.answer = null; this.biasChecked = null; this.activity = newNeuronActivity(); this.render(); }
      const count=target.closest<HTMLElement>("[data-output-neurons]");
      if(count){this.outputNeurons=Number(count.dataset.outputNeurons);this.render();}
      const answer=target.closest<HTMLElement>("[data-neuron-answer]");
      if(answer){this.activity.answer=Number(answer.dataset.neuronAnswer);this.render();}
      if(target.closest("[data-neuron-clear]")){this.activity.strokes=[];this.render();}
      if(target.closest("[data-neuron-flow-next]")){this.stop();this.advance();}
      if(target.closest("[data-neuron-flow-play]"))this.el("flPlay").click();
      const outputAnswer=target.closest<HTMLElement>("[data-output-answer]");
      if(outputAnswer){this.outputAnswer=Number(outputAnswer.dataset.outputAnswer);this.render();}
      if(target.closest("[data-output-percent]"))this.el<HTMLDialogElement>("flPercent").showModal();
    });
    ["flX", "flY"].forEach(id => this.el(id).addEventListener("change", () => {
      this.stop(); const error = store.setAxes(this.el<HTMLSelectElement>("flX").value, this.el<HTMLSelectElement>("flY").value);
      if (error) message(error); else { this.reveal = 0; this.frame = 0; this.answer = null; this.passed.clear(); this.signature = ""; }
      this.render();
    }));
    click("flOther", () => { this.sample = (this.sample + 1) % store.snapshot.data.length; this.reveal = 0; this.answer = null; this.render(); });
    this.el<HTMLCanvasElement>("flPicture").addEventListener("click", e => { const r = this.el("flPicture").getBoundingClientRect(); this.pixel = Math.min(195, Math.max(0, Math.floor((e.clientY-r.top)/r.height*14)*14+Math.floor((e.clientX-r.left)/r.width*14))); this.render(); });
    this.el<HTMLCanvasElement>("flMap").addEventListener("click", e => {
      if(this.intro()&&(this.reveal===2||this.reveal===4)||this.step===4&&outputCanExplore(this.reveal)){
        const data=this.step===4&&this.reveal>=5?OUTPUT_EXAMPLES:NEURON_EXAMPLES;
        const i=pixelMapExampleAt(this.el("flMap"),e.clientX,e.clientY,LESSON_PROJECTION,data);
        if(i!==null){const p=data[i]!.pixels;if(this.step===4)this.focus=[...p];else this.activity.point=[p[0]!,p[1]!];this.render();}return;
      }
      if (this.step !== 2) return; const s = store.snapshot, i = pixelMapExampleAt(this.el("flMap"),e.clientX,e.clientY,s.projection,s.data); if (i !== null) { this.sample = i; this.render(); }
    });
    click("flShowLines",()=>{this.activity.linesShown=!this.activity.linesShown;this.render();});
    const map=this.el<HTMLCanvasElement>("flMap");
    let drawing=false;
    const interactive=()=>this.step===4&&outputCanExplore(this.reveal) || this.intro()&&(this.reveal===2||this.reveal===4);
    const pointAt=(e:PointerEvent)=>{
      if(!interactive()||!drawing)return;
      const point=pixelMapInputAt(map,e.clientX,e.clientY);
      if(!point){drawing=false;return;}
      if(this.step===4){this.focus=point;this.renderOutput();return;}
      this.activity.point=point;
      const strokes=this.activity.strokes,last=strokes.at(-1)!;
      if(last&&last.length<700)last.push(point);
      this.renderMovement();
    };
    map.addEventListener("pointerdown",e=>{
      if(!interactive())return;
      this.stop();drawing=true;
      if(this.step===3){this.activity.strokes.push([]);if(this.activity.strokes.length>20)this.activity.strokes.shift();}
      map.setPointerCapture?.(e.pointerId);pointAt(e);this.render();
    });
    map.addEventListener("pointermove",pointAt);
    map.addEventListener("pointerup",e=>{pointAt(e);drawing=false;});
    map.addEventListener("pointercancel",()=>drawing=false);
    map.addEventListener("lostpointercapture",()=>drawing=false);
    map.addEventListener("keydown",e=>{
      if(!interactive()||!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))return;
      e.preventDefault();this.stop();
      const p=this.step===4?this.focus:this.activity.point;
      const point:[number,number]=[Math.max(-1,Math.min(1,p[0]!+(e.key==="ArrowLeft"?-.02:e.key==="ArrowRight"?.02:0))),Math.max(-1,Math.min(1,p[1]!+(e.key==="ArrowDown"?-.02:e.key==="ArrowUp"?.02:0)))];
      if(this.step===4)this.focus=point;
      else{this.activity.strokes.push([[p[0]!,p[1]!],point]);if(this.activity.strokes.length>20)this.activity.strokes.shift();this.activity.point=point;}
      this.render();
    });
    this.el("flBias").addEventListener("input",()=>{
      this.stop();this.frame=Number(this.el<HTMLInputElement>("flBias").value)*10;this.biasChecked=null;this.answer=null;this.passed.delete(3);this.render();
    });
    click("flBiasCheck",()=>{
      this.stop();this.biasChecked=Math.max(0,.3+this.frame/10)>.3+1e-9;
      if(this.biasChecked)this.passed.add(3);else this.passed.delete(3);
      this.render();
    });
    click("flReplay", () => { this.stop(); this.reveal = 0; this.frame = 0; this.answer = null; this.biasChecked=null; this.activity=newNeuronActivity();this.outputAnswer=null;this.focus=[.2,.2]; this.render(); });
    click("flPrevious", () => {
      this.stop();
      if(this.intro()&&this.reveal===1&&this.activity.phase>0)this.activity.phase--;
      else if(this.step===3&&this.example&&this.frame===0){this.reveal=Math.max(0,this.reveal-1);this.activity.strokes=[];if(this.reveal===1)this.activity.phase=4;}
      else if(this.step===3)this.frame=Math.max(this.example?-5:0,Math.ceil(this.frame)-1);
      else this.reveal=Math.max(0,this.reveal-1);
      this.answer=null;this.biasChecked=null;this.activity.linesShown=false;this.render();this.transition();
    });
    click("flAction", () => { this.stop(); this.advance(); });
    click("flPlay", () => {
      if (this.playing) { this.stop(); return this.render(); }
      if(this.arithmeticPending()||this.outputPending())return message("아래 계산 문제를 먼저 풀어 보세요.");
      if (this.complete()) { this.reveal = 0; this.frame = 0; this.biasChecked=null; this.activity=newNeuronActivity();this.outputAnswer=null;this.focus=[.2,.2]; }
      this.playing = true; this.play();
    });
    click("flNext", () => { if (!this.passed.has(this.step)) return message("아래 선택형 문제를 확인해 주세요."); this.stop(); if (this.step === 4) { store.setMode("map"); this.next(); } else { this.step++; this.reveal = 0; this.frame = 0; this.answer = null; this.example = true; this.activity=newNeuronActivity(); this.outputAnswer=null;this.focus=[.2,.2];this.biasChecked=null; this.render(); } });
    click("flCreate", () => { this.paint.fill(0); this.el<HTMLInputElement>("flName").value = ""; this.el("flEditorError").textContent = ""; this.drawMask(); this.el<HTMLDialogElement>("flEditor").showModal(); });
    let painting = false; const mask = this.el<HTMLCanvasElement>("flMask");
    const paint = (e: PointerEvent) => { if (!painting) return; const r = mask.getBoundingClientRect(), x = Math.floor((e.clientX-r.left)/r.width*14), y = Math.floor((e.clientY-r.top)/r.height*14); if (x<0||x>=14||y<0||y>=14) return; this.paint[y*14+x] = Number(root.querySelector<HTMLInputElement>('input[name="flBrush"]:checked')!.value); this.drawMask(); };
    mask.addEventListener("pointerdown", e=>{ painting=true; mask.setPointerCapture(e.pointerId); paint(e); }); mask.addEventListener("pointermove", paint); mask.addEventListener("pointerup", ()=>painting=false); mask.addEventListener("pointercancel", ()=>painting=false);
    click("flSave", () => { const error = store.addFeature(this.el<HTMLInputElement>("flName").value, this.paint); if (error) this.el("flEditorError").textContent = error; else { this.el<HTMLDialogElement>("flEditor").close(); this.render(); message("추가한 특징을 가로 또는 세로에서 골라 보세요."); } });
    workspacePanels(root, [...root.querySelector(".image-understanding")!.children], ["예제·그래프", "설명·확인"], () => this.render());
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T { return this.root.querySelector(`#${id}`) as T; }
  stop():void { window.clearTimeout(this.timer); window.cancelAnimationFrame(this.animation); this.timer = 0; this.animation = 0; this.playing = false; }
  private transition():void {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    this.el("flCalculation").animate?.([{opacity:.25,transform:"translateY(7px)"},{opacity:1,transform:"translateY(0)"}],{duration:420,easing:"ease-out"});
  }
  private play():void {
    if (!this.playing) return;
    const finish=()=>{ if(this.complete() || this.arithmeticPending() || this.outputPending() || this.intro()&&(this.reveal===2||this.reveal===4)||this.step===4&&this.reveal===4){this.stop();this.render();}else this.timer=window.setTimeout(()=>this.play(),this.step===3?(this.intro()?2400:450):this.step===4?2400:1100); };
    if(this.step!==3 || this.intro() || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){this.advance();finish();return;}
    const from=this.frame,to=Math.min(this.limit(),Math.floor(from+1.000001)),start=performance.now();
    this.render();
    const tick=(now:number)=>{if(!this.playing)return;const t=Math.min(1,(now-start)/800),ease=t*t*(3-2*t);this.frame=from+(to-from)*ease;this.renderMovement();if(t<1)this.animation=window.requestAnimationFrame(tick);else{this.frame=to;this.render();finish();}};
    this.animation=window.requestAnimationFrame(tick);
  }
  reset():void { this.stop(); this.step = 1; this.sample = 0; this.reveal = 0; this.frame = 0; this.example = true; this.answer = null; this.biasChecked = null; this.activity=newNeuronActivity();this.outputAnswer=null;this.focus=[.2,.2]; this.passed.clear(); this.signature = ""; }
  openFeatures():void { this.stop(); this.step = 2; this.reveal = 0; this.render(); }
  private limit():number { return this.step === 1 ? this.example ? 7 : 3 : this.step === 2 ? 1 : this.step === 4 ? OUTPUT_LAST_STAGE : this.example ? 8 : 30; }
  private intro():boolean { return this.step===3&&this.example&&this.reveal<NEURON_INTRO_STEPS; }
  private arithmeticPending():boolean { return this.intro()&&this.reveal===1&&this.activity.phase===4&&this.activity.answer!==0; }
  private outputPending():boolean { return this.step===4&&this.reveal===3&&this.outputAnswer!==0; }
  private complete():boolean { return !this.intro() && (this.step===3&&this.example&&this.biasChecked===true || (this.step === 3 ? this.frame : this.reveal) >= this.limit()); }
  private advance():void {
    if(this.arithmeticPending()||this.outputPending())return;
    this.activity.linesShown=false;
    if(this.intro()){
      if(this.reveal===1&&this.activity.phase<4)this.activity.phase++;
      else{this.reveal++;this.activity.strokes=[];this.activity.point=[.2,.2];}
    }else if(this.step===3){this.frame=Math.min(this.limit(),Math.floor(this.frame+1.000001));this.biasChecked=null;}
    else this.reveal=Math.min(this.limit(),this.reveal+1);
    this.render();this.transition();
  }
  private drawMask():void { const ctx = this.el<HTMLCanvasElement>("flMask").getContext("2d")!; this.paint.forEach((v,i)=>{ ctx.fillStyle=v>0?"#ffe0bf":v<0?"#dbccff":"white"; ctx.fillRect(i%14*30,Math.floor(i/14)*30,30,30); ctx.strokeStyle="#d6dbe2"; ctx.strokeRect(i%14*30,Math.floor(i/14)*30,30,30); }); }
  private quiz(question:string, choices:Choice[], explanation:string):void {
    this.el("flQuestion").textContent = question;
    const target = this.el("flChoices"); target.replaceChildren();
    choices.forEach((choice,i) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = choice.text; b.dataset.flChoice = String(i);
      if (this.answer === i && choice.correct) b.classList.add("correct");
      if (this.answer === i && !choice.correct) b.classList.add("wrong");
      b.setAttribute("aria-pressed", String(this.answer === i));
      b.addEventListener("click", () => { this.answer = i; if (choice.correct) this.passed.add(this.step); else this.passed.delete(this.step); this.render(); }); target.append(b);
    });
    const right = this.answer !== null && choices[this.answer]?.correct;
    this.el("flFeedback").textContent = this.answer === null ? "" : right ? `맞아요. ${explanation}` : "오답입니다. 위 내용을 다시 확인해 보세요.";
    this.el("flFeedback").className = right ? "correct" : this.answer !== null ? "wrong" : "";
  }
  render():void {
    const s = this.store.snapshot; if (!s.data.length) return;
    this.root.querySelector('.feature-lesson')!.classList.toggle('output-lesson',this.step===4);
    this.sample = Math.min(this.sample, s.data.length - 1);
    const signature = `${s.revision}:${s.xFeature}:${s.yFeature}`;
    if (signature !== this.signature) { this.stop(); this.movement = featureMovementExample(s.data,s.projection,s.classes.length); this.signature = signature; this.frame = 0; }
    for (const [id,value] of [["flX",s.xFeature],["flY",s.yFeature]]) { const select = this.el<HTMLSelectElement>(id!); select.innerHTML = s.features.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join(""); select.value = value!; }
    this.root.querySelectorAll<HTMLElement>("[data-fl-step]").forEach(b=>{ const selected=Number(b.dataset.flStep)===this.step; b.classList.toggle("active",selected); b.classList.toggle("done",this.passed.has(Number(b.dataset.flStep))); b.setAttribute("aria-pressed",String(selected)); });
    this.root.querySelectorAll<HTMLElement>("[data-fl-source]").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.flSource==="example")===this.example)));
    this.el("flExampleTabs").hidden = this.step===2 || this.step===4;
    this.el("flSourceNote").textContent = this.step===2 ? "내 자료 · 한 점은 한 장의 그림입니다." : this.example || this.step===4 ? "원리를 배우는 작은 예제 · 실제 학습 자료와는 별개입니다." : "내 자료 · 실제 계산값을 확인합니다. 표시한 수는 반올림했습니다.";
    this.el("flTiny").hidden = this.step!==1 || !this.example;
    this.el("flPicture").hidden = this.step!==1 || this.example;
    const arithmetic=this.intro()&&this.reveal===1;
    this.el("flArithmeticFlow").hidden=!arithmetic;
    this.el("flMap").hidden = this.step===1||arithmetic;
    this.el("flOther").hidden = this.step>2 || this.step===1&&this.example;
    this.el("flPointControl").hidden = true; // The output graph caption carries the same interaction hint.
    this.el("flGraphTools").hidden=!(this.intro()&&(this.reveal===2||this.reveal===4)||this.step===4&&outputCanExplore(this.reveal));
    this.el("flShowLines").textContent=this.activity.linesShown?"선 다시 숨기기":"숨은 선 확인";
    this.el("flShowLines").setAttribute("aria-pressed",String(this.activity.linesShown));
    const pair = this.root.querySelector<HTMLElement>(".feature-axis-pair")!; pair.hidden = this.step>=3;
    (pair.querySelector("label:nth-child(2)") as HTMLElement).hidden=this.step===1;
    this.el("flCreate").hidden=this.step!==2;
    this.el("flSelected").replaceChildren(); this.el("flVisualNote").textContent="";
    if (this.step===1) this.renderCalculation(); else if (this.step===2) this.renderDistribution(); else if (this.step===3) this.renderMovement(); else this.renderOutput();
    const done=this.complete();
    // Once the check question appears, the graph/calculation already carry this context.
    // Avoid repeating the introduction and pushing the next button below a short screen.
    this.el("flText").hidden=this.step===3&&this.example&&(!this.intro()||this.reveal===1&&this.activity.phase===4)||this.step===4&&(this.reveal===3||this.reveal===6);
    this.el("flPredict").hidden=this.step!==3||!this.example||this.intro();
    this.el<HTMLInputElement>("flBias").value=String(this.frame/10);
    this.el("flBiasValue").textContent=n(this.frame/10);
    this.el("flBiasFeedback").textContent=this.biasChecked===null?"":this.biasChecked?"맞아요. B 점수가 처음보다 커졌어요.":"아직 B 점수가 처음보다 크지 않아요.";
    this.el("flBiasFeedback").className=this.biasChecked===null?"":this.biasChecked?"correct":"wrong";
    this.el("flBiasCheck").className=this.biasChecked===null?"":this.biasChecked?"correct":"wrong";
    this.el("flQuiz").hidden=!done||this.step===3&&this.example;
    this.el("flNext").hidden=this.step===3&&!done;
    this.el<HTMLButtonElement>("flNext").disabled=!this.passed.has(this.step);
    this.el("flNext").textContent=this.step===4?"고른 특징으로 직접 학습하기 →":"다음 내용 →";
    this.el("flAction").textContent=done?"확인 완료":this.arithmeticPending()||this.outputPending()?"아래 계산 확인":this.intro()&&this.reveal===1&&this.activity.phase<4?`한 항씩 계산 (${this.activity.phase}/4)`:this.intro()?`다음 장면 (${this.reveal+1}/${NEURON_INTRO_STEPS})`:this.step===3?this.example?"0.1 더해 보기":`한 번 고치기 (${Math.floor(this.frame)}/${this.limit()})`:`다음 계산 (${this.reveal}/${this.limit()})`;
    this.el("flPrevious").hidden=this.step===2;
    this.el<HTMLButtonElement>("flPrevious").disabled=this.reveal===0&&this.frame===0;
    this.el<HTMLButtonElement>("flAction").disabled=done||this.arithmeticPending()||this.outputPending();
    this.el("flPlay").hidden=this.step===2;this.el("flPlay").textContent=this.playing?"Ⅱ 멈춤":"▶ 재생";
    this.el("flPlay").setAttribute("aria-label",this.playing?"계산 과정 일시 정지":"계산 과정 자동 재생");
    this.el("flCalculation").setAttribute("aria-live",this.playing?"off":"polite");
  }
  private renderCalculation():void {
    const s=this.store.snapshot, feature=s.features.find(f=>f.id===s.xFeature)!, row=s.data[this.sample]!, calc=featureCalculation(feature,row.pixels), small=smallFeatureExample(feature.id), box=this.el("flCalculation");
    this.el("flTitle").textContent = this.example ? "칸의 진하기를 어떻게 더할까요?" : "같은 방법을 196칸에 적용해요";
    this.el("flVisualTitle").textContent = this.example ? `4×4 예제 · ${small.feature.name}` : `정답 ${s.classes[row.label]} · ${feature.name}`;
    this.el("flText").textContent = this.example ? "그림의 진하기를 0~1 눈금으로 나타냅니다. 흰색은 0, 검정은 1로 정했어요. 여기서 1은 정답 번호나 뉴런 연결값이 아닙니다." : feature.description;
    if (this.example) {
      const terms = small.calculation.terms.map((t,i)=>({...t,index:i})).filter(t=>t.pixel!==0), active = Math.min(terms.length-1,Math.max(0,this.reveal-2));
      this.el("flTiny").innerHTML = `<div class="tiny-grid">${small.pixels.map((v,i)=>`<div class="${this.reveal>=2&&terms[active]?.index===i?"current":""}" style="--ink:${Math.round(255*(1-v))};--text:${v>.65?'white':'#202633'};--term-color:${small.feature.weights[i]!<0?'#7446f5':'#f17605'}"><span>${n(v)}</span>${this.reveal>=1?`<b>× ${n(small.feature.weights[i]!)}</b>`:""}</div>`).join("")}</div><div class="tiny-key">흰색 0 · 회색 0.5 · 검정 1</div>`;
      const t=terms[active]!;
      const weightHelp = small.feature.id==="position"?"왼쪽부터 열 번호 1·2·3·4를 곱해요. 같은 진하기라도 오른쪽 칸에서 곱한 값이 커져요.":small.feature.id==="lr"?"오른쪽은 ×1로 더하고, 왼쪽은 ×−1로 빼요.":small.feature.id==="tb"?"위쪽은 ×1로 더하고, 아래쪽은 ×−1로 빼요.":small.feature.id==="center"?"가운데 네 칸은 ×1, 나머지는 ×0이라 세지 않아요.":"모든 칸에 ×1을 해요. 원래 진하기가 그대로 남아요.";
      if (small.feature.id !== feature.id) this.el("flSourceNote").textContent = "작은 예제는 ‘오른쪽 − 왼쪽’으로 계산을 배웁니다. 선택한 특징은 ‘내 자료에서 확인’에서 봅니다.";
      box.innerHTML = this.reveal===0 ? `<b>1은 검정 한 칸, 0.5는 그 절반의 진하기</b><span>이 예제의 회색은 흰색 0과 검정 1의 중간이라 (0 + 1) ÷ 2 = 0.5입니다.</span><span>검정 한 칸과 회색 한 칸의 진하기를 더하면 1 + 0.5 = 1.5입니다.</span>` : this.reveal===1 ? `<b>먼저 ‘무엇을 셀지’ 정해요</b><span>${weightHelp}</span><span>이 곱셈표는 특징의 뜻에 따라 사람이 정한 것입니다. 학습으로 고치는 뉴런 연결값과는 달라요.</span>` : this.reveal<7 ? `<b class="calculation-pop">${Math.floor(t.index/4)+1}행 ${t.index%4+1}열: ${n(t.pixel)} × (${n(t.weight)}) = ${n(t.product)}</b><span>지금까지 더하면 ${terms.slice(0,active+1).map(t=>`(${n(t.product)})`).join(" + ")} = <b>${n(terms.slice(0,active+1).reduce((v,t)=>v+t.product,0))}</b></span><span>흰 칸은 무엇을 곱해도 0이라 합을 바꾸지 않습니다.</span>` : `<b>더할 값 ${n(small.calculation.positive)} − 뺄 값 ${n(-small.calculation.negative)} = ${n(small.calculation.total)}</b><span>계산한 ${n(small.calculation.total)}은 ‘${small.feature.name}’ 특징값입니다. 각 칸을 세어 만든 수이지, 정답 번호가 아닙니다.</span>`;
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
    const quiz=renderOutputScene(this.root,this.focus,this.reveal,this.outputNeurons,this.outputAnswer,this.activity.linesShown);
    this.quiz(quiz.question,quiz.choices,quiz.explanation);
  }
  private renderMovement():void {
    if(this.intro()){renderNeuronIntroduction(this.root,this.reveal,this.activity,this.playing);return;}
    if(this.example){this.el<HTMLInputElement>("flBias").value=String(this.frame/10);this.el("flBiasValue").textContent=n(this.frame/10);}
    const quiz=renderMovementScene(this.root,this.store.snapshot,this.example,this.frame,this.bias,this.movement!);
    if(!this.playing || this.complete())this.quiz(quiz.question,quiz.choices,quiz.explanation);
  }
}
