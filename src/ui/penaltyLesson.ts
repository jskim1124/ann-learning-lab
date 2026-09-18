import { forward } from '../core/neuralNetwork';
import { penaltyTeachingModel, penaltyPixelModel, PENALTY_CASES, PENALTY_PROJECTION, PENALTY_AXES } from '../core/penalty';
import { drawPixelLatentMap, pixelMapInputAt } from '../visualization/pixelLatentMap';
import { drawGraphCallout } from '../visualization/graphCallout';
import { workspacePanels } from './workspacePanels';
import { PALETTE } from '../visualization/canvasUtils';
import './penaltyWorkspace.css';

const n=(v:number)=>String(Number(v.toFixed(2)));
const QUESTIONS=[
  {text:'공은 오른쪽 끝, 골키퍼는 왼쪽 끝. 좌표는?',formula:'가로 = 공 · 세로 = 골키퍼',choices:['(−1, 1)','(1, −1)','(1, 1)'],answer:1,why:'공의 +1이 가로, 골키퍼의 −1이 세로입니다.'},
  {text:'(1, 1)에서 가로만 −1로 바꾸면 넘기는 숫자는?',formula:'−1 + 1 = ?',choices:['−2','2','0'],answer:2,why:'합이 0이므로 다음 계산에 0을 넘깁니다.'},
  {text:'둘 다 왼쪽: 뉴런 1은 0, 뉴런 2는 2. 골 점수는?',formula:'1 − 0 − 2 = ?',choices:['−1 → 막힘','0 → 동점','1 → 골'],answer:0,why:'골 점수가 0보다 작으므로 막힘으로 예상합니다.'},
  {text:'점은 그대로인데 골 점수가 높아진 이유는?',formula:'우리가 움직인 것은 보라색 더할 값 하나입니다.',choices:['자료 점을 다른 곳으로 옮겨서','빼는 숫자가 작아져서','선이 항상 위로 움직여서'],answer:1,why:'1에서 빼는 숫자가 작아져 골 점수가 높아졌습니다. 다른 모델은 이동 방향도 다를 수 있어요.'},
];

