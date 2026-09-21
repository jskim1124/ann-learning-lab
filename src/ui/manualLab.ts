import { ManualLab, MANUAL_DIRECTIONS, manualPrediction, manualScore, roundManual, type ManualMission, type ManualParameter, type ManualSource } from '../core/manualLab';
import { LESSON_PROJECTION } from '../core/neuronLesson';
import { drawPixelLatentMap, pixelMapExampleAt, pixelMapInputAt } from '../visualization/pixelLatentMap';
import { NEURON_COLORS } from '../visualization/neuronColors';
import { networkOverview } from './networkOverview';
import './manualLab.css';
import './stableMap.css';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const num=(v:number)=>roundManual(v).toFixed(2);
const colors=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
const titles={move:'선을 옮겨 여섯 점을 모두 맞혀 보세요.',bend:'뉴런을 더해 두 방향의 B를 함께 찾아보세요.',data:'고른 두 특징으로 직접 모델을 고쳐 보세요.'};
const directions=['오른쪽 →','오른쪽 위 ↗','위 ↑','왼쪽 위 ↖','왼쪽 ←','왼쪽 아래 ↙','아래 ↓','오른쪽 아래 ↘'];
interface ManualWorkspaceOptions { host?:HTMLElement; idPrefix?:string; onChange?:(lab:ManualLab)=>void; }

