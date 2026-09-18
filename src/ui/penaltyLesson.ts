import { forward } from '../core/neuralNetwork';
import { penaltyTeachingModel, penaltyPixelModel, penaltyLearningTrace, PENALTY_CASES, PENALTY_PROJECTION, PENALTY_AXES } from '../core/penalty';
import { drawPixelLatentMap } from '../visualization/pixelLatentMap';
import { workspacePanels } from './workspacePanels';
import { PALETTE } from '../visualization/canvasUtils';
import './penaltyWorkspace.css';

const n=(v:number)=>String(Number(v.toFixed(3)));
const QUESTIONS=[
  {text:'공을 골대 왼쪽 끝에서 0.75 지점에 놓으면 가로 좌표는?',formula:'(0.75 − 0.5) × 2 = ?',choices:['−0.5','0.5','0.75'],answer:1,why:'(0.75 − 0.5) × 2 = 0.5. 가운데보다 오른쪽입니다.'},
  {text:'가로만 −0.5로 바꾸면 뉴런 1이 보내는 값은?',formula:'−0.5 × 1 + 0.5 × 1 − 0.25 = −0.25',choices:['−0.25','0.25','0'],answer:2,why:'이 예제는 합이 음수면 0을 보냅니다. 모든 뉴런이 반드시 이 방법을 쓰는 것은 아닙니다.'},
  {text:'두 사람이 왼쪽이면 신호는 0과 0.75입니다. 골 점수는?',formula:'골 점수 = 0.5 − 0 − 0.75 = ?',choices:['−0.25 → 막힘','0.25 → 골','0.75 → 골'],answer:0,why:'−0.25는 비교 기준 0보다 작아 막힘으로 예상합니다.'},
  {text:'이 학습에서 정답인 골 쪽으로 예상이 바뀐 이유는?',formula:'대표 점은 그대로입니다. 바뀐 것은 무엇일까요?',choices:['정답 점을 다른 위치로 옮겼다','연결값을 고쳐 골 점수를 높였다','선은 항상 위쪽으로 움직인다'],answer:1,why:'연결값과 더할 값을 고쳤습니다. 이동 방향은 자료와 현재 연결값에 따라 달라집니다.'},
];

