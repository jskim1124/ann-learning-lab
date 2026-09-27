import { JOURNEY_ROWS, journeyPoint, journeyModel, journeyPrediction, journeyScore, decimal as n } from '../core/understandingJourney';
import { LESSON_CHAPTERS, CHAPTER_STARTS, lessonChapter, lessonMovement } from '../core/lessonMovement';
import { forwardPixels } from '../core/pixelNetwork';
import { renderJourneyPlot } from './journeyPlot';
import './understandingJourney.css';

interface JourneyOptions { context:()=>string; complete:()=>void; }
const titles=['그림도 숫자로 읽을 수 있어요','윗줄을 숫자 하나로 줄여 볼까요?','아랫줄도 같은 방법으로','두 숫자가 그림의 자리가 돼요','어떤 숫자를 골라야 구별될까요?','뉴런은 작은 계산기예요','숫자를 바꾸면 선은 어디로 갈까요?','뉴런의 숫자로 답을 골라요','반대쪽도 보는 뉴런을 연결해요','내가 만든 계산 길을 따라가요'];
const hints=['검정은 1.00, 흰색은 0.00. 회색은 그 사이예요.','두 칸을 더한 뒤, 칸 수인 2로 나누면 평균이에요.','같은 그림의 아랫줄을 계산해 보세요.','가로는 윗줄 평균, 세로는 아랫줄 평균이에요.','정답 A는 두 줄이 같고, B는 달라요. 이 7장을 나눠 봅시다.','이 예제는 윗줄에서 아랫줄을 빼요. 음수는 0.00으로 보내요.','이번에는 마지막에 0.50을 더 빼고 시작해요. 계산이 0.00인 선을 세로 0.25에서 찾아봐요.','비교를 위해 빼는 값을 0.00으로 되돌렸어요. A는 비교용으로 정한 점수 0.25, B는 뉴런이 보낸 숫자예요.','첫 뉴런은 윗줄이 진할 때만 반응했어요. 둘째는 반대 차이를 계산해요.','점을 눌러 같은 계산이 다른 그림에서도 어떻게 작동하는지 보세요.'];
const summaries=['색의 진하기를 숫자로 바꾸었어요.','윗줄 평균 0.75를 찾았어요. 이것이 첫 번째 특징이에요.','아랫줄 평균은 0.25. 이제 그림 한 장에 숫자가 두 개 생겼어요.','그림은 그대로인데, 두 특징이 그래프 위의 자리를 정해 줘요.','전체 평균에서 사라진 차이가 두 줄을 따로 보니 드러났어요.','뉴런은 선 자체가 아니라 계산기예요. 선은 음수를 0으로 바꾸기 전, 계산이 0.00인 자리예요.','이번 계산에서는 빼는 값이 작아지면 왼쪽 위, 커지면 오른쪽 아래로 갔어요. 실제 학습은 다른 수도 바꾸므로 선이 회전할 수도 있어요.','검은 선은 A와 B 점수가 같아지는 자리예요. 보라 선과는 역할이 달라요.','새 뉴런을 연결하니 반대쪽 B도 찾았어요. 연결하지 않으면 답은 그대로예요.','출력은 답의 종류마다 하나예요. 이 7장은 맞혔지만 새 그림도 확인해야 해요. 연습에서는 컴퓨터가 정답과 예상을 비교해 계산에 쓰는 수를 고칩니다.'];