/** Optional practice workspace: isolated from the learner's trained/exported model. */
export class ManualLabWorkspace {
  readonly dialog: HTMLDialogElement;
  private sessions=new Map<ManualMission,ManualLab>();
  private source: ManualSource={data:[],classes:['A','B'],axes:['가로','세로'],note:''};
  private signature='';
  private mission: ManualMission='move';
  private tab='line';
  private dragging=false;
  private gesture: 'point'|'line'='point';
  private showBefore=false;
  private feedback='';
  private feedbackKind='';
  private predicting=false;
  private quizSolved=false;
  private quizKind:'hidden'|'output'='hidden';
  private controlsKey='';
  private resize:ResizeObserver|undefined;
  constructor(private getSource:()=>ManualSource,private options:ManualWorkspaceOptions={}) {
    this.dialog=document.createElement('dialog');this.dialog.className='manual-lab';this.dialog.setAttribute('aria-labelledby',this.id('manualTitle'));
    if(options.host){this.dialog.classList.add('manual-embedded');this.dialog.setAttribute('role','region');}
    this.dialog.innerHTML=`<header class="manual-header"><div><span>원래 모델을 바꾸지 않는 실험실</span><h2 id="manualTitle">내가 모델이 된다면?</h2></div><button data-manual="close" aria-label="실험실 닫고 연습으로 돌아가기">연습으로 돌아가기 ×</button></header>
      <nav class="manual-missions" aria-label="탐구 과제"><button data-mission="move">1 선 하나 고치기</button><button data-mission="bend">2 두 뉴런 합치기</button><button data-mission="data">3 내 자료에 도전</button></nav>
      <p id="manualGoal" class="manual-goal"></p>
      <div class="manual-layout"><section class="manual-map-panel"><div class="manual-map-tools"><button data-gesture="point">점 살펴보기</button><button data-gesture="line">선 잡고 옮기기</button><label><input id="manualBefore" type="checkbox"> 고치기 전 선</label></div><div class="stable-map-slot"><canvas id="manualMap" tabindex="0" aria-label="직접 고치는 뉴런 선과 최종 경계. 점을 선택하거나 선 옮기기 모드로 드래그하세요."></canvas></div><p id="manualPoint" class="manual-point"></p><div class="manual-score"><strong id="manualScore"></strong><span id="manualChange"></span><span id="manualBest"></span></div><p class="manual-legend"><span>● 점 = 정답이 붙은 자료</span><span>색 선 = 뉴런의 합이 0인 곳</span><span>검은 경계 = 예상 답이 바뀌는 곳</span></p></section>
      <section class="manual-controls"><div class="manual-neurons" id="manualNeurons"></div><nav class="manual-tabs" aria-label="직접 고칠 내용"><button data-tab="line">선 고치기</button><button data-tab="output">답으로 연결</button><button data-tab="quiz">작은 계산</button></nav><div id="manualControls"></div><div id="manualFeedback" role="status"></div><div id="manualNetwork"></div></section></div>
      <footer class="manual-footer"><div><button data-manual="undo">한 번 되돌리기</button><button data-manual="reset">이 과제 처음부터</button></div><span id="manualProgress"></span><details><summary>실험 안내</summary><p id="manualNote"></p><p>선은 뉴런 자체가 아니라 계산 결과가 바뀌는 기준입니다. 이 실험은 음수는 0, 양수는 그대로 쓰는 뉴런을 사용합니다. 손으로 고치는 것은 원리를 살펴보는 활동이고, 자동 학습은 오차를 줄이도록 연결값을 계산해 고칩니다. 원래 모델과 내보내기 결과는 바뀌지 않습니다.</p></details></footer>`;
    this.dialog.innerHTML=this.dialog.innerHTML.replace(/id="(manual\w+)"/g,(_,id:string)=>`id="${this.id(id)}" data-manual-region="${id}"`);
    if(options.host)for(const [action,label,symbol] of [['undo','한 번 되돌리기','↶'],['reset','이 과제 처음부터','↻']]){const button=this.dialog.querySelector<HTMLButtonElement>(`[data-manual="${action}"]`)!;button.setAttribute('aria-label',label!);button.title=label!;button.textContent=symbol!;}
    (options.host??document.body).append(this.dialog);
    this.dialog.addEventListener('click',e=>this.click(e));
    this.dialog.addEventListener('pointerdown',e=>{if((e.target as HTMLElement).matches('input[data-parameter]'))this.lab.beginGesture();});
    this.dialog.addEventListener('pointerup',()=>this.lab.endGesture());this.dialog.addEventListener('pointercancel',()=>this.lab.endGesture());
    this.dialog.addEventListener('input',e=>{const input=e.target as HTMLInputElement;if(input.dataset.parameter)this.change(input.dataset.parameter as ManualParameter,Number(input.value));});
    this.dialog.addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.id===this.id('manualBefore')){this.showBefore=input.checked;this.draw();}if(input.id===this.id('manualOutput')){this.lab.output=Number(input.value);this.predicting=false;this.render();}if(input.id===this.id('manualMute')){this.lab.muted=input.checked?this.lab.selected:null;if(input.checked&&this.lab.model.hiddenUnits>1&&this.lab.model.hiddenOutput.some(row=>row[this.lab.selected]!==0))this.lab.compared=true;this.predicting=false;this.render();}});
    const canvas=this.el<HTMLCanvasElement>('manualMap');
    canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.lab.beginGesture();canvas.setPointerCapture?.(e.pointerId);this.move(e);});canvas.addEventListener('pointermove',e=>{if(this.dragging)this.move(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{this.dragging=false;this.lab.endGesture();});
    canvas.addEventListener('keydown',e=>{const d:{[key:string]:[number,number]}={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,.25],ArrowDown:[0,-.25]};if(!d[e.key])return;e.preventDefault();if(this.gesture==='line')this.change('bias',this.lab.model.hiddenBias[this.lab.selected]!+(e.key==='ArrowUp'||e.key==='ArrowRight'?.25:-.25));else{const [x,y]=d[e.key]!;this.lab.choosePoint([Math.max(-1,Math.min(1,this.lab.point[0]!+x)),Math.max(-1,Math.min(1,this.lab.point[1]!+y))],null);this.quizSolved=false;this.predicting=false;this.render();}});
    if(typeof ResizeObserver!=='undefined'){this.resize=new ResizeObserver(()=>{if(this.dialog.open)this.draw();});this.resize.observe(canvas);}
  }
  private id(id:string):string{return `${this.options.idPrefix??''}${id}`;}
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.dialog.querySelector<T>(`#${this.id(id)}`)!;}
  get lab(): ManualLab {let lab=this.sessions.get(this.mission);if(!lab){lab=new ManualLab(this.mission,this.source);this.sessions.set(this.mission,lab);}return lab;}
  reset():void {this.sessions.clear();this.signature='';this.controlsKey='';}
  open(mission?:ManualMission):void {
    const source=this.getSource(),signature=JSON.stringify(source);
    if(signature!==this.signature){this.sessions.clear();this.source=source;this.signature=signature;this.mission='move';this.tab='line';this.feedback='';this.feedbackKind='';this.predicting=false;this.quizSolved=false;}
    if(mission&&mission!==this.mission){this.mission=mission;this.tab='line';this.feedback='';this.feedbackKind='';this.quizSolved=false;this.predicting=false;}
    if(this.options.host)this.dialog.open=true;else this.dialog.showModal();this.render();
  }
  private click(event:MouseEvent):void {
    const button=(event.target as HTMLElement).closest<HTMLButtonElement>('button');if(!button)return;
    const d=button.dataset,l=this.lab;
    if(d.mission){this.mission=d.mission as ManualMission;this.tab='line';this.feedback='';this.feedbackKind='';this.predicting=false;this.quizSolved=false;this.showBefore=false;this.el<HTMLInputElement>('manualBefore').checked=false;}
    if(d.tab){this.tab=d.tab;this.feedback='';this.feedbackKind='';this.predicting=false;this.quizSolved=false;if(d.tab==='quiz'){const p=[.5,.5],i=l.source.data.findIndex(row=>row.pixels.every((v,j)=>v===p[j]));l.choosePoint(p,i>=0?i:null);}}
    if(d.quizKind){this.quizKind=d.quizKind as 'hidden'|'output';this.quizSolved=false;this.feedback='';this.feedbackKind='';}
    if(d.gesture)this.gesture=d.gesture as 'point'|'line';
    if(d.neuron!==undefined||d.networkNeuron!==undefined){l.selected=Number(d.neuron??d.networkNeuron);l.muted=null;this.predicting=false;this.quizSolved=false;this.feedback='';this.feedbackKind='';}
    if(d.networkOutput!==undefined){const output=Number(d.networkOutput);if(output>0)l.output=output;this.tab='output';this.predicting=false;this.quizSolved=false;this.feedback=output===0?`${l.source.classes[0]} 점수는 비교 기준 0으로 고정했어요. 나머지 답의 점수를 바꿔 보세요.`:'';this.feedbackKind='';}
    if(d.manual==='close'){this.dialog.close();return;}
    if(d.manual==='add'){l.addNeuron();this.tab='output';this.feedback='새 뉴런에 곱할 값은 0이에요. 답에 얼마나 더할지, 뺄지 정해 보세요.';this.feedbackKind='';this.quizSolved=false;}
    if(d.manual==='remove'){l.removeNeuron();this.predicting=false;this.quizSolved=false;}
    if(d.manual==='undo'){l.undo();this.feedback='한 번 고치기 전으로 돌아왔어요.';this.predicting=false;this.quizSolved=false;}
    if(d.manual==='reset'){l.reset();this.feedback='';this.feedbackKind='';this.predicting=false;this.quizSolved=false;}
    if(d.manual==='predict'){l.muted=null;this.predicting=true;this.feedback='';}
    if(d.guess){const p=l.biasPreview(),truth=Math.abs(p.after-p.before)<1e-9?'same':p.after>p.before?'up':'down';if(d.guess!==truth){this.feedback='오답이에요. 뉴런이 넘긴 수를 이 답에 더하는지 빼는지 살펴보세요.';this.feedbackKind='wrong';}else{l.predictions++;l.edit('bias',l.model.hiddenBias[l.selected]!+.25);this.predicting=false;this.feedback=`맞았어요. ${l.source.classes[l.output]} 점수 ${num(p.before)} → ${num(p.after)}. 선과 예상도 함께 확인하세요.`;this.feedbackKind='correct';}}
    if(d.answer!==undefined){const answer=this.quizKind==='hidden'?l.calculation.answer:roundManual(l.calculation.logits[l.output]!);if(Number(d.answer)===answer){if(!this.quizSolved){l.calculations++;if(this.quizKind==='output'&&l.model.hiddenUnits>1)l.outputCalculations++;}this.quizSolved=true;this.feedback=this.quizKind==='hidden'?'맞았어요! 이 숫자를 답을 고르는 계산으로 넘겨요.':'맞았어요! 가장 큰 점수의 답을 골라요. 답 점수는 음수여도 그대로 비교합니다.';this.feedbackKind='correct';}else{this.feedback=this.quizKind==='hidden'?'오답이에요. 곱한 값을 더한 뒤, 음수이면 0으로 바꿔 보세요.':'오답이에요. 각 뉴런의 수에 연결값을 곱하고, 마지막 값을 더하세요.';this.feedbackKind='wrong';}}
    this.render();
  }
  private change(parameter:ManualParameter,value:number):void {this.lab.edit(parameter,value);this.quizSolved=false;this.predicting=false;this.feedback='';this.feedbackKind='';this.render();}
  private move(e:PointerEvent):void {
    const canvas=this.el<HTMLCanvasElement>('manualMap'),point=pixelMapInputAt(canvas,e.clientX,e.clientY);if(!point)return;
    if(this.gesture==='line'){const [a,b]=this.lab.model.inputHidden[this.lab.selected]!;this.change('bias',Math.round(-(a!*point[0]+b!*point[1])*4)/4);}
    else{const index=pixelMapExampleAt(canvas,e.clientX,e.clientY,LESSON_PROJECTION,this.lab.source.data);this.lab.choosePoint(index===null?point.map(v=>Math.round(v*4)/4):this.lab.source.data[index]!.pixels,index);this.quizSolved=false;this.predicting=false;this.feedback='';this.feedbackKind='';this.render();}
  }
  render():void {
    const l=this.lab,m=l.model,h=l.selected,source=l.source;
    // Restore focused range elements after live rendering, including keyboard focus.
    const active=this.dialog.querySelector(':focus') as HTMLElement|null,focused=active?.id,range=active?.dataset.parameter;
    this.el('manualGoal').textContent=titles[this.mission]+(this.options.host?' · 작은 A/B 예제':'');
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-mission]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mission===this.mission)));
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===this.tab)));
    this.dialog.querySelectorAll<HTMLButtonElement>('[data-gesture]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gesture===this.gesture)));
    this.el('manualNeurons').innerHTML=`<span>은닉 뉴런</span>${m.inputHidden.map((_,i)=>`<button data-neuron="${i}" aria-label="뉴런 ${i+1} 고르기" aria-pressed="${i===h}" style="--neuron:${NEURON_COLORS[i]}">${i+1}</button>`).join('')}<button data-manual="add" ${m.hiddenUnits>=4?'disabled':''}>+ 추가</button><button data-manual="remove" aria-label="고른 뉴런 삭제" ${m.hiddenUnits<=1?'disabled':''}>−</button>`;
    const slider=(label:string,parameter:ManualParameter,value:number,step=.25)=>`<label class="manual-slider">${label}<output>${num(value)}</output><input data-parameter="${parameter}" aria-label="${label}" type="range" min="-2" max="2" step="${step}" value="${value}"></label>`;
    const direction=MANUAL_DIRECTIONS.findIndex(row=>row.every((v,i)=>v===m.inputHidden[h]![i]));
    const outputChoice=`<label class="manual-output-choice">고칠 답 <select id="${this.id('manualOutput')}">${source.classes.slice(1).map((c,i)=>`<option value="${i+1}" ${i+1===l.output?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`;
    const controlsKey=JSON.stringify([this.mission,this.tab,h,l.output,m.hiddenUnits,this.predicting,this.quizSolved,this.quizKind,source.classes,this.tab==='quiz'?l.calculation:null,this.predicting?[l.point,m.hiddenBias,m.hiddenOutput]:null]);
    const rebuild=controlsKey!==this.controlsKey;this.controlsKey=controlsKey;
    if(rebuild){
    if(this.tab==='line')this.el('manualControls').innerHTML=`<p class="manual-instruction">은닉 뉴런은 입력을 곱하고 더해 <b>숫자 하나</b>를 만드는 계산기예요.</p>${slider('뉴런 합에 마지막으로 더할 값', 'bias',m.hiddenBias[h]!)}<label class="manual-direction">값이 커지는 방향<select data-parameter="direction" aria-label="뉴런 값이 커지는 방향">${directions.map((s,i)=>`<option value="${i}" ${i===direction?'selected':''}>${s}</option>`).join('')}</select></label><small>더할 값만 바꾸면 선이 나란히 옮겨져요. ‘선 잡고 옮기기’로도 바꿔 보세요.</small>`;
    else if(this.tab==='output')this.el('manualControls').innerHTML=`<p class="manual-instruction">출력은 뉴런의 수를 모아 <b>답마다 점수</b>를 매기는 계산기예요.</p>${outputChoice}${slider(`뉴런 ${h+1}의 수에 곱할 값`,'connection',m.hiddenOutput[l.output]![h]!,.5)}${slider('답에 마지막으로 더할 값','outputBias',m.outputBias[l.output]!)}<label><input id="${this.id('manualMute')}" type="checkbox" ${l.muted!==null?'checked':''}> 뉴런 ${h+1} 없이 비교</label>`;
    else{
      const r=l.calculation,w=m.inputHidden[h]!,answer=this.quizKind==='hidden'?r.answer:roundManual(r.logits[l.output]!),choices=[answer+.5,answer-.5,answer];
      choices.push(...choices.splice(0,Math.abs(Math.round(r.sum*4)+h)%3));
      this.el('manualControls').innerHTML=`<div class="manual-quiz-kind"><button data-quiz-kind="hidden" aria-pressed="${this.quizKind==='hidden'}">뉴런의 수</button><button data-quiz-kind="output" aria-pressed="${this.quizKind==='output'}">답의 점수</button></div><p class="manual-instruction">선택한 좌표 (${num(l.point[0]!)}, ${num(l.point[1]!)})</p><div class="manual-arithmetic">${this.quizKind==='hidden'?`<span>${num(l.point[0]!)} × (${num(w[0]!)}) = <b>${num(r.products[0]!)}</b></span><span>${num(l.point[1]!)} × (${num(w[1]!)}) = <b>${num(r.products[1]!)}</b></span><span>두 곱의 합 + (${num(m.hiddenBias[h]!)}) = <b>${num(r.sum)}</b></span>`:r.hidden.map((v,i)=>`<span style="color:${NEURON_COLORS[i]}">뉴런 ${i+1}: ${num(v)} × (${num(l.effective.hiddenOutput[l.output]![i]!)}) = <b>${num(v*l.effective.hiddenOutput[l.output]![i]!)}</b></span>`).join('')+`<span>위 곱을 모두 더하고 (${num(m.outputBias[l.output]!)})를 더해요.</span>`}</div><strong>${this.quizKind==='hidden'?'음수면 0, 양수면 그대로. 넘길 수는?':`${esc(source.classes[l.output]!)}의 답 점수는? (음수도 그대로)`}</strong><div class="manual-answers">${choices.map(v=>`<button data-answer="${roundManual(v)}" ${this.quizSolved?'disabled':''} class="${this.quizSolved&&v===answer?'correct':''}">${num(v)}</button>`).join('')}</div><small>화면 값은 소수 둘째 자리까지 표시해요.</small>`;
    }
    if(this.tab==='line'){
      const b=m.hiddenBias[h]!,p=l.biasPreview();
      this.el('manualControls').insertAdjacentHTML('beforeend',this.predicting?`<div class="manual-prediction"><strong>뉴런 ${h+1}에 더할 값 ${num(b)} → ${num(Math.min(2,b+.25))}</strong><span>${esc(source.classes[l.output]!)} 점수 ${num(p.before)}는?</span><div class="manual-answers"><button data-guess="up">커진다</button><button data-guess="down">작아진다</button><button data-guess="same">같다</button></div></div>`:`<button class="manual-predict" data-manual="predict" ${b>=2?'disabled':''}>+0.25 하기 전, 결과 예상하기</button>`);
    }
    }
    this.el('manualControls').querySelectorAll<HTMLInputElement>('[data-parameter]').forEach(input=>{const value=input.dataset.parameter==='bias'?m.hiddenBias[h]!:input.dataset.parameter==='direction'?direction:input.dataset.parameter==='connection'?m.hiddenOutput[l.output]![h]!:m.outputBias[l.output]!;input.value=String(value);const out=input.parentElement?.querySelector('output');if(out)out.textContent=num(value);});
    const predictButton=this.dialog.querySelector<HTMLButtonElement>('[data-manual="predict"]');if(predictButton)predictButton.disabled=m.hiddenBias[h]!>=2;
    const mute=this.el<HTMLInputElement>('manualMute');if(mute)mute.checked=l.muted!==null;
    this.dialog.querySelector('.manual-output-score')?.remove();
    if(this.tab==='output'){const r=l.calculation,w=l.effective.hiddenOutput[l.output]![h]!;this.el('manualControls').insertAdjacentHTML('beforeend',`<p class="manual-output-score"><small>× ${num(w)}: 뉴런 ${h+1}의 수를 ${w===0?'쓰지 않아요':w===1?'그대로 더해요':w===-1?'그대로 빼요':`${num(Math.abs(w))}배 해서 ${w>0?'더해요':'빼요'}`}.</small>${esc(source.classes[l.output]!)} 점수: ${r.hidden.map((v,i)=>num(v*l.effective.hiddenOutput[l.output]![i]!)).map(v=>`(${v})`).join(' + ')} + (${num(m.outputBias[l.output]!)}) = <b>${num(r.logits[l.output]!)}</b><small>${esc(source.classes[0]!)} 점수는 비교 기준 0. 더 큰 점수의 답을 골라요.</small></p>`);}
    const feedback=this.el('manualFeedback');feedback.textContent=this.feedback;feedback.className=this.feedbackKind;
    this.el('manualNetwork').innerHTML=networkOverview(l.effective,l.point,source.classes,true,h,l.output,{classColors:colors,onlyOutput:source.classes.length>3?l.output:undefined});
    this.el('manualNetwork').style.setProperty('--manual-network-height',m.hiddenUnits>=4?'110px':'80px');
    this.el('manualNetwork').querySelector('.network-change')?.remove();
    const outputHeading=this.el('manualNetwork').querySelector('.network-headings span:last-child');if(outputHeading)outputHeading.textContent='예상 비율';
    const result=manualPrediction(l.effective,l.point),truth=l.pointIndex===null?'계산용 좌표':`정답 ${source.classes[source.data[l.pointIndex]!.label]}`;
    this.el('manualPoint').innerHTML=`<span>${esc(truth)}</span><span>예상 <b style="color:${result===null?'#626b76':colors[result%colors.length]}">${result===null?'동점':esc(source.classes[result]!)}</b></span><span>(${num(l.point[0]!)}, ${num(l.point[1]!)})</span>`;
    this.el('manualScore').textContent=`${l.score} / ${source.data.length}개 맞힘`;
    this.el('manualScore').classList.toggle('complete',l.won);
    const difference=l.previous?l.score-manualScore(l.previous,source.data):0;
    this.el('manualChange').textContent=l.muted!==null?'뉴런을 끈 비교 화면':l.previous?difference>0?`고치기 전보다 ${difference}개 더 맞힘`:difference<0?`${-difference}개 덜 맞힘 · 되돌려도 좋아요`:'맞힌 개수는 같아요':'';
    this.el('manualBest').textContent=`최고 ${l.best}개`;
    this.el('manualProgress').textContent=l.won?this.mission==='data'?'지금 자료는 모두 맞혔어요. 새 자료에서도 맞을까요?':'모두 맞혔어요! 다른 위치에서도 되는지 실험해 보세요.':`직접 수정 ${l.edits}회 · 계산 성공 ${l.calculations}회`;
    this.el('manualNote').textContent=source.note;
    this.dialog.querySelector<HTMLButtonElement>('[data-manual="undo"]')!.disabled=!l.history.length;
    if(range)this.dialog.querySelector<HTMLElement>(`[data-parameter="${range}"]`)?.focus({preventScroll:true});else if(focused&&focused!=='manualMap')this.dialog.querySelector<HTMLElement>(`#${focused}`)?.focus({preventScroll:true});
    this.draw();this.options.onChange?.(l);
  }
  private draw():void {
    if(!this.dialog.open)return;const l=this.lab;
    const canvas=this.el<HTMLCanvasElement>('manualMap');
    drawPixelLatentMap(canvas,l.effective,l.source.data,l.point,LESSON_PROJECTION,{neutralTies:true,classLabels:l.source.classes,showDataLabels:l.source.data.length<=8&&canvas.getBoundingClientRect().width>=500,showNeuronBoundaries:true,showDecisionBoundary:true,resolution:56,previousNeuronModel:this.showBefore?l.previous:undefined,focusLabel:l.pointIndex===null?'계산할 점':`정답 ${l.source.classes[l.source.data[l.pointIndex]!.label]}`,axisLegend:{horizontal:{title:l.source.axes[0],negative:'',positive:''},vertical:{title:l.source.axes[1],negative:'',positive:''}}});
  }
}