/** Same two-pane / four-checkpoint structure as the image lessons, with a small exact XOR example. */
export class PenaltyLesson {
  readonly root:HTMLElement;
  private step=0;private phase=0;private answer:number|null=null;private passed=new Set<number>();
  private timer=0;private prediction:number|null=null;
  private trace=penaltyLearningTrace();
  constructor(private next:()=>void){
    this.root=document.createElement('div');this.root.id='penaltyUnderstanding';this.root.className='image-workspace penalty-understanding';this.root.hidden=true;
    this.root.innerHTML=`<section class="image-panel penalty-lesson-visual"><div class="image-heading"><h2 id="plVisualTitle"></h2></div><p class="penalty-caveat">원리용 네 사례 · 연결값은 계산하기 쉽게 정한 값입니다.</p><div id="plPhoto" class="penalty-photo lesson-goal"><img src="/illustrations/penalty-goalkeeper-photo.png" alt="좌우 위치를 계산할 골대 사진"><span class="penalty-marker ball" style="left:28%;top:44%">공</span><span class="penalty-marker glove" style="left:72%;top:44%">막기</span></div><canvas id="plMap" aria-label="승부차기 예제의 뉴런 기준선과 최종 경계"></canvas><div id="plNetwork" class="penalty-network"></div><p id="plMapNote"></p></section><section class="image-panel image-lesson-copy"><nav class="image-lesson-tabs" aria-label="승부차기 이해 순서">${['좌표 계산','뉴런 계산','출력 계산','선 움직임'].map((s,i)=>`<button data-pl-step="${i}">${i+1} ${s}</button>`).join('')}</nav><h2 id="plTitle"></h2><p id="plText"></p><div id="plCalculation" class="image-calculation" aria-live="polite"></div><div id="plPredict" class="image-quiz"><strong>−1을 곱할 신호가 작아지면 골 점수는?</strong><div class="lesson-choice-grid"><button data-pl-predict="0">커진다</button><button data-pl-predict="1">작아진다</button></div><p id="plPredictionFeedback" role="status"></p></div><div class="lesson-playback"><button id="plReplay">처음부터</button><button id="plAdvance" class="button primary">한 단계씩 보기</button><button id="plPlay">▶ 재생</button></div><section id="plQuiz" class="image-quiz"><strong id="plQuestion"></strong><p id="plQuizFormula"></p><div id="plChoices" class="lesson-choice-grid"></div><p id="plFeedback" role="status"></p></section><button id="plNext" class="button primary"></button><p id="plProgress" class="penalty-caveat"></p></section>`;
    document.querySelector('[data-app-page="3"] .page-nav')!.before(this.root);
    workspacePanels(this.root,[...this.root.children],['예제·그래프','설명·확인'],()=>this.render());
    this.root.addEventListener('click',e=>{const t=e.target as HTMLElement,tab=t.closest<HTMLElement>('[data-pl-step]'),choice=t.closest<HTMLElement>('[data-pl-choice]'),prediction=t.closest<HTMLElement>('[data-pl-predict]');
      if(tab){this.stop();this.step=Number(tab.dataset.plStep);this.phase=0;this.answer=null;this.prediction=null;this.render();}
      if(choice){this.answer=Number(choice.dataset.plChoice);if(this.answer===QUESTIONS[this.step]!.answer)this.passed.add(this.step);else this.passed.delete(this.step);this.render();}
      if(prediction){this.prediction=Number(prediction.dataset.plPredict);this.render();}
    });
    this.el('plAdvance').addEventListener('click',()=>{this.stop();this.advance();});
    this.el('plPlay').addEventListener('click',()=>{if(this.timer){this.stop();this.render();return;}this.play();});
    this.el('plReplay').addEventListener('click',()=>{this.stop();this.phase=0;this.answer=null;this.prediction=null;this.render();});
    this.el('plNext').addEventListener('click',()=>{if(!this.passed.has(this.step))return;this.stop();if(this.step===3){if(this.passed.size===4)this.next();}else{this.step++;this.phase=0;this.answer=null;this.prediction=null;this.render();}});
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector<T>('#'+id)!;}
  reset():void{this.stop();this.step=0;this.phase=0;this.answer=null;this.prediction=null;this.passed.clear();}
  stop():void{window.clearTimeout(this.timer);this.timer=0;}
  show(active:boolean):void{this.root.hidden=!active;if(active)this.render();else this.stop();}
  private limit():number{return this.step===3?20:3;}
  private advance():void{if(this.step===3&&this.prediction!==0)return;this.phase=Math.min(this.phase+1,this.limit());this.render();}
  private play():void{if(this.phase===this.limit()||this.step===3&&this.prediction!==0)return;this.advance();if(this.phase<this.limit())this.timer=window.setTimeout(()=>{this.timer=0;this.play();},this.step===3?110:1000);this.el('plPlay').textContent=this.timer?'Ⅱ 멈춤':'▶ 재생';}
  render():void{
    if(this.root.hidden)return;
    const step=this.step,phase=this.phase,done=phase===this.limit();
    this.root.querySelectorAll<HTMLElement>('[data-pl-step]').forEach((b,i)=>{b.classList.toggle('active',i===step);b.classList.toggle('done',this.passed.has(i));b.setAttribute('aria-pressed',String(i===step));});
    this.el('plTitle').textContent=['사진의 선택을 두 수로 바꿔요','뉴런 하나는 어떻게 계산할까요?','두 신호를 사용하면 무엇이 달라질까요?','틀린 골 한 점으로 연결값을 고쳐요'][step]!;
    this.el('plText').textContent=[
      '골대 왼쪽 끝 0, 가운데 0.5, 오른쪽 끝 1로 위치를 읽어요. 가운데를 0으로 옮긴 다음 두 배 하면 −1~1 좌표가 됩니다.',
      '두 입력에 1을 곱하고 −0.25를 더하도록 정한 예제입니다. 합이 양수면 그대로, 음수면 0을 보냅니다.',
      '뉴런 2는 두 입력에 −1을 곱합니다. 출력은 0.5에서 두 신호를 뺍니다. 이 예제의 값들은 학습 결과가 아닙니다.',
      '이번엔 잘못 예상한 다른 시작 상태입니다. 더할 값이 0.5·0.5인 두 뉴런을 실제 학습합니다. 관찰하는 것은 보라선 하나입니다.',
    ][step]!;
    this.el('plVisualTitle').textContent=step===0?'공의 좌우 → 가로, 골키퍼의 좌우 → 세로':step===1?'뉴런 1개: 한 경우를 여전히 놓쳐요':step===2?'뉴런 2개: 예제 네 경우를 구분해요':'보라: 뉴런 1 · 회색 점선: 처음 위치';
    this.el('plPhoto').hidden=step!==0||phase>0;
    this.el('plMap').hidden=step===0&&phase===0;
    const model=step===3?this.trace[phase]!:penaltyTeachingModel(step===1?1:2),focus=step===3||step===0?[-.5,.5]:[.5,.5],r=forward(model,focus[0]!,focus[1]!);
    const m=penaltyPixelModel(model);
    drawPixelLatentMap(this.el('plMap'),m,PENALTY_CASES,focus,PENALTY_PROJECTION,{view:step===0?'placement':'decision',classColors:[PALETTE.zero,PALETTE.one],classLabels:['막힘','골'],axisLegend:PENALTY_AXES,showDataLabels:true,onlyNeuron:step===3?0:undefined,showNeuronBoundaries:step>0&&phase>0,showDecisionBoundary:step>0&&phase>=2,neutralBackground:step>0&&phase<2,previousNeuronModel:step===3?penaltyPixelModel(this.trace[0]!):undefined,focusLabel:step===0||step===3?'정답 골':'정답 막힘'});
    let html='';
    if(step===0)html=[
      '<b>공: 왼쪽 끝에서 0.25 · 골키퍼: 0.75</b><span>세로의 높이가 아니라, 두 사람이 고른 좌우 위치 두 개를 사용합니다.</span>',
      '<b>가로: (0.25 − 0.5) × 2</b><span>가운데 0.5를 빼면 −0.25. 두 배 하면 −0.5입니다.</span>',
      '<b>세로: (0.75 − 0.5) × 2 = 0.5</b><span>골키퍼가 오른쪽으로 향했으므로 지도에서는 위쪽입니다.</span>',
      '<b>좌표 (−0.5, 0.5) · 정답 골</b><span>높이 정보는 사용하지 않습니다. 이제 가로 한 가지만 바꿔 계산해 보세요.</span>',
    ][phase]!;
    if(step===1)html=[
      '<b>입력: 가로 0.5, 세로 0.5</b><span>각 입력에 연결값 1을 곱하면 원래 값 그대로입니다.</span>',
      '<b>0.5 × 1 + 0.5 × 1 = 1</b><span>마지막에 −0.25를 더할 차례입니다.</span>',
      '<b>합: 1 − 0.25 = 0.75 → 신호 0.75</b><span>보라선은 합이 0인 자리입니다. 선 자체가 뉴런이나 정답은 아닙니다.</span>',
      '<b>신호 0.75 · 골 점수 0.5 − 0.75 = −0.25</b><span>이 점은 막힘으로 맞혔지만 왼쪽·왼쪽을 틀립니다. 선 하나로 네 경우를 나눌 수 없어요.</span>',
    ][phase]!;
    if(step===2)html=[
      '<b>뉴런 1 신호 = 0.75</b><span>같은 입력 (0.5, 0.5)을 뉴런 2에도 보냅니다.</span>',
      '<b>뉴런 2: 0.5 × (−1) + 0.5 × (−1) − 0.25 = −1.25</b><span>합이 음수이므로 보내는 신호는 0입니다.</span>',
      '<b>골 점수: 0.5 − 0.75 − 0 = −0.25</b><span>점수 0이 비교 기준: 양수면 골, 음수면 막힘, 0이면 동점입니다. 검은 경계는 그 점수가 0인 곳입니다.</span>',
      '<b>두 클래스라서 골 확률 하나만 계산해도 됩니다.</b><span>막힘 확률 = 100% − 골 확률. 숫자·OMR처럼 여러 클래스인 모델은 각 클래스의 출력을 따로 계산합니다.</span><span>이 두 뉴런은 예제 네 점을 맞혔습니다. 더 다양한 자료도 맞히는지는 연습에서 확인합니다.</span>',
    ][phase]!;
    if(step===3){const before=forward(this.trace[0]!,-.5,.5);html=phase===0?'<b>처음 골 점수 = 0.2 − 0.5 − 0.5 = −0.8</b><span>정답은 골인데, 점수가 음수라 막힘으로 틀립니다. 다른 값은 그대로 두고 신호 하나가 작아지면 −1을 곱한 결과는 어떻게 될까요?</span>':`<b>${phase}번 학습 · 골 점수 ${n(before.logit)} → ${n(r.logit)}</b><span>뉴런 1 신호: ${n(before.hidden[0]!)} → ${n(r.hidden[0]!)}</span><span>현재 계산: ${n(model.parameters.outputBias)} + (${n(r.hidden[0]!)} × ${n(model.parameters.hiddenOutput[0]!)}) + (${n(r.hidden[1]!)} × ${n(model.parameters.hiddenOutput[1]!)}) ≈ ${n(r.logit)}</span><span>대표선만 표시했지만 두 뉴런의 연결값과 출력값을 함께 고쳤습니다.</span>`;}
    this.el('plCalculation').innerHTML=step<3?html.replaceAll('<b>','<b class="calculation-pop">'):html;
    const net=this.el('plNetwork');net.hidden=step===0;
    net.innerHTML=`<div class="penalty-inputs">공 ${focus[0]}<br>골키퍼 ${focus[1]}</div><span aria-hidden="true">→</span><div class="penalty-signals">${r.hidden.map((v,i)=>`<div style="--neuron-color:${i?'#df466f':'#7446f5'}">뉴런 ${i+1}<b>${n(v)}</b></div>`).join('')}</div><span aria-hidden="true">→</span><div class="penalty-output"><span>막힘 비교 기준 <b>0</b></span><span>골 점수 <b>${n(r.logit)}</b></span><strong>예상 ${Math.abs(r.logit)<1e-9?'동점':r.logit>0?'골':'막힘'}</strong></div>`;
    this.el('plMapNote').textContent=step===0?'사진의 높이가 아니라 두 좌우 선택을 펼친 지도입니다.':step===3?'화살표는 뉴런 값이 커지는 쪽입니다. 실제 이동은 회색 선과 보라선을 비교하세요.':'점의 색은 정답, 배경은 모델 예상입니다. 은닉 기준선과 최종 경계는 다릅니다.';
    this.el('plPredict').hidden=step!==3||phase>0;
    this.root.querySelectorAll<HTMLElement>('[data-pl-predict]').forEach((b,i)=>{b.classList.toggle('correct',this.prediction===i&&i===0);b.classList.toggle('wrong',this.prediction===i&&i!==0);});
    this.el('plPredictionFeedback').textContent=this.prediction===null?'':this.prediction===0?'맞아요. 예: −0.5보다 −0.4가 큽니다. 이제 실제 학습을 확인하세요.':'오답입니다. 음수 −0.5와 −0.4를 비교해 보세요.';
    this.el('plQuiz').hidden=!done;const q=QUESTIONS[step]!;this.el('plQuestion').textContent=q.text;this.el('plQuizFormula').textContent=q.formula;
    this.el('plChoices').innerHTML=q.choices.map((s,i)=>`<button data-pl-choice="${i}" aria-pressed="${this.answer===i}" class="${this.answer===i?(i===q.answer?'correct':'wrong'):''}">${s}</button>`).join('');
    this.el('plFeedback').textContent=this.answer===null?'':this.answer===q.answer?`맞아요. ${q.why}`:'오답입니다. 위 계산을 다시 확인해 보세요.';
    this.el('plFeedback').className=this.answer===null?'':this.answer===q.answer?'correct':'wrong';
    this.el<HTMLButtonElement>('plAdvance').disabled=done||step===3&&this.prediction!==0;this.el<HTMLButtonElement>('plPlay').disabled=done||step===3&&this.prediction!==0;
    this.el('plAdvance').textContent=done?'계산 확인 완료':step===3?'한 번 학습하기':`다음 계산 (${phase}/3)`;
    this.el('plPlay').textContent=this.timer?'Ⅱ 멈춤':'▶ 재생';
    this.el('plNext').textContent=step===3?'직접 학습하기 →':'다음 내용 →';this.el<HTMLButtonElement>('plNext').disabled=!this.passed.has(step)||step===3&&this.passed.size<4;
    this.el('plProgress').textContent=`확인 ${this.passed.size}/4${step===3&&this.passed.size<4?' · 위 목차에서 남은 계산 문제를 풀어 주세요.':''}`;
    this.el('plText').hidden=done||step===3;
  }
}