/** A shared sequence of short predict → act → observe scenes for all guided tasks. */
export class UnderstandingJourney {
  readonly root:HTMLElement;
  private scene=0;private reached=0;private done=new Set<number>();
  private ink=.5;private touched=false;private frame=0;private played=false;private separated=0;
  private threshold=.5;private target=.25;private oldThreshold:number|null=null;
  private movePhase:'number'|'direction'|'result'='number';private directions=new Set<string>();private predicted=false;
  private connection=0;private selected=0;private wrong:number|null=null;private message='';
  private timer=0;private busy=false;private animationCancel:(()=>void)|null=null;
  private cursor:[number,number]=[0,0];
  constructor(root:HTMLElement,private options:JourneyOptions) {
    this.root=root;root.className='image-workspace understanding-journey';
    root.innerHTML=`<nav class="journey-nav" aria-label="이해 순서">${LESSON_CHAPTERS.map((name,i)=>`<button data-journey-step="${i}"><span>${i+1}</span> ${name}</button>`).join('')}</nav>
      <div class="journey-body"><section class="journey-visual"><header><strong class="journey-visual-title"></strong><span class="journey-counter"></span></header><div class="journey-stage"></div><div class="journey-network"></div><div class="journey-legend"></div></section>
      <section class="journey-action"><div class="journey-scene-count"></div><h2></h2><p class="journey-hint"></p><div class="journey-controls"></div><div class="journey-question"></div><div class="journey-feedback" role="status" aria-live="polite"></div><footer><button data-journey-back>← 이전</button><button class="button primary" data-journey-next>다음 →</button></footer><details class="journey-context"><summary>내 문제와 어떻게 이어지나요?</summary><p></p></details></section></div>`;
    root.addEventListener('click',event=>this.click(event));
    root.addEventListener('input',event=>{const input=event.target as HTMLInputElement;if(input.matches('[data-journey-ink]')){this.ink=Number(input.value);this.touched=true;this.renderVisual();this.renderQuestion();}});
    this.el('.journey-stage').addEventListener('pointerdown',event=>{
      if(this.scene!==3||this.done.has(3)||this.busy)return;
      const svg=this.root.querySelector('svg');if(!svg)return;const r=svg.getBoundingClientRect();
      this.cursor=[Math.max(0,Math.min(1,(event.clientX-r.left-48)/(r.width-72))),Math.max(0,Math.min(1,(r.height-42-(event.clientY-r.top))/(r.height-66)))];this.locate();
    });
    root.addEventListener('keydown',event=>{
      const point=(event.target as Element).closest<HTMLElement>('[data-journey-point]');
      if(point&&(event.key==='Enter'||event.key===' ')){event.preventDefault();this.selected=Number(point.dataset.journeyPoint);this.renderVisual();return;}
      if(this.scene!==3||!(event.target as Element).closest('.journey-stage'))return;
      const moves:Record<string,[number,number]>={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,.25],ArrowDown:[0,-.25]};
      if(moves[event.key]){event.preventDefault();this.cursor=this.cursor.map((v,i)=>Math.max(0,Math.min(1,v+moves[event.key]![i]!))) as [number,number];this.locate();}
    });
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!root.hidden)this.renderVisual();}).observe(this.el('.journey-stage'));
    this.render();
  }
  private el<T extends HTMLElement=HTMLElement>(s:string):T{return this.root.querySelector<T>(s)!;}
  stop():void {window.clearInterval(this.timer);this.timer=0;this.busy=false;this.animationCancel?.();this.animationCancel=null;}
  reset():void {this.stop();this.scene=0;this.reached=0;this.done.clear();this.prepare();}
  show(visible:boolean):void {this.root.hidden=!visible;if(visible)this.render();else this.stop();}
  private prepare():void {
    this.frame=this.done.has(this.scene)?3:0;this.played=this.done.has(this.scene);this.wrong=null;this.message='';this.selected=0;
    if(this.scene===0){this.ink=.5;this.touched=false;}
    if(this.scene===3)this.cursor=this.done.has(3)?[.75,.25]:[0,0];
    if(this.scene===4)this.separated=this.done.has(4)?1:0;
    if(this.scene===6){this.threshold=.5;this.target=.25;this.oldThreshold=null;this.movePhase='number';this.predicted=false;this.directions.clear();this.done.delete(6);}
    if(this.scene>=7)this.threshold=0;
    if(this.scene===8){this.connection=this.done.has(8)?1:0;this.selected=1;}
    if(this.scene===9)this.connection=1;
  }
  private navigate(scene:number):void {this.stop();this.scene=scene;this.reached=Math.max(this.reached,scene);this.prepare();this.render();}
  private animate(duration:number,update:(t:number)=>void,end:()=>void,cancel:()=>void=()=>{}):void {
    this.stop();this.busy=true;this.animationCancel=cancel;this.renderQuestion();
    let elapsed=0;const finish=()=>{window.clearInterval(this.timer);this.timer=0;this.busy=false;this.animationCancel=null;update(1);end();this.render();};
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
    this.timer=window.setInterval(()=>{elapsed+=40;const t=Math.min(1,elapsed/duration),oldFrame=this.frame;update(t*t*(3-2*t));if(![1,2,5,7].includes(this.scene)||oldFrame!==this.frame)this.renderVisual();if(t===1)finish();},40);
  }
  private play():void {this.played=false;this.frame=0;this.animate(1800,t=>this.frame=Math.min(3,Math.floor(t*4)),()=>this.played=true);}
  private locate():void {
    const hit=Math.abs(this.cursor[0]-.75)<.06&&Math.abs(this.cursor[1]-.25)<.06;
    if(hit){this.cursor=[.75,.25];this.done.add(3);this.message='';}else this.message=`지금 (${n(this.cursor[0])}, ${n(this.cursor[1])}) · 가로 0.75, 세로 0.25를 찾아요.`;
    this.renderVisual();this.renderQuestion();
  }
  private click(event:MouseEvent):void {
    const button=(event.target as Element).closest<HTMLButtonElement>('button,[data-journey-point]');if(!button||button.disabled||this.busy)return;
    const d=button.dataset;
    if(d.journeyStep!==undefined){const start=CHAPTER_STARTS[Number(d.journeyStep)]!;if(start<=this.reached)this.navigate(start);return;}
    if(d.journeyBack!==undefined){if(this.scene)this.navigate(this.scene-1);return;}
    if(d.journeyNext!==undefined){if(!this.done.has(this.scene))return;if(this.scene===9)this.options.complete();else this.navigate(this.scene+1);return;}
    if(d.journeyPlay!==undefined){this.play();return;}
    if(d.journeyPoint!==undefined&&this.scene===9){this.selected=Number(d.journeyPoint);this.renderVisual();return;}
    if(d.journeyFeature!==undefined){const target=Number(d.journeyFeature),start=this.separated;this.animate(1000,t=>this.separated=start+(target-start)*t,()=>{this.played=true;});return;}
    if(d.journeyThreshold!==undefined){this.target=Number(d.journeyThreshold);this.done.delete(6);this.movePhase='number';this.predicted=false;this.wrong=null;this.message='';this.render();return;}
    if(d.journeyRun!==undefined&&this.predicted){
      const from=this.threshold,to=this.target;this.oldThreshold=from;
      this.animate(1800,t=>this.threshold=from+(to-from)*t,()=>{this.directions.add(lessonMovement(from,to).direction);this.movePhase='result';if(this.directions.size>=2)this.done.add(6);},()=>{this.threshold=from;this.movePhase='direction';});return;
    }
    if(d.journeyAnswer!==undefined){
      const q=this.question(),answer=Number(d.journeyAnswer);if(!q.ready)return;
      if(answer!==q.correct){this.wrong=answer;this.message='오답이에요. 표시된 계산과 위치를 다시 확인해 보세요.';this.renderQuestion();return;}
      this.wrong=null;this.message='';
      if(this.scene===6){if(this.movePhase==='number')this.movePhase='direction';else {this.message='예상했어요. 이제 선을 움직여 확인하세요.';this.predicted=true;}this.render();return;}
      if(this.scene===8&&!this.played){this.animate(1800,t=>this.connection=t,()=>{this.played=true;this.done.add(8);},()=>this.connection=0);return;}
      this.done.add(this.scene);this.render();
    }
  }
  private question():{title:string;choices:string[];correct:number;ready:boolean} {
    const movement=lessonMovement(this.threshold,this.target);
    return [
      {title:'완전히 검은 칸은 어떤 숫자일까요?',choices:['0.00','0.50','1.00'],correct:2,ready:this.touched},
      {title:'1.50을 두 칸에 똑같이 나누면?',choices:['0.50','0.75','1.50'],correct:1,ready:this.played},
      {title:'0.50 ÷ 2 = 아랫줄 평균은?',choices:['0.00','0.25','0.50'],correct:1,ready:this.played},
      {title:'그래프에 직접 자리를 찍어 보세요.',choices:[],correct:0,ready:false},
      {title:'전체 평균이 같던 A와 B를 구별하려면?',choices:['전체 평균만 보기','윗줄과 아랫줄을 따로 보기'],correct:1,ready:this.played&&this.separated===1},
      {title:'0.75 − 0.25. 뉴런이 보낼 숫자는?',choices:['0.00','0.50','1.00'],correct:1,ready:this.played},
      this.movePhase==='number'?{title:`새 선의 가로 자리: 세로 0.25 + 빼는 값 ${n(this.target)} = ?`,choices:['0.25','0.50','0.75'],correct:Math.round((movement.afterX-.25)/.25),ready:this.threshold!==this.target}:this.movePhase==='direction'?{title:`가로 ${n(movement.beforeX)} → ${n(movement.afterX)}. 선은 어디로 이동할까요?`,choices:['↖ 왼쪽 위','↘ 오른쪽 아래'],correct:movement.direction==='left-up'?0:1,ready:true}:{title:'이번에는 반대 방향도 예상해 보세요.',choices:[],correct:0,ready:false},
      {title:'A는 0.25, B는 0.50. 더 큰 점수의 답은?',choices:['A · 두 줄이 같음','B · 두 줄이 다름'],correct:1,ready:this.played},
      {title:'둘째 뉴런의 0.50을 1.00배 해서 B에 더하면? (첫째는 0.00)',choices:['B 점수 0.00','B 점수 0.50','B 점수 1.00'],correct:1,ready:true},
      {title:'은닉 뉴런을 더 늘려도 답이 A·B라면 출력은?',choices:['2개 — 답의 종류만큼','은닉 뉴런 수만큼'],correct:0,ready:true},
    ][this.scene]!;
  }
  render():void {
    const chapter=lessonChapter(this.scene);this.root.dataset.scene=String(this.scene);
    this.root.querySelectorAll<HTMLButtonElement>('[data-journey-step]').forEach((b,i)=>{b.disabled=CHAPTER_STARTS[i]!>this.reached;b.setAttribute('aria-pressed',String(i===chapter));});
    this.el('.journey-scene-count').textContent=`${LESSON_CHAPTERS[chapter]} · ${this.scene-CHAPTER_STARTS[chapter]!+1} / ${(CHAPTER_STARTS[chapter+1]??10)-CHAPTER_STARTS[chapter]!}`;
    this.el('h2').textContent=titles[this.scene]!;this.el('.journey-hint').textContent=hints[this.scene]!;
    this.el('.journey-context p').textContent=`${this.options.context()}. 원리는 모든 문제에서 같습니다. 여기서는 실제 자료와 별개인 작은 2×2 그림 7장으로 계산을 익힙니다.`;
    this.el('.journey-controls').innerHTML=this.scene===0?`<label>칸의 진하기를 바꿔 보세요<input data-journey-ink aria-label="칸의 진하기" type="range" min="0" max="1" step=".5" value="${this.ink}"></label>`:
      [1,2,5,7].includes(this.scene)?'<button class="journey-play" data-journey-play>▶ 계산 따라 보기</button>':
      this.scene===4?`<div class="journey-segmented"><button data-journey-feature="0" aria-pressed="${this.separated===0}">전체 평균</button><button data-journey-feature="1" aria-pressed="${this.separated===1}">두 줄 따로</button></div>`:
      this.scene===6?`<label>① 빼는 값을 골라요</label><div class="journey-segmented">${[0,.25,.5].map(v=>`<button data-journey-threshold="${v}" aria-pressed="${v===this.target}" ${v===this.threshold?'disabled':''}>${n(v)}</button>`).join('')}</div><div class="journey-move-order"><span class="${this.movePhase==='number'?'active':''}">② 새 자리 계산</span><span class="${this.movePhase==='direction'?'active':''}">③ 방향 예상</span><span class="${this.movePhase==='result'?'active':''}">④ 확인</span></div>${this.movePhase==='direction'&&this.predicted?'<button class="journey-play" data-journey-run>▶ 예상한 이동 확인</button>':''}`:'';
    if(this.scene===6&&this.predicted&&this.movePhase==='direction')this.el('.journey-controls').innerHTML=`<div>빼는 값 <b>${n(this.threshold)} → ${n(this.target)}</b></div><button class="journey-play" data-journey-run>▶ 예상한 이동 확인</button>`;
    this.el('.journey-stage').tabIndex=this.scene===3?0:-1;
    this.renderVisual();this.renderQuestion();
  }
  private renderQuestion():void {
    const q=this.question(),complete=this.done.has(this.scene);
    this.el('.journey-question').innerHTML=complete?`<div class="journey-summary"><strong>✓ 확인했어요</strong><p>${summaries[this.scene]}</p></div>`:this.scene===6&&this.predicted&&this.movePhase==='direction'?`<div class="journey-prediction">예상: ${this.target<this.threshold?'↖ 왼쪽 위':'↘ 오른쪽 아래'}<small>재생해서 숫자와 선을 함께 확인하세요.</small></div>`:`<strong>${q.title}</strong><div class="journey-choices">${q.choices.map((choice,i)=>`<button data-journey-answer="${i}" class="${i===this.wrong?'is-wrong':''}" ${!q.ready||this.busy?'disabled':''}>${choice}</button>`).join('')}</div>`;
    this.el('.journey-feedback').textContent=this.busy?'계산과 그림이 함께 바뀌는 중이에요…':this.message||(!q.ready&&!complete?this.scene===0?'슬라이더로 색을 먼저 바꿔 보세요.':[1,2,5,7].includes(this.scene)?'재생한 뒤 직접 계산해 보세요.':this.scene===4?'두 줄 따로 보기를 눌러 위치를 비교하세요.':'':'');
    const next=this.el<HTMLButtonElement>('[data-journey-next]');next.disabled=!complete||this.busy;next.textContent=this.scene===9?'내 문제에서 학습하기 →':'다음 장면 →';this.el<HTMLButtonElement>('[data-journey-back]').disabled=this.scene===0||this.busy;
    this.root.querySelectorAll<HTMLButtonElement>('.journey-controls button').forEach(b=>{if(this.busy)b.disabled=true;});
  }
  private picture(cells:number[],activeRow=-1):string {
    return `<div class="journey-pixels">${cells.map((v,i)=>`<span class="${Math.floor(i/2)===activeRow&&this.frame>=i%2?'lit':''}" style="--ink:${v};color:${v>.55?'white':'#202633'}">${n(v)}</span>`).join('')}</div>`;
  }
  private get model(){return journeyModel(this.scene===6?-this.threshold:0,this.scene>=8,this.connection);}
  private renderVisual():void {
    const stage=this.el('.journey-stage'),cells=JOURNEY_ROWS[0]!.cells;
    this.el('.journey-visual-title').textContent=this.scene<3?'그림 → 숫자':this.scene<5?'숫자 → 자리':this.scene<7?'계산 → 선':'뉴런 → 답';
    this.el('.journey-counter').textContent=this.scene>=7?`${journeyScore(this.model)} / 7장 맞힘`:'작은 그림으로 실험';
    if(this.scene===0)stage.innerHTML=`<div class="journey-ink-demo"><div class="journey-ink" style="--ink:${this.ink}"></div><span class="journey-flow-arrow">→</span><output>${n(this.ink)}</output></div><div class="journey-ink-key"><span>흰색 0.00</span><span>회색 0.50</span><span>검정 1.00</span></div>`;
    else if(this.scene<3){const top=this.scene===1,values=top?[1,.5]:[0,.5];stage.innerHTML=`<div class="journey-calc-picture">${this.picture(cells,top?0:1)}<span>${top?'윗줄':'아랫줄'} 두 칸</span></div><div class="journey-calculation"><div class="${this.frame>=1?'lit':''}"><b>${n(values[0]!)}</b><span>+</span><b>${n(values[1]!)}</b></div><span class="journey-down ${this.frame>=2?'lit':''}">↓ 더하면</span><div class="${this.frame>=2?'lit':''}"><b>${top?'1.50':'0.50'}</b><span>÷ 2</span></div><span class="journey-down ${this.frame>=3?'lit':''}">↓ 두 칸에 나누면</span><output>${this.done.has(this.scene)?top?'0.75':'0.25':'?'}</output></div>`;}
    else stage.innerHTML=renderJourneyPlot({width:stage.clientWidth||560,height:stage.clientHeight||400,scene:this.scene,separated:this.separated,cursor:this.cursor,located:this.done.has(3),threshold:this.threshold,oldThreshold:this.oldThreshold,selected:this.selected,model:this.model,frame:this.frame,solved:this.done.has(this.scene)});
    const network=this.el('.journey-network');network.hidden=this.scene<6;
    const point=journeyPoint(JOURNEY_ROWS[this.selected]!.cells),result=forwardPixels(this.model,point),prediction=journeyPrediction(this.model,point);
    if(this.scene>=6){const first=this.scene===6?`0.75 − 0.25 − ${n(this.threshold)}`:`${n(point[0])} − ${n(point[1])}`;
      network.innerHTML=`<div class="journey-route"><div><small>가로 · 세로</small><b>${n(point[0])} · ${n(point[1])}</b></div><span>→</span><div class="journey-neurons"><div class="journey-neuron"><small>은닉 뉴런 1</small><span>${first}</span><b>${n(result.hidden[0]!)}</b></div>${this.scene>=8?`<div class="journey-neuron second"><small>은닉 뉴런 2</small><span>${n(point[1])} − ${n(point[0])}</span><b>${n(result.hidden[1]!)}</b></div>`:''}</div>${this.scene>=7?`<span>→</span><div class="journey-outputs"><span class="class-a">A <b>0.25</b></span><span class="class-b">B <b>${n(result.logits[1]!)}</b></span></div>`:''}</div><p>${this.scene===5?'가로 × 1.00 + 세로 × (−1.00) = 가로 − 세로. 음수는 0.00으로 바꿔요.':this.scene===6?`현재 선: 가로 − 세로 = ${n(this.threshold)} · 점 (0.75, 0.25)은 그대로예요.`:this.scene===8?`B = ${n(result.hidden[0]!)} + ${n(result.hidden[1]!)} × ${n(this.connection)} · 연결값이 0.00이면 답에 영향을 주지 않아요.`:`예상 ${prediction===null?'동점':prediction===0?'A · 두 줄이 같음':'B · 두 줄이 다름'} · 여기의 숫자는 확률이 아니라 비교 점수예요.`}</p>`;
    }
    this.el('.journey-legend').innerHTML=this.scene===3?'<span>가로 0.75 →</span><span>세로 0.25 ↑</span>':this.scene===4?'<span class="class-a">● 정답 A · 두 줄이 같음</span><span class="class-b">● 정답 B · 두 줄이 다름</span>':this.scene===6?'<span class="neuron-key">━ 보라: 지금의 0.00 선</span><span>┄ 회색: 바꾸기 전</span>':this.scene>=7?'<span>점 색 = 정답 · 바탕색 = 예상</span><span class="neuron-key">┄ 뉴런 계산 전환점</span><span>━ 검정: A 점수 = B 점수</span>':'';
  }
}
