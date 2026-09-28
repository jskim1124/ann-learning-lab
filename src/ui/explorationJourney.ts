import { ManualLab, copyModel, manualPrediction, manualScore, type ManualParameter } from '../core/manualLab';
import { evaluatePixelModel, forwardPixels, trainPixelModel, type PixelModel } from '../core/pixelNetwork';
import { learningDirection, parameterValue, withParameter, zeroPoint, type InputParameter } from '../core/explorationLearning';
import type { ExplorationSource } from '../core/explorationSource';
import { drawPixelLatentMap, pixelMapExampleAt } from '../visualization/pixelLatentMap';
import { NEURON_COLORS } from '../visualization/neuronColors';
import { explorationNetwork, explorationOutputNetwork } from './explorationNetwork';

interface JourneyOptions {
  source:()=>ExplorationSource; context:()=>string; complete:()=>void; back?:()=>void;
  setAxes?:(x:string,y:string)=>string|null; featureEditor?:(host:HTMLElement)=>void;
}
const CHAPTERS=['자료 비교','뉴런 직접 조절','오차 줄이기','뉴런 늘리기'];
const IDENTITY={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const COLORS=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
const n=(value:number)=>Math.abs(value)<.005?'0.00':value.toFixed(2);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const color=(i:number)=>COLORS[i%COLORS.length]!;
const neuronColor=(i:number)=>NEURON_COLORS[i%NEURON_COLORS.length]!;
const PARAMS:Record<InputParameter,string>={xWeight:'가로에 곱할 수',yWeight:'세로에 곱할 수',bias:'마지막에 더할 수'};

/** One actual dataset and one editable network across the four exploratory scenes. */
export class UnderstandingJourney {
  readonly root:HTMLElement;
  private chapter=0;private source!:ExplorationSource;private lab!:ManualLab;private signature='';
  private axis:0|1=0;private oneAxis=false;private timer=0;private phase=-1;
  private inputKey='';private featureFrame=-1;private compare=1;private popup=false;private status='';private introduction='';
  private parameter:InputParameter='bias';private onLine=false;private chosePoint=false;
  private trial:PixelModel|null=null;private guess:-1|1|null=null;private tried=false;
  constructor(root:HTMLElement,private options:JourneyOptions) {
    this.root=root;root.className='image-workspace understanding-journey exploration-journey';
    root.innerHTML=`<nav class="explore-nav" aria-label="이해 순서">${CHAPTERS.map((s,i)=>`<button data-explore-chapter="${i}"><span>${i+1}</span> ${s}</button>`).join('')}</nav>
      <div class="explore-body"><section class="explore-visual"><header><strong data-map-title></strong><span data-map-count></span></header>
      <div class="explore-map"><canvas aria-label="실제 자료의 분포와 뉴런 기준선"></canvas><div class="explore-point" role="region" aria-label="고른 점의 정답과 예상" hidden></div><span class="explore-zero" hidden>합 0</span></div>
      <div class="explore-network" aria-label="입력에서 은닉 뉴런과 출력으로 이어지는 연결 지도"></div><div class="explore-key"></div></section>
      <section class="explore-action"><div class="explore-content"><h2></h2><p class="explore-instruction"></p><div class="explore-controls"></div><div class="explore-feature-tools"></div><div class="explore-equation"></div><div class="explore-observation"></div></div>
      <p class="explore-status" role="status" aria-live="polite"></p><footer><button data-explore-back>← 이전</button><button data-explore-next class="button primary">다음 →</button></footer></section></div>`;
    options.featureEditor?.(this.el('.explore-feature-tools'));
    root.addEventListener('click',e=>this.click(e));root.addEventListener('input',e=>this.input(e));root.addEventListener('change',e=>this.change(e));
    root.addEventListener('pointerdown',e=>{if((e.target as Element).matches('[data-knob]'))this.lab.beginGesture();});
    for(const event of ['pointerup','pointercancel','change'])root.addEventListener(event,()=>this.lab?.endGesture());
    this.el<HTMLCanvasElement>('canvas').addEventListener('pointerdown',event=>{
      const index=pixelMapExampleAt(this.el('canvas'),event.clientX,event.clientY,IDENTITY,this.displayData());
      if(index===null)return;this.stop();this.onLine=false;this.chosePoint=true;this.lab.choosePoint(this.source.data[index]!.pixels,index);this.popup=true;this.refresh();
    });
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!root.hidden&&this.lab)this.draw();}).observe(this.el('.explore-map'));
    this.render();
  }
  private el<T extends HTMLElement=HTMLElement>(s:string):T{return this.root.querySelector<T>(s)!;}
  stop():void {window.clearInterval(this.timer);this.timer=0;this.phase=-1;this.featureFrame=-1;}
  reset():void {this.stop();this.chapter=0;this.axis=0;this.oneAxis=false;this.status='';this.signature='';this.inputKey='';this.popup=false;this.onLine=false;this.trial=null;this.guess=null;this.tried=false;}
  private startTrial():void {this.trial=copyModel(this.lab.model);this.guess=null;this.tried=false;}
  show(visible:boolean):void {this.root.hidden=!visible;if(visible)this.render();else this.stop();}
  goTo(chapter:number):void {
    this.stop();this.chapter=Math.max(0,Math.min(3,chapter));this.onLine=false;this.popup=false;this.inputKey='';this.status='';
    // Start with a real row whose error affects the selected neuron, not an inactive zero-output row.
    if(this.chapter===2&&!this.chosePoint&&this.source.data.length){
      let strongest=-1,index=0;this.source.data.forEach((row,i)=>{const g=Math.abs(learningDirection(this.lab.model,[row],this.lab.selected,this.parameter).gradient);const visible=forwardPixels(this.lab.model,row.pixels).hidden[this.lab.selected]!>.1;const priority=g+(visible?1:0);if(priority>strongest){strongest=priority;index=i;}});
      this.lab.choosePoint(this.source.data[index]!.pixels,index);
    }
    if(this.chapter===2)this.startTrial();
    this.render();
  }
  render():void {
    this.source=this.options.source();
    const key=JSON.stringify([this.source.kind,this.source.data,this.source.classes,this.source.axes]);
    if(key!==this.signature){this.stop();this.signature=key;this.lab=new ManualLab('data',this.source);this.startTrial();this.inputKey='';this.popup=false;this.onLine=false;this.chosePoint=false;this.compare=Math.max(0,this.source.data.findIndex(r=>r.label!==this.source.data[0]?.label));}
    this.root.dataset.chapter=String(this.chapter);
    this.root.querySelectorAll<HTMLElement>('[data-explore-chapter]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.exploreChapter)===this.chapter?'step':'false'));
    this.el('[data-explore-back]').textContent=this.chapter?'← 이전':'← 자료 보기';
    this.el<HTMLButtonElement>('[data-explore-back]').disabled=this.chapter===0&&!this.options.back;
    this.el('[data-explore-next]').textContent=this.chapter===3?'내 자료로 연습하기 →':'다음 →';
    this.renderControls();this.refresh();
  }
  private range(id:string,label:string,value:number,min=-2,max=2):string {
    return `<label class="explore-knob">${label}<output data-knob-value="${id}">${n(value)}</output><input type="range" data-knob="${id}" aria-label="${label}" aria-valuetext="${n(value)}" min="${min}" max="${max}" step=".01" value="${n(value)}"></label>`;
  }
  private rows(attribute:string,index:number):string {
    return `<select ${attribute} aria-label="${attribute==='data-row'?'살펴볼 자료':'비교할 자료'}">${this.source.data.map((r,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}번 · ${escape(this.source.classes[r.label]??'?')}</option>`).join('')}</select>`;
  }
  private renderControls():void {
    const s=this.source,m=this.lab.model;
    this.el('h2').textContent=[s.kind==='penalty'?'두 방향을 숫자로 기록해요':'나란히 놓고 특징을 찾아요','어떤 점들을 이으면 선이 될까요?','어느 쪽으로 고쳐야 오차가 줄까요?','뉴런 하나가 더 생기면?'][this.chapter]!;
    this.introduction=[s.kind==='penalty'?'방향 한 개로 충분할까요? 두 방향을 함께 기록해 비교하세요.':'두 그림에 같은 계산을 해 보고, 분포를 비교하세요.','은닉 뉴런은 곱하고 더하는 계산기예요. 수 하나를 바꾸고, 왼쪽 계산과 선을 함께 보세요.','방향을 먼저 예상한 뒤 직접 고쳐 보세요. 정해진 답 대신, 실제 오차로 확인합니다.','뉴런을 추가하고 답에 쓰는 비율을 바꿔 보세요. 새 기준이 최종 경계에 어떻게 보탬이 될까요?'][this.chapter]!;
    this.el('.explore-feature-tools').hidden=this.chapter!==0;
    const key=JSON.stringify([this.chapter,s.axes,s.features?.map(f=>[f.id,f.name]),s.classes,m.hiddenUnits,this.lab.selected,this.lab.output,this.axis,this.parameter]);
    if(this.inputKey===key)return;this.inputKey=key;
    let html='';
    if(this.chapter===0){
      if(s.features)html=`<div class="explore-axes">${['가로 특징','세로 특징'].map((title,i)=>`<label>${title}<select data-feature="${i}" aria-label="${title}">${s.features!.map(f=>`<option value="${escape(f.id)}" ${s.featureIds![i]===f.id?'selected':''}>${escape(f.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
      if(s.kind==='penalty')html+=`<div class="explore-direction">← 왼쪽 <span>가운데 0</span> 오른쪽 →</div>${this.range('kick','키커 방향',this.lab.point[0]!,-1,1)}${this.range('keeper','골키퍼 방향',this.lab.point[1]!,-1,1)}`;
      html+=`<div class="explore-toggle"><button data-dimension="1" aria-pressed="${this.oneAxis}">가로만 보기</button><button data-dimension="2" aria-pressed="${!this.oneAxis}">두 특징 함께</button>${s.features?`<button data-axis="${1-this.axis}">${this.axis===0?'세로':'가로'} 계산 보기</button>`:''}</div><div class="explore-comparisons"><article>${this.rows('data-row',this.lab.pointIndex??0)}<div data-source-example="0"></div></article><article>${this.rows('data-compare',this.compare)}<div data-source-example="1"></div></article></div>`;
    }else{
      html=`<div class="explore-neuron-choice">${Array.from({length:m.hiddenUnits},(_,i)=>`<button data-neuron="${i}" style="--neuron:${neuronColor(i)}" aria-pressed="${this.lab.selected===i}">뉴런 ${i+1}</button>`).join('')}${this.chapter===3?`<button data-add-neuron ${m.hiddenUnits>=4?'disabled':''}>+ 뉴런 추가</button><button data-remove-neuron ${m.hiddenUnits<=1?'disabled':''}>−</button>`:''}</div>`;
      if(this.chapter===1||this.chapter===2)html+=`<label>바꿔 볼 수<select data-parameter aria-label="직접 바꿀 수">${Object.entries(PARAMS).map(([id,label])=>`<option value="${id}" ${id===this.parameter?'selected':''}>${label}</option>`).join('')}</select></label>`;
      if(this.chapter===2)html+=`<fieldset class="explore-prediction"><legend>오차가 줄어들 것 같은 쪽은?</legend><button data-guess="-1">줄여 볼래요</button><button data-guess="1">늘려 볼래요</button></fieldset>`;
      if(this.chapter===1||this.chapter===2)html+=this.range(this.parameter,PARAMS[this.parameter],parameterValue(m,this.lab.selected,this.parameter));
      if(this.chapter===1)html+=`<div class="explore-tools"><button data-zero>선 위의 점 계산</button><button data-play-math>계산 따라 보기</button><button data-undo aria-label="값 변경 되돌리기">↶</button></div>`;
      if(this.chapter===2)html+=`<div class="explore-tools"><button data-learn-one>같은 출발점에서 모델과 비교</button><button data-restart-trial>다시 예상</button></div>`;
      if(this.chapter===3)html+=`<label>어느 답에 쓸까요?<select data-output aria-label="조절할 답">${s.classes.map((c,i)=>`<option value="${i}" ${i===this.lab.output?'selected':''}>${escape(c)}</option>`).join('')}</select></label>`+this.range('connection',`뉴런 ${this.lab.selected+1}의 값에 곱할 수`,m.hiddenOutput[this.lab.output]![this.lab.selected]!)+`<div class="explore-tools"><button data-train>1번 학습</button><button data-train-many>50번 학습</button><button data-undo aria-label="값 변경 되돌리기">↶</button></div>`;
    }
    this.el('.explore-controls').innerHTML=html;
  }
  private displayData(){return this.source.data.map(r=>({...r,pixels:this.chapter===0&&this.oneAxis?[r.pixels[0]!,0]:r.pixels}));}
  private position(el:HTMLElement,point:number[],popup=false):void {
    const map=this.el('.explore-map'),w=map.clientWidth||700,h=map.clientHeight||350;
    const x=50+(point[0]!+1)/2*(w-64),y=13+(1-point[1]!)/2*(h-52);
    el.style.left=`${popup?Math.max(0,Math.min(w-(el.offsetWidth||240),x-60)):x}px`;
    el.style.top=`${popup?Math.max(0,Math.min(h-(el.offsetHeight||88),y+12)):y}px`;
  }
  private draw():void {
    const point=this.onLine?zeroPoint(this.lab.model,this.lab.selected)??this.lab.point:this.lab.point;
    const displayed=this.chapter===0&&this.oneAxis?[point[0]!,0]:point;
    drawPixelLatentMap(this.el('canvas'),this.lab.model,this.displayData(),displayed,IDENTITY,{
      view:this.chapter===0?'placement':'decision',showNeuronBoundaries:this.chapter>0,onlyNeuron:this.chapter===1?this.lab.selected:undefined,
      showDecisionBoundary:this.chapter>=2,showValueDirection:false,previousNeuronModel:this.chapter===2?this.trial??undefined:this.chapter>0?this.lab.previous:undefined,
      focusLabel:'',neutralTies:true,classLabels:this.source.classes,
      axisLegend:{horizontal:{title:this.source.axes[0],negative:'',positive:''},vertical:{title:this.chapter===0&&this.oneAxis?'세로 특징을 보지 않음':this.source.axes[1],negative:'',positive:''}},resolution:65,
    });
    this.position(this.el('.explore-point'),displayed,true);
    const zero=this.el('.explore-zero');zero.hidden=!this.onLine||!zeroPoint(this.lab.model,this.lab.selected);if(!zero.hidden)this.position(zero,point);
  }
  private refresh():void {
    const s=this.source,l=this.lab,m=l.model,point=this.onLine?zeroPoint(m,l.selected)??l.point:l.point,selected=l.pointIndex;
    this.root.style.setProperty('--active-neuron',neuronColor(l.selected));
    const product=(point[0]??0)*(point[1]??0);
    const label=selected===null?(s.kind==='penalty'?(product===0?null:product<0?1:0):null):s.data[selected]?.label??null;
    const answer=manualPrediction(m,point);
    this.el('[data-map-title]').textContent=this.chapter===0?'고른 특징으로 본 자료 분포':this.chapter===1?'색 선 위에서는 합이 0':'색 선 = 뉴런의 기준 · 검은 선 = 최종 경계';
    this.el('[data-map-count]').textContent=`${s.data.length}개 자료`;
    const popup=this.el('.explore-point');popup.hidden=!this.popup||this.onLine;
    popup.innerHTML=`<button data-close-point aria-label="점 정보 닫기">×</button>${s.pictures&&selected!==null?this.picture(s.pictures[selected]!):''}<div><span>(${n(point[0]!)}, ${n(point[1]!)})</span><strong>정답 <b style="color:${label===null?'inherit':color(label)}">${label===null?'가운데 방향은 판정하지 않아요':escape(s.classes[label]??'?')}</b>${this.chapter>0?` · 예상 <b style="color:${answer===null?'inherit':color(answer)}">${answer===null?'동점':`${escape(s.classes[answer]??'?')} ${n(forwardPixels(m,point).probabilities[answer]!*100)}%`}</b>`:''}</strong></div>`;
    this.el('.explore-network').hidden=this.chapter===0;
    if(this.chapter>0)this.el('.explore-network').innerHTML=this.chapter===3?explorationOutputNetwork(m,point,l.selected,l.output,s.classes[l.output]!):explorationNetwork(m,point,l.selected);
    this.el('.explore-key').innerHTML=this.chapter===0?'점의 위치 = 두 특징값 · 점을 눌러 자료 확인':this.chapter===1?'색이 진할수록 뉴런이 보내는 값이 큽니다. 정답 클래스의 색은 아니에요.':`점 색 = 정답 · 바탕색 = 예상 · 회색 점선 = ${this.chapter===2?'실험 출발점':'고치기 전'}`;
    this.renderEquation(point);
    for(const input of this.root.querySelectorAll<HTMLInputElement>('[data-knob]')){
      const id=input.dataset.knob!,v=id==='kick'?l.point[0]!:id==='keeper'?l.point[1]!:id==='connection'?m.hiddenOutput[l.output]![l.selected]!:parameterValue(m,l.selected,id as InputParameter);
      if(id!=='kick'&&id!=='keeper'){input.min=String(-l.parameterLimit);input.max=String(l.parameterLimit);}
      if(document.activeElement!==input)input.value=n(v);input.setAttribute('aria-valuetext',n(v));this.el(`[data-knob-value="${id}"]`).textContent=n(v);
      input.disabled=this.chapter===2&&this.guess===null;
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-guess]').forEach(b=>{b.setAttribute('aria-pressed',String(Number(b.dataset.guess)===this.guess));b.disabled=this.tried;});
    const compareButton=this.root.querySelector<HTMLButtonElement>('[data-learn-one]');if(compareButton)compareButton.disabled=!this.tried;
    const row=this.root.querySelector<HTMLSelectElement>('[data-row]');if(row&&selected!==null)row.value=String(selected);
    this.el('.explore-instruction').textContent=this.status||this.introduction;
    this.el('.explore-status').textContent=this.status;this.root.dataset.animationPhase=String(this.phase);this.draw();
  }
  private picture(pixels:number[],weights?:number[]):string {
    return `<svg class="explore-picture" viewBox="0 0 14 14" role="img" aria-label="실제 입력 그림 · 칸을 누르면 계산 확인">${pixels.map((v,i)=>`<g data-pixel="${i}"><rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="rgb(${Math.round(255*(1-v))} ${Math.round(255*(1-v))} ${Math.round(255*(1-v))})" stroke="#ddd" stroke-width=".025"/>${weights?`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="${weights[i]!>=0?'#f17605':'#7446f5'}" opacity="${Math.min(.3,Math.abs(weights[i]!)*.2)}"/>`:''}${i===this.featureFrame?`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="none" stroke="#1769d2" stroke-width=".25"/>`:''}</g>`).join('')}</svg>`;
  }
  private renderExamples():void {
    const s=this.source;
    [this.lab.pointIndex??0,this.compare].forEach((row,i)=>{
      const c=s.axisCalculation?.(row,this.axis),p=i===0?this.lab.point:s.data[row]?.pixels??[0,0],image=s.pictures?.[row];
      const term=c&&this.featureFrame>=0?c.terms[this.featureFrame]:null;
      this.el(`[data-source-example="${i}"]`).innerHTML=image&&c?`${this.picture(image)}<span>${term?`고른 칸 ${n(term.pixel)} × (${n(term.weight)}) = ${n(term.product)}`:'칸을 눌러 계산하기'}</span><strong>모두 더해 ${n(c.total)}</strong><span>좌표 (${n(p[0]!)}, ${n(p[1]!)})</span>`:`<div class="explore-goal"><span class="kick" style="left:${(p[0]!+1)*44+6}%">공</span><span class="keeper" style="left:${(p[1]!+1)*44+6}%">골키퍼</span></div><strong>키커 ${n(p[0]!)} · 골키퍼 ${n(p[1]!)}</strong><span>좌표 (${n(p[0]!)}, ${n(p[1]!)})</span>`;
    });
  }
  private renderEquation(point:number[]):void {
    const s=this.source,l=this.lab,m=l.model,section=this.el('.explore-equation'),observation=this.el('.explore-observation');
    if(this.chapter===0){
      this.renderExamples();const f=s.features?.find(f=>f.id===s.featureIds?.[this.axis]),c=s.axisCalculation?.(l.pointIndex??0,this.axis);
      section.innerHTML=c?`<details><summary>${escape(f?.name??'')} · 계산과 좌표 확인</summary><p>${escape(f?.description??'')}</p><p>모든 자료에서 구한 평균 ${n(c.mean)}을 빼고, 공통 크기 ${n(c.scale)}로 나눕니다.</p><strong>(${n(c.total)} − ${n(c.mean)}) ÷ ${n(c.scale)} ≈ ${n(c.coordinate)}</strong><p>정답을 쓰지 않고, 반올림 전 수로 계산해요.</p></details>`:'<p>같은 방향이면 막힘, 다른 방향이면 골로 단순화한 상황입니다. 가운데는 다루지 않아요.</p>';
      observation.innerHTML=`<details><summary>이 실험에서 쓰는 모델</summary><p>${escape(s.note)}</p></details>`;return;
    }
    if(this.chapter===1){
      const z=zeroPoint(m,l.selected),w=m.inputHidden[l.selected]!,allZero=w.every(v=>v===0)&&m.hiddenBias[l.selected]===0;
      const previous=l.previous,old=previous?parameterValue(previous,Math.min(l.selected,previous.hiddenUnits-1),this.parameter):null;
      section.innerHTML=`<div class="explore-line-proof"><strong>${old===null?'슬라이더를 움직여 보세요':`${PARAMS[this.parameter]} ${n(old)} → ${n(parameterValue(m,l.selected,this.parameter))}`}</strong><p>${this.parameter==='bias'?'더할 수를 바꾸면, 같은 방향의 선이 자리를 옮겨요.':'곱할 수를 바꾸면, 선의 방향과 뉴런 값이 달라질 수 있어요.'} 합이 0인 자리를 다시 찾기 때문이에요.</p></div><details><summary>왜 이 자리에 선이 생길까요?</summary><p>${z?`선 위의 점 (${n(z[0])}, ${n(z[1])})`:allZero?'모든 점의 합이 0이라 하나의 선으로 정해지지 않아요':'화면 안에 합이 0인 선이 없어요'}</p>${z?`<strong>${n(z[0])} × (${n(w[0]!)}) + ${n(z[1])} × (${n(w[1]!)}) + (${n(m.hiddenBias[l.selected]!)}) ≈ 0.00</strong>`:''}<p>합이 0인 점들을 이으면 색 선이 됩니다. 최종 클래스 경계는 다음 장면에서 함께 봐요. 처음 수는 실험용 시작값입니다.</p></details>`;
      observation.innerHTML='';return;
    }
    const metrics=evaluatePixelModel(m,s.data),before=l.previous?evaluatePixelModel(l.previous,s.data):null;
    if(this.chapter===2){
      const d=learningDirection(this.trial??m,s.data,l.selected,this.parameter),delta=metrics.loss-d.loss;
      const outcome=Math.abs(delta)<1e-9?'오차가 같아요':delta<0?'오차가 줄었어요':'오차가 커졌어요';
      section.innerHTML=`<div class="explore-loss-comparison" aria-label="출발점과 지금의 오차"><span>출발점 오차<b>${n(d.loss)}</b></span><span class="current">지금 오차<b>${n(metrics.loss)}</b></span></div><p class="explore-trial-result" data-result="${!this.tried?'waiting':delta<0?'better':delta>0?'worse':'same'}">${!this.tried?(this.guess===null?'먼저 방향을 예상해 주세요.':'이제 슬라이더로 수를 직접 바꿔 보세요.'):`${outcome}. ${Math.abs(delta)<.005&&Math.abs(delta)>1e-9?'둘째 자리에서는 차이가 안 보일 만큼 작아요.':delta>0?'반대쪽이나 더 작은 변화도 시험해 보세요.':'더 움직여도 좋아질까요? 계속 시험해 보세요.'}`}</p><p class="explore-note">오차는 작을수록 좋아요. 정답에 준 가능성으로 계산하며, 정답률이나 점과 선의 거리가 아닙니다.</p>${this.tried?`<details><summary>모델은 어느 방향을 고를까요?</summary><p>같은 출발점에서 ${Math.abs(d.gradient)<1e-8?'이 수는 움직이지 않아요':d.next<d.value?'이 수를 줄여요':'이 수를 늘려요'}. 다른 수는 그대로 둡니다.</p><strong>${n(d.value)} − ${n(d.rate)} × (${n(d.gradient)}) ≈ ${n(d.next)}</strong><p>전체 자료에서 계산한 오차 변화율 ${n(d.gradient)}을 반대로 따라갑니다. 고른 방향이 항상 같지는 않아요.</p><p>출발점에서 0.10 줄일 때 오차 ${n(d.lower)}, 늘릴 때 ${n(d.higher)}. 이 비교와 아주 작은 변화율은 다를 수 있어요.</p></details>`:''}`;
      observation.innerHTML='';return;
    }
    section.innerHTML=`<div class="explore-output-nodes"><small>은닉 뉴런 ${m.hiddenUnits}개 → 출력은 클래스 수인 ${s.classes.length}개</small><div>${s.classes.map((c,i)=>`<span style="--class-color:${color(i)}">${escape(c)}</span>`).join('')}</div></div><p>새 뉴런도 답에 연결해야 영향을 줘요. 곱할 수 0은 쓰지 않음, 양수는 더함, 음수는 뺌입니다.</p><div class="explore-capacity"><span>오차 <b>${before?`${n(before.loss)} → `:''}${n(metrics.loss)}</b></span><span>맞힌 자료 <b>${manualScore(m,s.data)} / ${s.data.length}</b></span></div>`;
    observation.innerHTML='<details><summary>뉴런을 늘리면 항상 좋아질까요?</summary><p>서로 다른 기준을 섞어서 최종 경계가 꺾일 수 있지만, 늘리기만 해서는 좋아지지 않아요. 직접 비율을 바꾸거나 학습한 뒤 비교하세요. 연습에서는 새 자료로도 확인합니다.</p></details>';
  }
  private input(event:Event):void {
    const el=event.target as HTMLInputElement,id=el.dataset.knob;if(!id)return;this.stop();const v=Number(el.value);this.status='';
    if(this.chapter===2&&this.guess===null)return;
    if(id==='kick'||id==='keeper'){const p=[...this.lab.point];p[id==='kick'?0:1]=v;this.lab.choosePoint(p,null);}else this.lab.edit(id as ManualParameter,v);
    if(this.chapter===2&&Math.abs(v-parameterValue(this.trial!,this.lab.selected,this.parameter))>1e-9)this.tried=true;
    this.refresh();
  }
  private change(event:Event):void {
    const select=event.target as HTMLSelectElement;
    if(select.matches('[data-row]')){const i=Number(select.value);this.stop();this.onLine=false;this.chosePoint=true;this.lab.choosePoint(this.source.data[i]!.pixels,i);this.popup=this.chapter>0;this.refresh();}
    if(select.matches('[data-compare]')){this.compare=Number(select.value);this.refresh();}
    if(select.matches('[data-parameter]')){this.parameter=select.value as InputParameter;this.startTrial();this.status='';this.inputKey='';this.render();}
    if(select.matches('[data-output]')){this.lab.output=Number(select.value);this.status='';this.inputKey='';this.render();}
    if(select.matches('[data-feature]')){const axes=[...this.source.featureIds!] as [string,string];axes[Number(select.dataset.feature)]=select.value;this.status=this.options.setAxes?.(...axes)??'특징을 바꾸어 점을 다시 놓았어요. 실험 모델은 처음 상태입니다.';this.inputKey='';this.render();}
  }
  private click(event:Event):void {
    const pixel=(event.target as Element).closest<SVGElement>('[data-pixel]');if(pixel&&this.chapter===0){this.featureFrame=Number(pixel.dataset.pixel);this.refresh();return;}
    const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;
    if(b.dataset.exploreChapter!==undefined)return this.goTo(Number(b.dataset.exploreChapter));
    if(b.hasAttribute('data-explore-next')){if(this.chapter===3){this.stop();this.options.complete();}else this.goTo(this.chapter+1);return;}
    if(b.hasAttribute('data-explore-back')){if(this.chapter===0)this.options.back?.();else this.goTo(this.chapter-1);return;}
    if(b.hasAttribute('data-close-point')){this.popup=false;this.refresh();return;}
    if(b.dataset.neuron!==undefined){this.lab.selected=Number(b.dataset.neuron);this.startTrial();this.status='';this.inputKey='';this.render();return;}
    if(b.dataset.guess!==undefined){if(this.tried)return;this.guess=Number(b.dataset.guess) as -1|1;this.refresh();return;}
    if(b.hasAttribute('data-restart-trial')){this.startTrial();this.status='';this.refresh();return;}
    if(b.dataset.axis!==undefined){this.axis=Number(b.dataset.axis) as 0|1;this.featureFrame=-1;this.inputKey='';this.render();return;}
    if(b.dataset.dimension!==undefined){this.oneAxis=b.dataset.dimension==='1';this.inputKey='';this.render();return;}
    if(b.hasAttribute('data-zero')){this.onLine=!this.onLine;this.popup=false;this.refresh();return;}
    if(b.hasAttribute('data-add-neuron')){this.lab.addNeuron();this.status='새 기준선이 생겼어요. 아직 곱할 수가 0이라 답은 그대로입니다. 슬라이더로 연결해 보세요.';}
    if(b.hasAttribute('data-remove-neuron'))this.lab.removeNeuron();
    if(b.hasAttribute('data-undo'))this.lab.undo();
    if(b.hasAttribute('data-learn-one')){
      if(!this.tried)return;
      const base=this.trial!,d=learningDirection(base,this.source.data,this.lab.selected,this.parameter);
      this.lab.applyModel(withParameter(base,this.lab.selected,this.parameter,d.next));
      this.status=d.next===d.value?'이 출발점에서는 이 수를 바꿀 방향이 나오지 않았어요. 다른 수나 뉴런도 살펴보세요.':n(d.value)===n(d.next)?`모델은 이 수를 아주 조금 ${d.next<d.value?'줄였어요':'늘렸어요'}. 둘째 자리로 표시하면 같지만, 실제 값과 선은 변합니다.`:`같은 출발점에서 모델은 ${n(d.value)} → ${n(d.next)}로 고쳤어요. 오차 ${n(d.loss)} → ${n(d.nextLoss)}.`;
    }
    if(b.hasAttribute('data-train')||b.hasAttribute('data-train-many')){this.stop();const count=b.hasAttribute('data-train-many')?50:1;this.lab.applyModel(trainPixelModel(this.lab.model,this.source.data,count,.1));this.status=`모든 연결을 ${count}번 학습했어요. 색 선과 검은 경계를 비교하세요.`;}
    if(b.hasAttribute('data-play-math')){this.stop();this.phase=0;this.refresh();this.timer=window.setInterval(()=>{this.phase++;if(this.phase>2){window.clearInterval(this.timer);this.timer=0;this.phase=-1;}this.refresh();},650);return;}
    this.inputKey='';this.render();
  }
}