/** Manipulate one quantity at a time. Teaching parameters are distinct from actual training. */
export class PenaltyLesson {
  readonly root:HTMLElement;
  private step=0;private phase=0;private answer:number|null=null;private passed=new Set<number>();
  private timer=0;private prediction:number|null=null;private point:[number,number]=[1,1];private hidden=2;
  constructor(private next:()=>void){
    this.root=document.createElement('div');this.root.id='penaltyUnderstanding';this.root.className='image-workspace penalty-understanding';this.root.hidden=true;
    this.root.innerHTML=`<section class="image-panel penalty-lesson-visual">
      <div class="image-heading"><h2 id="plVisualTitle"></h2></div><p class="penalty-caveat">계산을 위한 작은 예제 · 학습으로 얻은 값은 아닙니다.</p>
      <div id="plCoordinates" class="penalty-live-inputs"><label>공의 좌우 <output id="plXValue"></output><input id="plX" type="range" min="-1" max="1" step=".5" value="1"></label><label>골키퍼 좌우 <output id="plYValue"></output><input id="plY" type="range" min="-1" max="1" step=".5" value="1"></label></div>
      <canvas id="plMap" tabindex="0" aria-label="점을 움직여 계산하는 승부차기 지도"></canvas><div id="plNetwork" class="penalty-network"></div><p id="plMapNote"></p>
      </section><section class="image-panel image-lesson-copy">
      <nav class="image-lesson-tabs" aria-label="승부차기 이해 순서">${['좌표','뉴런 계산','뉴런 추가','선 움직임'].map((s,i)=>`<button data-pl-step="${i}">${i+1} ${s}</button>`).join('')}</nav>
      <h2 id="plTitle"></h2><p id="plText"></p><div id="plCalculation" class="image-calculation" aria-live="polite"></div>
      <div id="plNeuronCount" class="lesson-choice-grid"><button data-pl-hidden="1">은닉 뉴런 1개</button><button data-pl-hidden="2">은닉 뉴런 2개</button></div>
      <div id="plPredict" class="image-quiz"><strong>1에서 빼는 숫자가 2 → 1로 작아지면 골 점수는?</strong><div class="lesson-choice-grid"><button data-pl-predict="0">커진다</button><button data-pl-predict="1">작아진다</button></div><p id="plPredictionFeedback" role="status"></p></div>
      <label id="plBiasControl" class="penalty-bias">뉴런 1에 마지막으로 더할 값 <output id="plBiasValue">2</output><input id="plBias" type="range" min="0" max="2" step=".1" value="2"></label>
      <div class="lesson-playback"><button id="plReplay">처음부터</button><button id="plAdvance" class="button primary">한 단계씩 보기</button><button id="plPlay">▶ 재생</button></div>
      <section id="plQuiz" class="image-quiz"><strong id="plQuestion"></strong><p id="plQuizFormula"></p><div id="plChoices" class="lesson-choice-grid"></div><p id="plFeedback" role="status"></p></section><button id="plNext" class="button primary"></button><p id="plProgress" class="penalty-caveat"></p></section>`;
    document.querySelector('[data-app-page="3"] .page-nav')!.before(this.root);
    workspacePanels(this.root,[...this.root.children],['예제·그래프','설명·확인'],()=>this.render());
    this.root.addEventListener('click',e=>{
      const t=e.target as HTMLElement,tab=t.closest<HTMLElement>('[data-pl-step]'),choice=t.closest<HTMLElement>('[data-pl-choice]'),prediction=t.closest<HTMLElement>('[data-pl-predict]'),count=t.closest<HTMLElement>('[data-pl-hidden]');
      if(tab){this.stop();this.step=Number(tab.dataset.plStep);this.restart();}
      if(choice){this.answer=Number(choice.dataset.plChoice);if(this.answer===QUESTIONS[this.step]!.answer)this.passed.add(this.step);else this.passed.delete(this.step);}
      if(prediction)this.prediction=Number(prediction.dataset.plPredict);
      if(count)this.hidden=Number(count.dataset.plHidden);
      if(tab||choice||prediction||count)this.render();
    });
    for(const [id,index] of [['plX',0],['plY',1]] as const)this.el(id).addEventListener('input',()=>{this.point[index]=Number(this.el<HTMLInputElement>(id).value);this.render();});
    const map=this.el<HTMLCanvasElement>('plMap');let dragging=false;
    const move=(e:PointerEvent)=>{if(!dragging||this.step===3)return;const p=pixelMapInputAt(map,e.clientX,e.clientY);if(p){this.point=p.map(v=>Math.round(v*2)/2) as [number,number];this.render();}};
    map.addEventListener('pointerdown',e=>{dragging=true;map.setPointerCapture?.(e.pointerId);move(e);});map.addEventListener('pointermove',move);map.addEventListener('pointerup',()=>dragging=false);map.addEventListener('pointercancel',()=>dragging=false);
    this.el('plBias').addEventListener('input',()=>{this.stop();this.phase=(2-Number(this.el<HTMLInputElement>('plBias').value))*10;this.answer=null;this.passed.delete(3);this.render();});
    this.el('plAdvance').addEventListener('click',()=>{this.stop();this.advance();});
    this.el('plPlay').addEventListener('click',()=>{if(this.timer){this.stop();this.render();}else this.play();});
    this.el('plReplay').addEventListener('click',()=>{this.stop();this.restart();this.render();});
    this.el('plNext').addEventListener('click',()=>{if(!this.passed.has(this.step))return;this.stop();if(this.step===3){if(this.passed.size===4)this.next();}else{this.step++;this.restart();this.render();}});
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector<T>('#'+id)!;}
  private restart():void{this.phase=0;this.answer=null;this.prediction=null;this.point=this.step===2?[-1,-1]:[1,1];this.hidden=2;}
  reset():void{this.stop();this.step=0;this.restart();this.passed.clear();}
  stop():void{window.clearTimeout(this.timer);this.timer=0;}
  show(active:boolean):void{this.root.hidden=!active;if(active)this.render();else this.stop();}
  private limit():number{return this.step===3?20:3;}
  private advance():void{if(this.step===3&&this.prediction!==0)return;this.phase=Math.min(this.phase+(this.step===3?5:1),this.limit());this.render();}
  private play():void{if(this.phase===this.limit()||this.step===3&&this.prediction!==0)return;this.phase++;this.render();if(this.phase<this.limit())this.timer=window.setTimeout(()=>{this.timer=0;this.play();},this.step===3?180:1200);this.el('plPlay').textContent=this.timer?'Ⅱ 멈춤':'▶ 재생';}
  render():void{
    if(this.root.hidden)return;
    const step=this.step,phase=this.phase,done=phase===this.limit(),point=step===3?[-1,1]:this.point;
    const model=penaltyTeachingModel(step===1?1:step===2?this.hidden:2);
    if(step===3)model.parameters.hiddenBias=[2-phase/10,0];
    const r=forward(model,point[0]!,point[1]!),sum=point[0]!+point[1]!+model.parameters.hiddenBias[0]!;
    const truth=point[0]===0||point[1]===0?'미지정':point[0]!*point[1]!<0?'골':'막힘';
    const prediction=Math.abs(r.logit)<1e-9?'동점':r.logit>0?'골':'막힘';
    this.root.querySelectorAll<HTMLElement>('[data-pl-step]').forEach((b,i)=>{b.classList.toggle('active',i===step);b.classList.toggle('done',this.passed.has(i));b.setAttribute('aria-pressed',String(i===step));});
    this.el('plTitle').textContent=['가운데가 0이에요','뉴런은 두 수를 계산해요','뉴런 하나를 더하면?','한 수를 바꾸면 선은 어디로?'][step]!;
    this.el('plText').textContent=['왼쪽은 −, 오른쪽은 +. 공의 숫자를 가로, 골키퍼의 숫자를 세로로 놓아요. 왼쪽 조절 막대를 움직여 보세요.','연결값 1은 그대로 더한다는 뜻입니다. 여기서는 합이 음수면 0, 양수면 그대로 다음 계산에 넘깁니다.','둘 다 왼쪽인 점에서 1개와 2개를 바꿔 보세요. 두 번째 뉴런이 반대쪽 경우를 맡습니다.','이번에는 더할 값 한 곳만 직접 고칩니다. 실제 학습은 오차를 줄이도록 여러 값을 함께 고칩니다.'][step]!;
    this.el('plVisualTitle').textContent=`정답 ${truth}${step?` · 모델 예상 ${prediction}`:''}`;
    this.el('plCoordinates').hidden=step===3;
    for(const [id,index] of [['plX',0],['plY',1]] as const){this.el<HTMLInputElement>(id).value=String(point[index]);this.el(id+'Value').textContent=n(point[index]!);}
    const before=penaltyTeachingModel();before.parameters.hiddenBias=[2,0];
    drawPixelLatentMap(this.el('plMap'),penaltyPixelModel(model),PENALTY_CASES,point,PENALTY_PROJECTION,{view:step===0?'placement':'decision',classColors:[PALETTE.zero,PALETTE.one],classLabels:['막힘','골'],axisLegend:PENALTY_AXES,showDataLabels:true,onlyNeuron:step===3?0:undefined,showNeuronBoundaries:step>0,showDecisionBoundary:step>0,previousNeuronModel:step===3?penaltyPixelModel(before):undefined,focusLabel:`정답 ${truth}`});
    const add=step===3?` + ${n(model.parameters.hiddenBias[0]!)}`:'';
    if(step)drawGraphCallout(this.el('plMap'),point,[`${n(point[0]!)} + ${n(point[1]!)}${add} = ${n(sum)}`,`넘길 숫자 ${n(r.hidden[0]!)} → 골 점수 ${n(r.logit)}`]);
    const texts=[
      [`<b>가로 ${n(point[0]!)} · 세로 ${n(point[1]!)}</b><span>변환식 없이 골대 눈금에서 바로 읽어요.</span>`,`<b>공의 ${n(point[0]!)}을 가로에 놓아요.</b>`,`<b>골키퍼의 ${n(point[1]!)}만큼 위·아래로 이동해요.</b><span>사진의 높이가 아니라 골키퍼의 좌우 선택입니다.</span>`,`<b>두 선택을 점 하나로: (${n(point[0]!)}, ${n(point[1]!)})</b>`],
      [`<b>가로 ${n(point[0]!)} + 세로 ${n(point[1]!)}</b><span>두 입력에 각각 1을 곱하므로 값이 그대로예요.</span>`,`<b>${n(point[0]!)} + ${n(point[1]!)} = ${n(sum)}</b><span>연결지도에서도 같은 숫자를 확인하세요.</span>`,`<b>다음에 넘길 숫자 = ${n(r.hidden[0]!)}</b><span>‘신호’란 이 숫자입니다. 별도의 에너지가 아닙니다.</span>`,`<b>골 점수: 1 − ${n(r.hidden[0]!)} = ${n(r.logit)}</b><span>0보다 크면 골, 작으면 막힘, 0이면 동점. 둘 다 왼쪽인 경우에는 이 뉴런 하나로 부족해요.</span>`],
      [`<b>뉴런 1은 두 입력을 그대로 더해요.</b>`,`<b>뉴런 2는 부호를 뒤집어 더해요.</b><span>(${n(point[0]!)} × −1) + (${n(point[1]!)} × −1). 음수인 합은 0으로 바꿉니다.</span>`,`<b>골 점수 = 1 − ${r.hidden.map(n).join(' − ')} = ${n(r.logit)}</b><span>검은 경계는 이 점수가 0이 되는 자리입니다.</span>`,`<b>1개 ↔ 2개를 비교해 보세요.</b><span>새 뉴런은 계산에 쓸 숫자를 추가합니다. 답의 종류 ‘막힘·골’은 그대로입니다. 두 뉴런이 모든 새 자료를 맞힌다는 뜻은 아니에요.</span>`],
    ];
    this.el('plCalculation').innerHTML=step===3?`<b>합 = −1 + 1 + <mark>${n(model.parameters.hiddenBias[0]!)}</mark> = ${n(sum)}</b><span>골 점수 = 1 − ${n(r.hidden[0]!)} − 0 = <b>${n(r.logit)}</b></span><span>더할 값을 줄이면 뺄 숫자도 작아집니다. 회색 점선은 처음, 보라선은 지금입니다.</span><span>한 값만 바꾼 실험입니다. 실제 학습은 여러 값을 함께 고칩니다.</span>`:texts[step]![phase]!;
    this.el('plNetwork').innerHTML=`<div class="penalty-inputs">공 <b>${point[0]}</b><br>골키퍼 <b>${point[1]}</b></div><span aria-hidden="true">→</span><div class="penalty-signals">${r.hidden.map((v,i)=>`<div style="--neuron-color:${i?'#df466f':'#7446f5'}">뉴런 ${i+1}<b>${n(v)}</b><span>넘길 숫자</span></div>`).join('')}</div><span aria-hidden="true">→</span><div class="penalty-output"><span>골 점수</span><b>1 − ${r.hidden.map(n).join(' − ')} = ${n(r.logit)}</b><strong>예상 ${prediction}</strong></div>`;
    this.el('plNetwork').hidden=step===0;
    this.el('plCalculation').classList.remove('penalty-phase');void this.el('plCalculation').offsetWidth;this.el('plCalculation').classList.add('penalty-phase');
    if(step===1)this.el('plNetwork').querySelector(phase<2?'.penalty-inputs':phase===2?'.penalty-signals':'.penalty-output')?.classList.add('penalty-phase');
    this.el('plMapNote').textContent=step===0?'공의 좌우 → 가로 · 골키퍼의 좌우 → 세로':step===3?'점은 고정입니다. 더할 값과 선의 위치만 바뀝니다.':'신호 = 다음 계산에 넘기는 숫자 · 점 색은 정답, 배경은 예상';
    this.el('plNeuronCount').hidden=step!==2;this.root.querySelectorAll<HTMLElement>('[data-pl-hidden]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.plHidden)===this.hidden)));
    this.el('plPredict').hidden=step!==3||phase>0;
    this.root.querySelectorAll<HTMLElement>('[data-pl-predict]').forEach((b,i)=>{b.classList.toggle('correct',this.prediction===i&&i===0);b.classList.toggle('wrong',this.prediction===i&&i!==0);});
    this.el('plPredictionFeedback').textContent=this.prediction===null?'':this.prediction===0?'맞아요. 1 − 2 = −1, 1 − 1 = 0. 이제 슬라이더를 움직이세요.':'오답입니다. 1 − 2와 1 − 1을 비교해 보세요.';
    this.el('plBiasControl').hidden=step!==3;this.el<HTMLInputElement>('plBias').disabled=this.prediction!==0;this.el<HTMLInputElement>('plBias').value=String(2-phase/10);this.el('plBiasValue').textContent=n(2-phase/10);
    this.el('plQuiz').hidden=!done;const q=QUESTIONS[step]!;this.el('plQuestion').textContent=q.text;this.el('plQuizFormula').textContent=q.formula;
    this.el('plChoices').innerHTML=q.choices.map((s,i)=>`<button data-pl-choice="${i}" aria-pressed="${this.answer===i}" class="${this.answer===i?(i===q.answer?'correct':'wrong'):''}">${s}</button>`).join('');
    this.el('plFeedback').textContent=this.answer===null?'':this.answer===q.answer?`맞아요. ${q.why}`:'오답입니다. 위 계산을 다시 확인해 보세요.';
    this.el<HTMLButtonElement>('plAdvance').disabled=done||step===3&&this.prediction!==0;this.el<HTMLButtonElement>('plPlay').disabled=done||step===3&&this.prediction!==0;
    this.el('plAdvance').textContent=done?'확인 완료':step===3?'0.5 줄여 보기':`다음 계산 (${phase}/3)`;this.el('plPlay').textContent=this.timer?'Ⅱ 멈춤':'▶ 재생';
    this.el('plNext').textContent=step===3?'직접 학습하기 →':'다음 내용 →';this.el<HTMLButtonElement>('plNext').disabled=!this.passed.has(step)||step===3&&this.passed.size<4;
    this.el('plProgress').textContent=`확인 ${this.passed.size}/4`;this.el('plText').hidden=done||step===3;
  }
}
