import { ManualLab, copyModel, manualPrediction, type ManualParameter } from '../core/manualLab';
import { evaluatePixelModel, forwardPixels, trainPixelModel, type PixelModel } from '../core/pixelNetwork';
import { learningDirection, parameterValue, withParameter, zeroPoint, type InputParameter } from '../core/explorationLearning';
import type { ExplorationSource } from '../core/explorationSource';
import { drawPixelLatentMap, pixelMapExampleAt } from '../visualization/pixelLatentMap';
import { NEURON_COLORS } from '../visualization/neuronColors';
import { explorationNetwork, explorationOutputNetwork } from './explorationNetwork';
import { DataProjection } from './dataProjection';
import type { Coordinate } from './projectionMotion';
import { recordResearch } from '../research/bus';
import type { Action, Payload } from '../research/schema';
import { axisTrace } from './featureTrace';
import { exampleComparison } from './exampleFeedback';
import { trainingEvidence, outputWeightGradient } from '../core/trainingEvidence';
import { neuronPointAt, lineDirection, PLOT } from './neuronInteraction';
import { predictionEvidence } from './predictionEvidence';

interface JourneyOptions {
  source:()=>ExplorationSource; context:()=>string; complete:()=>void; back?:()=>void;
  setAxes?:(x:string,y:string)=>string|null; featureEditor?:(host:HTMLElement)=>void;
}
const CHAPTERS=['자료 비교','뉴런 직접 조절','예상 개선하기','뉴런 늘리기'];
const IDENTITY={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const COLORS=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
const n=(value:number)=>Math.abs(value)<.005?'0.00':value.toFixed(2);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

const neuronSum=(m:PixelModel,p:number[],h:number)=>m.inputHidden[h]!.reduce((sum,w,i)=>sum+w*p[i]!,m.hiddenBias[h]!);
const neuronColor=(i:number)=>NEURON_COLORS[i%NEURON_COLORS.length]!;
const safelyUnchosen=(source:ExplorationSource,chosen:boolean[],axis:number)=>!!source.features&&!chosen[axis];
const PARAMS:Record<InputParameter,string>={xWeight:'가로에 곱할 수',yWeight:'세로에 곱할 수',bias:'마지막에 더할 수'};

/** One actual dataset and one editable network across the four exploratory scenes. */
export class UnderstandingJourney {
  readonly root:HTMLElement;
  private chapter=0;private source!:ExplorationSource;private lab!:ManualLab;private signature='';
  private axis:0|1=0;private oneAxis=false;private timer=0;private phase=-1;
  private inputKey='';private featureFrame=-1;private popup=false;private status='';private introduction='';
  private chosenAxes=[false,false];private parameterChosen=false;private outputChosen=false;
  private parameter:InputParameter='bias';private onLine=false;private chosePoint=false;
  private trial:PixelModel|null=null;private tried=false;
  private logWorkspace=crypto.randomUUID();private logModelVersion=0;private logDatasetVersion=0;
  private projection:DataProjection;
  private touched=[new Set<string>(),new Set<string>(),new Set<string>()];
  private entered=false;private placing:0|1|2=2;
  private log(action:Action,payload:Payload={}):void {recordResearch(action,{scene:this.chapter,...payload},{engine:'understanding-relu-2',workspaceId:this.logWorkspace,modelVersion:this.logModelVersion,datasetVersion:this.logDatasetVersion});}
  constructor(root:HTMLElement,private options:JourneyOptions) {
    this.root=root;root.className='image-workspace understanding-journey exploration-journey';
    root.innerHTML=`<nav class="explore-nav" aria-label="이해 순서">${CHAPTERS.map((s,i)=>`<button data-explore-chapter="${i}"><span>${i+1}</span> ${s}</button>`).join('')}</nav>
      <div class="explore-body"><section class="explore-visual"><header><strong data-map-title></strong><span data-map-count></span></header>
      <div class="plot-aspect-slot"><div class="explore-map"><canvas aria-label="실제 자료의 분포와 뉴런 기준선"></canvas><div class="explore-point" role="region" aria-label="고른 점의 정답과 예상" hidden></div><span class="explore-zero" hidden>합 0</span><svg class="explore-direction-arrow" aria-label="이 수를 학습할 때 선이 움직일 방향" hidden></svg></div></div>
      <div class="explore-impact" role="status" hidden></div><div class="explore-network" aria-label="입력에서 은닉 뉴런과 출력으로 이어지는 연결 지도"></div><div class="explore-key"></div></section>
      <section class="explore-action"><div class="explore-content"><h2></h2><p class="explore-instruction"></p><div class="explore-controls"></div><div class="explore-feature-tools"></div><div class="explore-equation"></div><div class="explore-observation"></div></div>
      <p class="explore-status" role="status" aria-live="polite"></p><footer><button data-explore-back>← 이전</button><button data-explore-next class="button primary">다음 →</button></footer></section></div>`;
    this.el('.explore-equation').before(this.el('.explore-network'));
    this.projection=new DataProjection(this.el('.explore-visual'),()=>this.draw(),(operation,axis,completed,values)=>this.log('visualization_change',{operation:`projection-${operation}`,axis,completed,...values}),()=>this.replayProjection(),()=>this.syncProjectionLock());

    root.addEventListener('click',e=>this.click(e));root.addEventListener('input',e=>this.input(e));root.addEventListener('change',e=>this.change(e));
    root.addEventListener('pointerdown',e=>{if((e.target as Element).matches('[data-knob]'))this.lab.beginGesture();});
    for(const event of ['pointerup','pointercancel','change'])root.addEventListener(event,()=>this.lab?.endGesture());
    this.el<HTMLCanvasElement>('canvas').addEventListener('pointerdown',event=>{
      if(this.projection.running)return;
      const canvas=this.el<HTMLCanvasElement>('canvas');
      const rect=canvas.getBoundingClientRect(),p=this.chapter===1?neuronPointAt(this.lab.model,this.lab.selected,event.clientX-rect.left,event.clientY-rect.top,rect.width,rect.height):null;
      // A visible line takes priority over nearby training dots, so clicking it really yields zero.
      const weights=this.lab.model.inputHidden[this.lab.selected]!;
      if(p&&weights.some(w=>Math.abs(w)>1e-10)&&Math.abs(neuronSum(this.lab.model,p,this.lab.selected))<1e-9){this.stop();this.onLine=false;this.chosePoint=false;this.lab.choosePoint(p,null);this.popup=true;this.refresh();this.log('simulation_action',{operation:'line-point',coordinates:p,neuron:this.lab.selected,value:0});return;}
      const hit=pixelMapExampleAt(canvas,event.clientX,event.clientY,IDENTITY,this.displayData());
      const index=hit;
      if(index!==null){this.stop();this.onLine=false;this.chosePoint=true;this.lab.choosePoint(this.source.data[index]!.pixels,index);this.popup=true;if(this.chapter>=2)this.startTrial();this.refresh();this.log('sample_select',{sampleId:index,label:this.source.data[index]!.label,coordinates:this.lab.point});return;}
      if(this.chapter!==1)return;
      if(!p)return;this.stop();this.onLine=false;this.lab.choosePoint(p,null);this.popup=true;this.refresh();this.log('simulation_action',{operation:'line-point',coordinates:p,neuron:this.lab.selected,value:neuronSum(this.lab.model,p,this.lab.selected)});

    });
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!root.hidden&&this.lab)this.draw();}).observe(this.el('.explore-map'));
    this.render();
  }
  private el<T extends HTMLElement=HTMLElement>(s:string):T{return this.root.querySelector<T>(s)!;}
  stop():void {window.clearInterval(this.timer);this.timer=0;this.phase=-1;this.featureFrame=-1;this.projection?.cancel();}
  reset():void {this.stop();this.chapter=0;this.axis=0;this.oneAxis=false;this.status='';this.signature='';this.inputKey='';this.popup=false;this.onLine=false;this.trial=null;this.tried=false;this.entered=false;this.placing=2;this.chosenAxes=[false,false];this.parameterChosen=false;this.outputChosen=false;this.touched.forEach(s=>s.clear());}
  private startTrial():void {this.trial=copyModel(this.lab.model);this.tried=false;}
  show(visible:boolean):void {this.root.hidden=!visible;if(visible){if(!this.entered){this.entered=true;this.placing=this.source.features?0:2;this.oneAxis=this.placing===0;this.inputKey='';}this.render();}else this.stop();}
  goTo(chapter:number):void {
    this.parameterChosen=false;this.outputChosen=false;this.stop();this.chapter=Math.max(0,Math.min(3,chapter));this.onLine=false;this.popup=false;this.inputKey='';this.status='';
    this.el('.explore-content').scrollTop=0;
    // Start with a real row whose error affects the selected neuron, not an inactive zero-output row.
    if(this.chapter===2&&this.source.data.length){
      let strongest=-1,index=0;this.source.data.forEach((row,i)=>{const g=Math.abs(learningDirection(this.lab.model,[row],this.lab.selected,this.parameter).gradient);const f=forwardPixels(this.lab.model,row.pixels),visible=f.hidden[this.lab.selected]!>.1;const rival=f.logits.reduce((best,v,c)=>c!==row.label&&(best===row.label||v>f.logits[best]!)?c:best,row.label);const responsive=Math.abs(this.lab.model.hiddenOutput[row.label]![this.lab.selected]!-this.lab.model.hiddenOutput[rival]![this.lab.selected]!)>.01;const priority=g+(visible?1:0)+(visible&&responsive?10:0);if(priority>strongest){strongest=priority;index=i;}});
      this.lab.choosePoint(this.source.data[index]!.pixels,index);
    }
    if(this.chapter>=2){this.startTrial();if(this.chapter===3)this.lab.output=this.source.data[this.lab.pointIndex??0]?.label??0;}
    this.render();
    this.log('scene_view',{scene:this.chapter});
  }
  render():void {
    this.source=this.options.source();
    const key=JSON.stringify([this.source.kind,this.source.data,this.source.classes,this.source.axes]);
    if(key!==this.signature){this.stop();this.signature=key;this.lab=new ManualLab('data',this.source);this.touched.forEach(s=>s.clear());this.logDatasetVersion++;this.logModelVersion++;this.startTrial();this.inputKey='';this.popup=false;this.onLine=false;this.chosePoint=false;}
    this.root.dataset.chapter=String(this.chapter);
    this.root.querySelectorAll<HTMLElement>('[data-explore-chapter]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.exploreChapter)===this.chapter?'step':'false'));
    this.el('[data-explore-back]').textContent=this.chapter?'← 이전':'← 자료 보기';
    this.el<HTMLButtonElement>('[data-explore-back]').disabled=this.chapter===0&&!this.options.back;
    this.el('[data-explore-next]').textContent=this.chapter===0&&this.placing<2?(this.placing===0?'가로축에 놓기 →':'세로축에 펼치기 →'):this.chapter===3?'내 자료로 연습하기 →':'다음 →';
    this.renderControls();this.refresh();
  }
  private color(i:number):string {return this.source.kind==='penalty'?['#1f6bd6','#f17605'][i%2]!:COLORS[i%COLORS.length]!;}
  private range(id:string,label:string,value:number,min=-2,max=2):string {
    return `<label class="explore-knob">${label}<output data-knob-value="${id}">${n(value)}</output><input type="range" data-knob="${id}" aria-label="${label}" aria-valuetext="${n(value)}" min="${min}" max="${max}" step=".01" value="${n(value)}"></label>`;
  }
  private rows(attribute:string,index:number):string {
    return `<select ${attribute} aria-label="${attribute==='data-row'?'살펴볼 자료':'비교할 자료'}">${this.source.data.map((r,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}번 · ${escape(this.source.classes[r.label]??'?')}</option>`).join('')}</select>`;
  }
  private renderControls():void {
    const s=this.source,m=this.lab.model;
    this.el('h2').textContent=[s.kind==='penalty'?'두 방향을 숫자로 기록해요':'한 자료에서 두 좌표를 구해요','어떤 점들을 이으면 선이 될까요?','어느 쪽으로 고치면 정답에 가까워질까요?','뉴런 하나가 더 생기면?'][this.chapter]!;
    this.introduction=[s.kind==='penalty'?'방향 한 개로 충분할까요? 두 방향을 함께 기록해 비교하세요.':s.kind==='tabular'?'같은 자료에서 가로 값과 세로 값을 하나씩 구해요.':'특징을 고르면, 왼쪽 그림에서 계산할 칸을 보여줘요.','은닉 뉴런은 곱하고 더하는 계산기예요. 합이 0인 점들을 이은 색 선은 양수 쪽과 음수 쪽을 나눠요. 양수는 그대로, 0 이하는 0을 보냅니다.','색 선을 고치면 최종 예상도 바뀌어요. × 표시와 정답에 준 몫을 함께 비교해요.','뉴런별 가중치는 받은 값을 얼마나 더할지 정하는 수예요. 어느 클래스에 얼마를 더할지 바꾸고, 고른 자료의 예상을 확인해요.'][this.chapter]!;
    this.el('.explore-feature-tools').hidden=this.chapter!==0;
    const key=JSON.stringify([this.chapter,s.axes,s.features?.map(f=>[f.id,f.name]),s.classes,m.hiddenUnits,this.lab.selected,this.lab.output,this.axis,this.parameter,this.placing,this.chosenAxes,this.parameterChosen,this.outputChosen]);
    if(this.inputKey===key)return;this.inputKey=key;
    let html='';
    if(this.chapter===0){
      if(s.features)html=`<div class="explore-axes">${['가로 특징','세로 특징'].map((title,i)=>`<label class="${!this.chosenAxes[i]?'needs-choice':''}">${title}<select data-feature="${i}" aria-label="${title}"><option value="" disabled ${!this.chosenAxes[i]?'selected':''}>선택하세요</option>${s.features!.filter(f=>s.kind!=='image'||['lr','tb','ink','center','position'].includes(f.id)).map(f=>`<option value="${escape(f.id)}" ${this.chosenAxes[i]&&s.featureIds![i]===f.id?'selected':''}>${escape(f.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
      if(s.kind==='penalty')html+=`<div class="explore-direction">← 왼쪽 <span>가운데 0</span> 오른쪽 →</div>${this.range('kick','키커 방향',this.lab.point[0]!,-1,1)}${this.range('keeper','골키퍼 방향',this.lab.point[1]!,-1,1)}`;
      html+=`<div class="explore-toggle" ${this.placing<2?'hidden':''}><button data-dimension="1" aria-pressed="${this.oneAxis}">가로만 보기</button><button data-dimension="2" aria-pressed="${!this.oneAxis}">두 특징 함께</button>${s.features?`<button data-axis="${1-this.axis}">${this.axis===0?'세로':'가로'} 계산 보기</button>`:''}</div><div class="explore-single-source"><label>살펴볼 자료${this.rows('data-row',this.lab.pointIndex??0)}</label><div data-source-example="0"></div></div>`;
    }else{
      html=`<div class="explore-neuron-choice">${Array.from({length:m.hiddenUnits},(_,i)=>`<button data-neuron="${i}" style="--neuron:${neuronColor(i)}" aria-pressed="${this.lab.selected===i}">뉴런 ${i+1}</button>`).join('')}${this.chapter===3?`<button data-add-neuron ${m.hiddenUnits>=4?'disabled':''}>+ 뉴런 추가</button><button data-remove-neuron ${m.hiddenUnits<=1?'disabled':''}>− 뉴런 삭제</button>`:''}</div>`;
      if(this.chapter===1||this.chapter===2)html+=`<fieldset class="parameter-choices ${!this.parameterChosen?'needs-choice':''}"><legend>바꿀 수를 선택하세요</legend><div data-parameter role="group" aria-label="직접 바꿀 수">${Object.entries(PARAMS).map(([id,label])=>`<button data-parameter-choice="${id}" aria-pressed="${this.parameterChosen&&id===this.parameter}">${label}</button>`).join('')}</div></fieldset>`;
      if((this.chapter===1||this.chapter===2)&&this.parameterChosen)html+=this.range(this.parameter,PARAMS[this.parameter],parameterValue(m,this.lab.selected,this.parameter));
      if(this.chapter===1)html+=`<div class="explore-tools"><button data-play-math>계산 따라 보기</button><button data-undo aria-label="값 변경 되돌리기">↶</button></div>`;
      if(this.chapter===2)html+=`<div class="explore-tools"><button data-learn-one>모델의 한 번 수정</button><button data-restart-trial>지금 값부터 비교</button></div>`;
      if(this.chapter===3)html+=`<p class="weight-principle">모든 연결을 두고, 곱하는 수를 조금씩 고칩니다. 연결을 켜고 끄는 선택은 없어요.</p><label class="${!this.outputChosen?'needs-choice':''}">어느 답으로 가는 연결을 볼까요?<select data-output aria-label="조절할 답"><option value="" disabled ${!this.outputChosen?'selected':''}>선택하세요</option>${s.classes.map((c,i)=>`<option value="${i}" ${this.outputChosen&&i===this.lab.output?'selected':''}>${escape(c)}</option>`).join('')}</select></label>`+(this.outputChosen?this.range('connection',`뉴런 ${this.lab.selected+1}의 가중치`,m.hiddenOutput[this.lab.output]![this.lab.selected]!):'')+`<details class="explore-auto-compare"><summary>모델이 가중치를 고치면?</summary><div class="explore-tools"><button data-train>1번 학습</button><button data-train-many>50번 학습</button><button data-undo aria-label="값 변경 되돌리기">↶</button></div></details>`;
    }
    this.el('.explore-controls').innerHTML=html;
  }
  private coordinates():Coordinate[]{return this.source.data.map(r=>[r.pixels[0]!,this.oneAxis?0:r.pixels[1]!]);}
  private replayProjection():void {
    this.stop();this.popup=false;if(this.placing===0){this.placing=1;this.oneAxis=true;}this.inputKey='';this.render();
    this.projection.start('place',[],this.coordinates(),this.axis,this.lab.pointIndex??0);
  }
  private displayData(){
    const animated=this.chapter===0?this.projection.positions:null;
    if(this.chapter===0&&this.placing===0)return [];
    return this.source.data.flatMap((r,i)=>animated?(animated[i]?[{...r,pixels:[...animated[i]!]}]:[]):[{...r,pixels:this.chapter===0&&this.oneAxis?[r.pixels[0]!,0]:r.pixels}]);
  }
  private position(el:HTMLElement,point:number[],popup=false):void {
    const map=this.el('.explore-map'),w=map.clientWidth||700,h=map.clientHeight||350;
    const x=50+(point[0]!+1)/2*(w-64),y=13+(1-point[1]!)/2*(h-64);
    el.style.left=`${popup?Math.max(0,Math.min(w-(el.offsetWidth||240),x-60)):x}px`;
    el.style.top=`${popup?Math.max(0,Math.min(h-(el.offsetHeight||88),y+12)):y}px`;
  }
  private draw():void {
    const point=this.onLine?zeroPoint(this.lab.model,this.lab.selected)??this.lab.point:this.lab.point;
    const displayed=this.chapter===0&&this.oneAxis?[point[0]!,0]:point;
    this.projection.render();
    drawPixelLatentMap(this.el('canvas'),this.lab.model,this.displayData(),this.projection.running||(this.chapter===0&&this.placing===0)?[]:displayed,IDENTITY,{
      view:this.chapter===0?'placement':'decision',showNeuronBoundaries:this.chapter>0,onlyNeuron:this.chapter===1||this.chapter===2?this.lab.selected:undefined,
      showDecisionBoundary:this.chapter>=2,showMisclassifications:this.chapter===2,showValueDirection:false,
      focusLabel:this.chapter===1?`합 ${n(neuronSum(this.lab.model,point,this.lab.selected))}`:this.chapter===2?`정답 ${this.source.classes[this.source.data[this.lab.pointIndex??0]?.label??0]} · ${n(forwardPixels(this.lab.model,point).probabilities[this.source.data[this.lab.pointIndex??0]?.label??0]!*100)}%`:this.chapter===3?`정답 ${this.source.classes[this.source.data[this.lab.pointIndex??0]?.label??0]}`:'',neutralTies:this.chapter!==2,classLabels:this.source.classes,classColors:this.source.kind==='penalty'?['#1f6bd6','#f17605']:COLORS,
      axisLegend:{horizontal:{title:this.chapter===0&&safelyUnchosen(this.source,this.chosenAxes,0)?'가로 특징을 선택하세요':this.source.axes[0],negative:'',positive:''},vertical:{title:this.chapter===0&&safelyUnchosen(this.source,this.chosenAxes,1)?'세로 특징을 선택하세요':this.chapter===0&&this.oneAxis?'세로 특징을 보지 않음':this.source.axes[1],negative:'',positive:''}},resolution:65,
    });
    this.position(this.el('.explore-point'),displayed,true);
    this.drawDirection();
    const zero=this.el('.explore-zero');zero.hidden=!this.onLine||!zeroPoint(this.lab.model,this.lab.selected);if(!zero.hidden)this.position(zero,point);
  }

  private drawDirection():void {
    const svg=this.el('.explore-direction-arrow'),row=this.source.data[0];svg.toggleAttribute('hidden',this.chapter!==2||!row||!this.parameterChosen);
    if(svg.hasAttribute('hidden'))return;
    const move=lineDirection(this.lab.model,this.lab.point,row!.label,this.lab.selected,this.parameter,this.source.data);
    if(!move){svg.setAttribute('hidden','');return;}
    const map=this.el('.explore-map'),width=map.clientWidth||700,height=map.clientHeight||350;
    const xy=(p:number[])=>[PLOT.left+(p[0]!+1)/2*(width-64),PLOT.top+(1-p[1]!)/2*(height-64)];
    const a=xy(move.start),b=xy(move.end),dx=b[0]!-a[0]!,dy=b[1]!-a[1]!,norm=Math.hypot(dx,dy);
    if(norm<1e-9){svg.setAttribute('hidden','');return;}
    // Fixed-length arrow conveys direction only, never a fabricated movement distance.
    const x=a[0]!,y=a[1]!,ex=x+dx/norm*32,ey=y+dy/norm*32;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.innerHTML=`<path d="M${x} ${y} L${ex} ${ey} M${ex-dx/norm*8-dy/norm*4} ${ey-dy/norm*8+dx/norm*4} L${ex} ${ey} L${ex-dx/norm*8+dy/norm*4} ${ey-dy/norm*8-dx/norm*4}"/><text x="${Math.min(width-135,Math.max(55,ex+8))}" y="${Math.max(27,Math.min(height-48,ey-8))}"></text>`;
  }

  private refresh():void {
    const s=this.source,l=this.lab,m=l.model,point=this.onLine?zeroPoint(m,l.selected)??l.point:l.point,selected=l.pointIndex;
    this.root.style.setProperty('--active-neuron',neuronColor(l.selected));
    const product=(point[0]??0)*(point[1]??0);
    const label=selected===null?(s.kind==='penalty'?(product===0?null:product<0?1:0):null):s.data[selected]?.label??null;
    const answer=manualPrediction(m,point);
    this.el('[data-map-title]').textContent=this.chapter===0?'고른 특징으로 본 자료 분포':this.chapter===1?'선이나 점을 눌러 계산해 보세요':this.chapter===2?'모든 자료의 정답을 함께 비교해요':'색 선 = 뉴런의 기준 · 검은 선 = 최종 경계';
    this.el('[data-map-count]').textContent=`${s.data.length}개 자료`;
    const popup=this.el('.explore-point');popup.hidden=!this.popup||this.onLine;
    const truth=label===null?'':`정답 <b style="color:${this.color(label)}">${escape(s.classes[label]??'?')}</b>`;
    popup.innerHTML=`<button data-close-point aria-label="점 정보 닫기">×</button>${s.pictures&&selected!==null?this.picture(s.pictures[selected]!):''}<div><span>(${n(point[0]!)}, ${n(point[1]!)})</span><strong>${this.chapter===0&&label===null?'가운데 방향은 판정하지 않아요':truth}${this.chapter===1?`<br>뉴런의 합 <b>${n(neuronSum(m,point,l.selected))}</b> → 보낼 값 <b>${n(forwardPixels(m,point).hidden[l.selected]!)}</b>`:this.chapter>=2?` · 예상 <b>${answer===null?'동점':escape(s.classes[answer]??'?')}</b>`:''}</strong></div>`;

    this.el('.explore-network').hidden=this.chapter===0||(this.chapter===3&&!this.outputChosen);
    this.projection.setSource(s,this.chapter===0&&this.chosenAxes[0]!,this.oneAxis,this.placing===0,selected??0);
    if(this.chapter>0)this.el('.explore-network').innerHTML=this.chapter===3?explorationOutputNetwork(m,point,l.selected,l.output,s.classes):explorationNetwork(m,point,l.selected,this.parameterChosen?this.parameter:undefined);
    this.el('.explore-key').innerHTML=this.chapter===0?(this.oneAxis?'가로 위치 = 고른 특징의 값':'점의 위치 = 두 특징값'):(this.chapter===1||this.chapter===2)?(this.chapter===2?'점 색 = 정답 · 바탕색 = 예상 · × = 틀린 자료':'색 면은 뉴런의 반응 · 클래스 영역이 아니에요. 색 선에서는 합 = 0'):'점 색 = 정답 · 바탕색 = 예상';
    const maxChapter=this.placing<2?0:this.touched[1]!.size<3?1:this.touched[2]!.size<3?2:3;
    this.root.querySelectorAll<HTMLButtonElement>('[data-explore-chapter]').forEach(b=>b.disabled=Number(b.dataset.exploreChapter)>maxChapter&&Number(b.dataset.exploreChapter)>this.chapter);
    const next=this.el<HTMLButtonElement>('[data-explore-next]');next.disabled=(this.chapter===1||this.chapter===2)&&this.touched[this.chapter]!.size<3;
    if(this.chapter===1||this.chapter===2)next.textContent=next.disabled?`${this.chapter===2?'세 수의 개선 방향 찾기':'세 수를 바꿔 보세요'} · ${this.touched[this.chapter]!.size}/3`:'다음 →';
    if(this.chapter===1||this.chapter===2)this.root.querySelectorAll<HTMLButtonElement>('[data-parameter-choice]').forEach(o=>{o.dataset.completed=String(this.touched[this.chapter]!.has(o.dataset.parameterChoice!));});
    this.renderEquation(point);this.renderImpact(point,label);this.syncProjectionLock();
    for(const input of this.root.querySelectorAll<HTMLInputElement>('[data-knob]')){
      const id=input.dataset.knob!,v=id==='kick'?l.point[0]!:id==='keeper'?l.point[1]!:id==='connection'?m.hiddenOutput[l.output]![l.selected]!:parameterValue(m,l.selected,id as InputParameter);
      if(id!=='kick'&&id!=='keeper'){input.min=String(-l.parameterLimit);input.max=String(l.parameterLimit);}
      if(document.activeElement!==input)input.value=n(v);input.setAttribute('aria-valuetext',n(v));this.el(`[data-knob-value="${id}"]`).textContent=n(v);
      input.disabled=false;
    }
    this.root.querySelectorAll<HTMLButtonElement>('[data-connection-example]').forEach(b=>b.setAttribute('aria-pressed',String(m.hiddenOutput[l.output]![l.selected]===Number(b.dataset.connectionExample))));
    const compareButton=this.root.querySelector<HTMLButtonElement>('[data-learn-one]');if(compareButton)compareButton.disabled=!this.parameterChosen||!this.tried;
    const row=this.root.querySelector<HTMLSelectElement>('[data-row]');if(row&&selected!==null)row.value=String(selected);
    this.el('.explore-instruction').textContent=this.status||this.introduction;
    this.el('.explore-status').textContent=this.status;this.root.dataset.animationPhase=String(this.phase);this.draw();
  }
  private picture(pixels:number[],weights?:number[]):string {
    return `<svg class="explore-picture" viewBox="0 0 14 14" role="img" aria-label="실제 입력 그림 · 칸을 누르면 계산 확인">${pixels.map((v,i)=>`<g data-pixel="${i}"><rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="rgb(${Math.round(255*(1-v))} ${Math.round(255*(1-v))} ${Math.round(255*(1-v))})" stroke="#ddd" stroke-width=".025"/>${weights?`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="${weights[i]!>=0?'#f17605':'#7446f5'}" opacity="${Math.min(.3,Math.abs(weights[i]!)*.2)}"/>`:''}${i===this.featureFrame?`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="none" stroke="#1769d2" stroke-width=".25"/>`:''}</g>`).join('')}</svg>`;
  }
  private renderExamples():void {
    const s=this.source,row=this.lab.pointIndex??0,p=this.lab.point;
    if(s.features&&!this.chosenAxes[0]){this.el('[data-source-example="0"]').innerHTML='<p class="empty-choice">가로 특징을 먼저 선택하세요.</p>';return;}
    this.el('[data-source-example="0"]').innerHTML=s.kind==='penalty'
      ? `<div class="explore-goal"><span class="kick" style="left:${(p[0]!+1)*44+6}%">공</span><span class="keeper" style="left:${(p[1]!+1)*44+6}%">골키퍼</span></div><p>가로 · 키커 ${n(p[0]!)} / 세로 · 골키퍼 ${n(p[1]!)}</p>`
      : `${s.records?`<p class="explore-record">${escape(s.records[row]?.name??'')}</p>`:''}<div class="feature-axis-traces">${this.chosenAxes[0]?axisTrace(s,row,0):''}${this.chosenAxes[1]?axisTrace(s,row,1):'<p class="empty-choice">다음은 세로 특징을 선택하세요.</p>'}</div><p class="feature-final-coordinate">이 자료의 좌표 <b>(${n(p[0]!)}, ${this.chosenAxes[1]?n(p[1]!):'—'})</b></p>`;
    this.root.querySelectorAll<HTMLElement>('[data-feature-trace]').forEach(e=>e.dataset.active=String(Number(e.dataset.featureTrace)===this.axis));
  }
  private syncProjectionLock():void {
    if(!this.projection)return;
    const busy=this.projection.running;
    this.root.querySelectorAll<HTMLSelectElement|HTMLButtonElement>('[data-feature],[data-row],[data-axis],[data-dimension]').forEach(e=>e.disabled=busy||(e.dataset.feature==='1'&&this.placing===0));
    if(this.chapter===0){const max=this.placing<2?0:this.touched[1]!.size<3?1:this.touched[2]!.size<3?2:3;this.el<HTMLButtonElement>('[data-explore-next]').disabled=busy||this.placing<2;this.root.querySelectorAll<HTMLButtonElement>('[data-explore-chapter]').forEach(e=>e.disabled=busy||Number(e.dataset.exploreChapter)>max);}
  }
  private renderImpact(point:number[],label:number|null):void {
    const el=this.el('.explore-impact'),m=this.lab.model;
    el.hidden=this.chapter<1;if(el.hidden)return;
    if(this.chapter===1){const f=forwardPixels(m,point),sum=neuronSum(m,point,this.lab.selected);el.dataset.result='same';el.innerHTML=`<b>고른 점 · 합 ${n(sum)}</b><span>→ ${sum<=0?'0 이하이므로':'양수이므로'} <b>${n(f.hidden[this.lab.selected]!)}</b>을 보냄</span>`;return;}
    if(this.chapter===2){const e=trainingEvidence(this.trial??m,m,this.source.data);el.hidden=!this.parameterChosen;el.dataset.result=e.after.wrong<e.before.wrong?'better':e.after.wrong>e.before.wrong?'worse':'same';el.innerHTML=`<span>그래프의 × 표시</span><strong>틀린 자료 ${e.before.wrong} → ${e.after.wrong}개</strong><span>전체 ${e.after.total}개</span>`;return;}
    if(label===null){el.textContent='학습 자료의 점을 골라 비교해 보세요.';return;}
    const c=exampleComparison(this.trial??m,m,point,label);el.dataset.result=c.result;
    el.innerHTML=`<span>고른 점의 정답 <b style="color:${this.color(label)}">${escape(this.source.classes[label]!)}</b></span><strong>${n(c.from.probabilities[label]!*100)}% → ${n(c.to.probabilities[label]!*100)}%</strong><b>${c.result==='better'?'↑ 좋아진 방향':c.result==='worse'?'↓ 정답에서 멀어진 방향':'변화 없음'}</b>`;
  }
  private renderEquation(point:number[]):void {
    const s=this.source,l=this.lab,m=l.model,section=this.el('.explore-equation'),observation=this.el('.explore-observation');
    if(this.chapter===0){
      this.renderExamples();
      if(s.features&&!this.chosenAxes[0]){section.innerHTML='';observation.innerHTML='';return;}
      section.innerHTML=s.axisCalculation?'<details><summary>왜 평균을 빼고 나누나요?</summary><p>모든 자료의 특징값을 더해 자료 수로 나눈 것이 평균이에요. 평균 위치를 0으로 두고, 평균에서 가장 멀리 떨어진 값이 0.90에 오도록 같은 간격으로 나눠요. 차이가 아주 작을 때는 나누는 수가 0이 되지 않도록 최소 간격을 씁니다. 자료마다 다른 수로 나누지 않아요. 계산은 반올림 전 값으로 합니다.</p><p>진하기는 흰 칸 0, 검은 칸 1, 회색은 그 사이예요. 열 번호 특징은 위치뿐 아니라 전체 진하기도 영향을 줘요.</p></details>':s.numericCalculation?'<details><summary>좌표의 눈금</summary><p>전체 자료의 최솟값을 −0.90, 최댓값을 0.90에 놓고 사이를 같은 비율로 나눕니다. 모든 값이 같으면 0.00이에요.</p></details>':'<p>같은 방향이면 막힘, 다른 방향이면 골로 단순화한 상황입니다. 가운데는 다루지 않아요.</p>';
      observation.innerHTML=`<details><summary>이 실험에서 쓰는 모델</summary><p>${escape(s.note)}</p></details>`;return;
    }
    if((this.chapter===1||this.chapter===2)&&!this.parameterChosen){section.innerHTML='<p class="empty-choice">먼저 바꿀 수를 선택하세요. 연결지도에서 그 수의 자리를 표시합니다.</p>';observation.innerHTML='';return;}
    if(this.chapter===1){
      const z=zeroPoint(m,l.selected),w=m.inputHidden[l.selected]!,zeroWeights=w.every(v=>v===0),allZero=zeroWeights&&m.hiddenBias[l.selected]===0;
      const previous=l.previous,old=previous?parameterValue(previous,Math.min(l.selected,previous.hiddenUnits-1),this.parameter):null;
      section.innerHTML=`<div class="explore-line-proof"><strong>${old===null?'슬라이더를 움직여 보세요':`${PARAMS[this.parameter]} ${n(old)} → ${n(parameterValue(m,l.selected,this.parameter))}`}</strong><p>${zeroWeights?'두 곱할 수가 모두 0이면 모든 점의 합이 같아서, 한 개의 기준선이 생기지 않아요.':(this.parameter==='bias'?'더할 수를 바꾸면 같은 방향의 선이 자리를 옮겨요.':'곱할 수를 바꾸면 선의 방향과 뉴런 값이 달라질 수 있어요.')+' 합이 0인 자리를 다시 찾기 때문이에요.'}</p></div><details><summary>왜 이 자리에 선이 생길까요?</summary><p>${z?`선 위의 점 (${n(z[0])}, ${n(z[1])})`:allZero?'모든 점의 합이 0이라 하나의 선으로 정해지지 않아요':'화면 안에 합이 0인 선이 없어요'}</p>${z?`<strong>${n(z[0])} × (${n(w[0]!)}) + ${n(z[1])} × (${n(w[1]!)}) + (${n(m.hiddenBias[l.selected]!)}) ≈ 0.00</strong>`:''}<p>합이 0인 점들을 이으면 색 선이 됩니다. 최종 클래스 경계는 다음 장면에서 함께 봐요. 처음 수는 실험용 시작값입니다.</p></details>`;
      observation.innerHTML='';return;
    }
    const row=this.source.data[l.pointIndex??0],baseline=this.trial??m;
    const predicted=manualPrediction(m,point);
    const feedback=row?`<p class="output-summary">정답 <b style="color:${this.color(row.label)}">${escape(s.classes[row.label]!)}</b> · 가장 큰 점수의 답 <b style="color:${predicted===null?'inherit':this.color(predicted)}">${predicted===null?'동점':escape(s.classes[predicted]!)}</b></p>`:'';
    if(this.chapter===2){
      if(!row){section.textContent='자료를 먼저 추가해 주세요.';observation.innerHTML='';return;}
      const d=learningDirection(m,s.data,l.selected,this.parameter);
      const toward=Math.abs(d.gradient)<1e-9?'전체 자료 기준 · 지금은 수정 방향이 0이에요':d.gradient>0?'전체 자료 기준 · 이 수를 조금 줄이는 쪽 ←':'전체 자료 기준 · 이 수를 조금 늘리는 쪽 →';
      const expanded=section.querySelector('details')?.open??false;
      section.innerHTML=predictionEvidence(m,baseline,s.data,l.pointIndex??0,l.selected,this.parameter,s.classes,toward,expanded);
      observation.innerHTML='';return;
    }
    if(!this.outputChosen){section.innerHTML='<p class="empty-choice">위에서 클래스를 선택하면 그 답으로 가는 연결을 조절할 수 있어요.</p>';observation.innerHTML='';return;}
    const hidden=forwardPixels(m,point).hidden[l.selected]!,weight=m.hiddenOutput[l.output]![l.selected]!,gradient=outputWeightGradient(m,s.data,l.selected,l.output);
    section.innerHTML=`<p class="learning-direction">${Math.abs(gradient)<1e-9?'현재 이 연결의 수정 방향은 0이에요':gradient>0?'모든 자료를 함께 보면: 이 가중치를 조금 줄이는 방향 ←':'모든 자료를 함께 보면: 이 가중치를 조금 늘리는 방향 →'}</p><div class="explore-weight-result" data-zero="${hidden===0}" aria-live="polite"><span>뉴런 ${l.selected+1}에서 받은 값</span><strong>${n(hidden)} × ${n(weight)} = ${n(hidden*weight)}</strong><span>${weight===0?'이 연결은 0점을 더해요. 다른 연결의 값은 그대로예요.':weight===1?'받은 값을 그대로 이 답의 점수에 더해요.':weight<0?'받은 값에 곱한 만큼 이 답의 점수에서 빼요.':'받은 값에 곱한 만큼 이 답의 점수에 더해요.'}${hidden===0?' 지금 고른 점의 뉴런 값은 0이므로 곱할 수를 바꿔도 이 연결은 0이에요.':''}</span></div><div class="explore-output-nodes"><small>은닉 뉴런 ${m.hiddenUnits}개 → 출력은 클래스 수인 ${s.classes.length}개</small></div>${feedback}`;
    observation.innerHTML='<details><summary>모델은 연결값을 어떻게 정하나요?</summary><p>고른 클래스가 정답인데 그 답에 준 몫이 부족하면 이 연결값을 늘리는 쪽으로, 다른 클래스가 정답이면 줄이는 쪽으로 수정 신호가 생겨요. 받은 뉴런 값이 클수록 더 크게 영향을 주고, 0이면 이 연결의 수정에 영향을 주지 않아요. 모든 자료의 수정 신호를 평균내어 조금씩 고칩니다.</p><p>곱하는 수는 뉴런 값을 이 답에 얼마나 사용할지 정합니다. 값은 0 또는 1 중 고르는 것이 아닙니다. 예를 들어 × 0.50이면 절반을 더해요. 0인 연결도 다음 학습에서 바뀔 수 있어요. 음수는 빼 줍니다.</p><p>서로 다른 기준을 섞어서 최종 경계가 꺾일 수 있지만, 늘리기만 해서는 좋아지지 않아요. 직접 비율을 바꾸거나 학습한 뒤 비교하세요. 연습에서는 새 자료로도 확인합니다.</p></details>';
  }
  private input(event:Event):void {
    const el=event.target as HTMLInputElement,id=el.dataset.knob;if(!id)return;this.stop();const v=Number(el.value);this.status='';

    if(id==='kick'||id==='keeper'){const p=[...this.lab.point];p[id==='kick'?0:1]=v;this.lab.choosePoint(p,null);this.log('simulation_action',{operation:id,value:v,coordinates:p});}else {
      const l=this.lab,m=l.model,previous=id==='connection'?m.hiddenOutput[l.output]![l.selected]!:id==='outputBias'?m.outputBias[l.output]!:parameterValue(m,l.selected,id as InputParameter);
      this.lab.edit(id as ManualParameter,v);if(id in PARAMS&&Math.abs(v-previous)>1e-9){if(this.chapter===1)this.touched[1]!.add(id);if(this.chapter===2){const rows=this.source.data,base=this.trial??m;const improvement=evaluatePixelModel(base,rows).loss-evaluatePixelModel(l.model,rows).loss;const noDirection=Math.abs(learningDirection(base,rows,l.selected,id as InputParameter).gradient)<1e-9;if(improvement>1e-9||noDirection)this.touched[2]!.add(id);}}this.logModelVersion++;
      this.log('parameter_change',{parameter:id,previous,value:v,neuron:l.selected,output:l.output,sampleId:l.pointIndex??-1,coordinates:l.point,loss:evaluatePixelModel(l.model,this.source.data).loss,probabilities:forwardPixels(l.model,l.point).probabilities});
    }
    if(this.chapter===2&&Math.abs(v-parameterValue(this.trial!,this.lab.selected,this.parameter))>1e-9)this.tried=true;
    this.refresh();
  }
  private change(event:Event):void {
    const select=event.target as HTMLSelectElement;
    if(select.matches('[data-row]'))this.log('sample_select',{sampleId:Number(select.value),operation:'select'});
    if(select.matches('[data-parameter]'))this.log('visualization_change',{parameter:select.value,neuron:this.lab.selected});
    if(select.matches('[data-row]')){const i=Number(select.value);this.stop();this.onLine=false;this.chosePoint=true;this.lab.choosePoint(this.source.data[i]!.pixels,i);this.popup=this.chapter>0;if(this.chapter>=2)this.startTrial();this.refresh();}
    if(select.matches('[data-parameter]')){this.parameter=select.value as InputParameter;this.startTrial();this.status='';this.inputKey='';this.render();}
    if(select.matches('[data-output]')){this.outputChosen=true;this.lab.output=Number(select.value);this.startTrial();this.status='';this.inputKey='';this.render();}
    if(select.matches('[data-feature]')){
      if(this.projection.running){select.value=this.source.featureIds![Number(select.dataset.feature)]!;return;}
      if(!select.value)return;
      const axis=Number(select.dataset.feature) as 0|1,firstChoice=!this.chosenAxes[axis],from=this.coordinates(),previous=this.source.featureIds![axis];
      const selectedRow=this.lab.pointIndex??0;
      const axes=[...this.source.featureIds!] as [string,string];axes[axis]=select.value;this.stop();
      this.status=this.options.setAxes?.(...axes)??'';
      if(!this.status)this.chosenAxes[axis]=true;this.inputKey='';this.render();
      this.log('feature_change',{axis,featureX:this.source.featureIds![0],featureY:this.source.featureIds![1],valid:this.source.featureIds![axis]===axes[axis]});
      if(this.source.featureIds![axis]===axes[axis]&&(previous!==axes[axis]||firstChoice)){
        const first=this.placing===0;this.axis=axis;this.placing=Math.max(this.placing,axis+1) as 1|2;if(axis===1)this.oneAxis=false;
        if(this.source.data[selectedRow])this.lab.choosePoint(this.source.data[selectedRow]!.pixels,selectedRow);this.popup=false;this.inputKey='';this.render();
        this.projection.start(first?'place':'shift',first?[]:from,this.coordinates(),axis,selectedRow);
      }
    }
  }
  private click(event:Event):void {
    const pixel=(event.target as Element).closest<SVGElement>('[data-pixel]');if(pixel&&this.chapter===0){this.featureFrame=Number(pixel.dataset.pixel);this.refresh();return;}
    const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;
    if(b.dataset.parameterChoice){this.parameter=b.dataset.parameterChoice as InputParameter;this.parameterChosen=true;this.startTrial();this.status='';this.inputKey='';this.log('visualization_change',{parameter:this.parameter,neuron:this.lab.selected});this.render();return;}
    if(b.dataset.exploreChapter!==undefined)return this.goTo(Number(b.dataset.exploreChapter));
    if(b.hasAttribute('data-explore-next')){if((b as HTMLButtonElement).disabled)return;if(this.chapter===0&&this.placing<2){const from=this.coordinates(),axis=this.placing as 0|1;this.stop();this.axis=axis;this.placing=(axis+1) as 1|2;this.oneAxis=axis===0;this.inputKey='';this.render();this.projection.start(axis===0?'place':'shift',axis===0?[]:from,this.coordinates(),axis,this.lab.pointIndex??0);return;}if(this.chapter===3){this.stop();this.options.complete();}else this.goTo(this.chapter+1);return;}
    if(b.hasAttribute('data-explore-back')){if(this.chapter===0)this.options.back?.();else this.goTo(this.chapter-1);return;}
    if(b.hasAttribute('data-close-point')){this.popup=false;this.refresh();return;}
    if(b.dataset.neuron!==undefined){this.lab.selected=Number(b.dataset.neuron);this.startTrial();this.status='';this.inputKey='';this.render();return;}
    if(b.hasAttribute('data-restart-trial')){this.startTrial();this.status='';this.refresh();return;}
    if(b.dataset.axis!==undefined){this.axis=Number(b.dataset.axis) as 0|1;this.featureFrame=-1;this.inputKey='';this.render();this.projection.start('shift',this.coordinates(),this.coordinates(),this.axis,this.lab.pointIndex??0);return;}
    if(b.dataset.dimension!==undefined){
      const from=this.coordinates(),oneAxis=b.dataset.dimension==='1';this.stop();
      if(oneAxis===this.oneAxis){this.refresh();return;}
      this.oneAxis=oneAxis;this.popup=false;this.inputKey='';this.render();
      this.log('visualization_change',{operation:'projection-dimension',axis:1,value:oneAxis?1:2});
      this.projection.start('shift',from,this.coordinates(),1,this.lab.pointIndex??0,false);return;
    }
    if(b.hasAttribute('data-add-neuron')){this.lab.addNeuron();this.logModelVersion++;this.log('neuron_change',{operation:'add',hiddenUnits:this.lab.model.hiddenUnits});this.status='새 기준선이 생겼어요. 아직 곱할 수가 0이라 답은 그대로입니다. 슬라이더로 연결해 보세요.';}
    if(b.hasAttribute('data-remove-neuron')){this.lab.removeNeuron();this.logModelVersion++;this.log('neuron_change',{operation:'remove',hiddenUnits:this.lab.model.hiddenUnits});}
    if(b.hasAttribute('data-undo')){this.lab.undo();this.logModelVersion++;this.log('simulation_action',{operation:'undo'});}
    if(b.hasAttribute('data-learn-one')){
      if(!this.tried)return;
      const base=this.trial!,d=learningDirection(base,this.source.data,this.lab.selected,this.parameter);
      this.lab.applyModel(withParameter(base,this.lab.selected,this.parameter,d.next));
      this.logModelVersion++;this.log('simulation_action',{operation:'learn-one',parameter:this.parameter,neuron:this.lab.selected,previous:d.value,value:d.next,gradient:d.gradient,rate:d.rate,loss:d.nextLoss});
      this.status=d.next===d.value?'이 출발점에서는 이 수를 바꿀 방향이 나오지 않았어요. 다른 수나 뉴런도 살펴보세요.':n(d.value)===n(d.next)?`모델은 이 수를 아주 조금 ${d.next<d.value?'줄였어요':'늘렸어요'}. 둘째 자리로 표시하면 같지만, 실제 값과 선은 변합니다.`:`전체 자료를 함께 보고 모델은 ${n(d.value)} → ${n(d.next)}로 고쳤어요. 계산값과 선을 비교하세요.`;
    }
    if(b.hasAttribute('data-train')||b.hasAttribute('data-train-many')){this.stop();const count=b.hasAttribute('data-train-many')?50:1;this.lab.applyModel(trainPixelModel(this.lab.model,this.source.data,count,.1));this.logModelVersion++;this.log('simulation_action',{operation:'train',epochs:count,loss:evaluatePixelModel(this.lab.model,this.source.data).loss});this.status=`모든 연결을 ${count}번 학습했어요. 색 선과 검은 경계를 비교하세요.`;}
    if(b.hasAttribute('data-play-math')){this.stop();this.phase=0;this.refresh();this.timer=window.setInterval(()=>{this.phase++;if(this.phase>2){window.clearInterval(this.timer);this.timer=0;this.phase=-1;}this.refresh();},650);return;}
    this.inputKey='';this.render();
  }
}
