import { ManualLab, copyModel, manualPrediction, manualScore, type ManualParameter } from '../core/manualLab';
import { evaluatePixelModel, forwardPixels, type PixelModel } from '../core/pixelNetwork';
import type { ExplorationSource } from '../core/explorationSource';
import { drawPixelLatentMap, pixelMapExampleAt } from '../visualization/pixelLatentMap';
import { NEURON_COLORS } from '../visualization/neuronColors';

interface JourneyOptions {
  source:()=>ExplorationSource; context:()=>string; complete:()=>void; back?:()=>void;
  setAxes?:(x:string,y:string)=>string|null;
  featureEditor?:(host:HTMLElement)=>void;
}
const CHAPTERS=['자료를 숫자로','분포 살피기','뉴런 고치기','답 합치기'];
const IDENTITY={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
const COLORS=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
const n=(value:number)=>Math.abs(value)<.005?'0.00':value.toFixed(2);
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const color=(i:number)=>COLORS[i%COLORS.length]!;
const neuronColor=(i:number)=>NEURON_COLORS[i%NEURON_COLORS.length]!;

/** A sandbox using the learner's actual rows. No answer key or forced slider target. */
export class UnderstandingJourney {
  readonly root:HTMLElement;
  private chapter=0;private source!:ExplorationSource;private lab!:ManualLab;private signature='';
  private axis:0|1=0;private filter=-1;private oneAxis=false;private timer=0;private phase=-1;
  private animation:PixelModel|null=null;private baseline:PixelModel|null=null;private logs:string[]=[];private status='';
  private inputKey='';private featureFrame=-1;
  constructor(root:HTMLElement,private options:JourneyOptions) {
    this.root=root;root.className='image-workspace understanding-journey exploration-journey';
    root.innerHTML=`<nav class="explore-nav" aria-label="이해 순서">${CHAPTERS.map((s,i)=>`<button data-explore-chapter="${i}"><span>${i+1}</span> ${s}</button>`).join('')}</nav>
      <div class="explore-body"><section class="explore-visual"><header><strong data-map-title></strong><span data-map-count></span></header>
        <div class="explore-map"><canvas aria-label="실제 자료의 분포와 뉴런 기준선"></canvas></div>
        <div class="explore-point"></div><div class="explore-network" aria-label="입력에서 은닉 뉴런과 출력으로 이어지는 연결 지도"></div>
        <div class="explore-key"></div></section>
      <section class="explore-action"><div class="explore-content"><h2></h2><p class="explore-instruction"></p><div class="explore-controls"></div><div class="explore-feature-tools"></div><div class="explore-equation"></div><div class="explore-observation"></div></div>
        <p class="explore-status" role="status" aria-live="polite"></p><footer><button data-explore-back>← 이전</button><button data-explore-next class="button primary">다음 →</button></footer></section></div>`;
    options.featureEditor?.(this.el('.explore-feature-tools'));
    root.addEventListener('click',e=>this.click(e));root.addEventListener('input',e=>this.input(e));root.addEventListener('change',e=>this.change(e));
    root.addEventListener('pointerdown',e=>{if((e.target as Element).matches('[data-knob]'))this.lab.beginGesture();});
    for(const event of ['pointerup','pointercancel','change'])root.addEventListener(event,()=>this.lab?.endGesture());
    this.el<HTMLCanvasElement>('canvas').addEventListener('pointerdown',event=>{
      const index=pixelMapExampleAt(this.el('canvas'),event.clientX,event.clientY,IDENTITY,this.displayData());
      if(index===null)return;this.stop();this.lab.choosePoint(this.source.data[index]!.pixels,index);this.refresh();
    });
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!root.hidden&&this.lab)this.draw();}).observe(this.el('.explore-map'));
    this.render();
  }
  private el<T extends HTMLElement=HTMLElement>(s:string):T{return this.root.querySelector<T>(s)!;}
  stop():void {window.clearInterval(this.timer);this.timer=0;this.animation=null;this.phase=-1;this.featureFrame=-1;}
  reset():void {this.stop();this.chapter=0;this.axis=0;this.oneAxis=false;this.status='';this.signature='';this.inputKey='';this.logs=[];this.baseline=null;}
  show(visible:boolean):void {this.root.hidden=!visible;if(visible)this.render();else this.stop();}
  goTo(chapter:number):void {this.stop();this.chapter=Math.max(0,Math.min(3,chapter));this.inputKey='';this.status='';this.render();}
  render():void {
    this.source=this.options.source();
    const key=JSON.stringify([this.source.kind,this.source.data,this.source.classes,this.source.axes]);
    if(key!==this.signature){this.stop();this.signature=key;this.lab=new ManualLab('data',this.source);this.baseline=null;this.inputKey='';this.logs=[];this.filter=-1;}
    this.root.dataset.chapter=String(this.chapter);
    this.root.querySelectorAll<HTMLElement>('[data-explore-chapter]').forEach(b=>b.setAttribute('aria-current',Number(b.dataset.exploreChapter)===this.chapter?'step':'false'));
    this.el('[data-explore-back]').textContent=this.chapter?'← 이전':'← 자료 보기';
    this.el<HTMLButtonElement>('[data-explore-back]').disabled=this.chapter===0&&!this.options.back;
    this.el('[data-explore-next]').textContent=this.chapter===3?'내 자료로 연습하기 →':'다음 →';
    this.renderControls();this.refresh();
  }
  private renderControls():void {
    const s=this.source,m=this.lab.model;
    const headings=s.kind==='penalty'?['두 방향을 숫자로 기록해요','막힘과 골은 어디에 모일까요?','은닉 뉴런은 작은 계산기예요','여러 계산을 섞어 답을 골라요']:['그림에서 두 숫자를 꺼내요','구별에 도움이 되는 특징을 찾아요','은닉 뉴런은 작은 계산기예요','여러 계산을 섞어 답을 골라요'];
    const instructions=[s.kind==='penalty'?'왼쪽은 −, 가운데는 0, 오른쪽은 +. 슬라이더로 두 방향을 바꿔 보세요.':'실제 그림 한 장을 골라, 어떤 칸을 더하고 빼는지 재생해 보세요.',s.kind==='penalty'?'키커 방향만 보면 겹치는 자료가 있나요? 골키퍼 방향도 함께 보세요.':'축을 바꿔 보세요. 서로 다른 정답의 점이 겹치면 이 두 특징만으로는 구별하기 어려워요.','처음 수는 실험용으로 정한 값입니다. 한 수만 바꾸면 계산과 선은 어떻게 달라질까요?','뉴런마다 반응하는 쪽이 달라요. 연결값을 바꿔 최종 경계가 꺾이는지 비교해 보세요.'];
    this.el('h2').textContent=headings[this.chapter]!;this.el('.explore-instruction').textContent=instructions[this.chapter]!;
    this.el('.explore-feature-tools').hidden=this.chapter!==1;
    const key=JSON.stringify([this.chapter,s.axes,s.features?.map(f=>[f.id,f.name]),s.classes,m.hiddenUnits,this.lab.selected,this.lab.output,this.axis]);
    if(this.inputKey===key)return;this.inputKey=key;
    const range=(id:string,label:string,value:number,min=-2,max=2,step=.01)=>`<label class="explore-knob">${label}<output data-knob-value="${id}">${n(value)}</output><input type="range" data-knob="${id}" aria-label="${label}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
    const selectRows=`<label class="explore-row-choice"> 살펴볼 자료<select data-row aria-label="살펴볼 자료">${s.data.map((r,i)=>`<option value="${i}" ${this.lab.pointIndex===i?'selected':''}>${i+1}번 · 정답 ${escape(s.classes[r.label]??'?')}</option>`).join('')}</select></label>`;
    let html='';
    if(this.chapter===0){
      html=selectRows+(s.kind==='penalty'?`<div class="explore-direction">← 왼쪽 <span>가운데 0</span> 오른쪽 →</div>${range('kick','키커 방향',this.lab.point[0]!,-1,1,.01)}${range('keeper','골키퍼 방향',this.lab.point[1]!,-1,1,.01)}`:`<div class="explore-toggle"><button data-axis="0" aria-pressed="${this.axis===0}">가로 계산</button><button data-axis="1" aria-pressed="${this.axis===1}">세로 계산</button><button data-next-cell>한 칸씩</button><button data-play-cells>재생 / 멈춤</button></div>`);
    }else if(this.chapter===1){
      const features=s.features;
      html=features?`<div class="explore-axes">${(['가로 특징','세로 특징'] as const).map((title,i)=>`<label>${title}<select data-feature="${i}" aria-label="${title}">${features.map(f=>`<option value="${escape(f.id)}" ${s.featureIds![i]===f.id?'selected':''}>${escape(f.name)}</option>`).join('')}</select></label>`).join('')}</div>`:'';
      html+=`<div class="explore-toggle"><button data-dimension="1" aria-pressed="${this.oneAxis}">가로만 보기</button><button data-dimension="2" aria-pressed="${!this.oneAxis}">두 특징 함께</button></div><div class="explore-class-filter"><button data-filter="-1" aria-pressed="${this.filter===-1}">전체</button>${s.classes.map((c,i)=>`<button data-filter="${i}" style="--class-color:${color(i)}" aria-pressed="${this.filter===i}">${escape(c)} · ${s.data.filter(r=>r.label===i).length}</button>`).join('')}</div>${selectRows}<p class="explore-note">점의 색은 자료에 붙인 정답입니다. 위치는 고른 두 숫자만으로 정해져요.</p>`;
    }else{
      html=`<div class="explore-neuron-choice">${Array.from({length:m.hiddenUnits},(_,i)=>`<button data-neuron="${i}" style="--neuron:${neuronColor(i)}" aria-pressed="${this.lab.selected===i}">뉴런 ${i+1}</button>`).join('')}${this.chapter===3?`<button data-add-neuron ${m.hiddenUnits>=4?'disabled':''}>+ 추가</button><button data-remove-neuron ${m.hiddenUnits<=1?'disabled':''}>−</button>`:''}</div>`;
      if(this.chapter===2){html+=range('xWeight','가로에 곱할 수',m.inputHidden[this.lab.selected]![0]!)+range('yWeight','세로에 곱할 수',m.inputHidden[this.lab.selected]![1]!)+range('bias','마지막에 더할 수',m.hiddenBias[this.lab.selected]!);}
      else html+=`<label>고칠 출력<select data-output aria-label="고칠 출력">${s.classes.map((c,i)=>`<option value="${i}" ${i===this.lab.output?'selected':''}>${escape(c)}</option>`).join('')}</select></label>`+range('connection',`뉴런 ${this.lab.selected+1}에 곱할 수`,m.hiddenOutput[this.lab.output]![this.lab.selected]!)+range('outputBias','출력에 더할 수',m.outputBias[this.lab.output]!);
      html+=`<div class="explore-tools"><button data-anchor>비교 시작점 저장</button><button data-replay>변화 재생 ▶</button><button data-undo aria-label="값 변경 되돌리기">↶</button>${this.chapter===2?'<button data-play-math>계산 재생 ▶</button>':''}</div>`;
    }
    this.el('.explore-controls').innerHTML=html;
  }
  private displayData(){return this.source.data.map(r=>({...r,pixels:this.chapter===1&&this.oneAxis?[r.pixels[0]!,0]:r.pixels}));}
  private draw():void {
    const point=this.chapter===1&&this.oneAxis?[this.lab.point[0]!,0]:this.lab.point;
    drawPixelLatentMap(this.el('canvas'),this.animation??this.lab.model,this.displayData(),point,IDENTITY,{
      view:this.chapter<2?'placement':'decision',showNeuronBoundaries:this.chapter>=2,onlyNeuron:this.chapter===2?this.lab.selected:undefined,
      showDecisionBoundary:this.chapter===3,showValueDirection:false,previousNeuronModel:this.chapter>=2?this.baseline??this.lab.previous:undefined,
      focusLabel:this.source.kind==='penalty'?'선택한 승부차기':'선택한 그림',neutralTies:true,classLabels:this.source.classes,emphasizeClass:this.filter<0?undefined:this.filter,
      axisLegend:{horizontal:{title:this.source.axes[0],negative:'',positive:''},vertical:{title:this.chapter===1&&this.oneAxis?'세로 특징을 보지 않음':this.source.axes[1],negative:'',positive:''}},resolution:65,
    });
  }
  private refresh():void {
    const s=this.source,l=this.lab,m=this.animation??l.model,point=l.point;
    const selected=l.pointIndex,product=point[0]! * point[1]!;
    const label=selected===null?(s.kind==='penalty'?(product===0?null:product<0?1:0):null):s.data[selected]?.label??null;
    const answer=manualPrediction(m,point);
    this.el('[data-map-title]').textContent=this.chapter<2?'모은 자료의 분포':'값을 바꾸면 선도 달라져요';this.el('[data-map-count]').textContent=`${s.data.length}개 자료`;
    const mini=s.pictures&&selected!==null?this.picture(s.pictures[selected]!,this.featureFrame):'';
    const penalty=s.kind==='penalty'?`<div class="explore-goal" aria-label="키커와 골키퍼 방향"><span style="left:${(point[0]!+1)*44+6}%" class="kick">공</span><span style="left:${(point[1]!+1)*44+6}%" class="keeper">골키퍼</span></div>`:'';
    this.el('.explore-point').innerHTML=`${mini||penalty}<div><span>${selected===null?'슬라이더로 만든 임시 사례':`${selected+1}번 자료`} · (${n(point[0]!)}, ${n(point[1]!)})</span><strong>정답 <b style="color:${label===null?'inherit':color(label)}">${label===null?'가운데 방향은 판정하지 않아요':escape(s.classes[label]??'?')}</b>${this.chapter>=2?` <span>→</span> 예상 <b style="color:${answer===null?'inherit':color(answer)}">${answer===null?'동점':escape(s.classes[answer]??'?')}</b>`:''}</strong></div>`;
    this.renderNetwork(m);
    this.el('.explore-key').innerHTML=this.chapter<2?'<span>그림·상황 → 두 숫자 → 그래프의 점</span>':this.chapter===2?`<span style="color:${neuronColor(l.selected)}">색 선: 뉴런의 더한 값이 0인 곳</span><span>음수는 0, 양수는 그대로 출력</span>`:'<span>색 선: 각 뉴런의 기준</span><span>검은 선: 가장 큰 답 점수가 바뀌는 곳</span>';
    this.renderEquation(m);
    if(this.chapter<2)this.el('.explore-observation').innerHTML=`<details><summary>이 실험과 연습의 관계</summary><p>${escape(s.note)}</p></details>`;
    else{
      const before=this.baseline??l.previous,old=before?manualScore(before,s.data):null,loss=evaluatePixelModel(m,s.data).loss;
      this.el('.explore-observation').innerHTML=`<div class="explore-score"><span>맞힌 자료 <b>${old===null?'':`${old} → `}${manualScore(m,s.data)} / ${s.data.length}</b></span><button data-record>변화 기록</button>${this.chapter===3?'<button data-train>자동으로 1번 고치기</button>':''}</div>${this.chapter===3?`<small>오차 ${n(loss)} · 정답률이 같아도 학습은 진행될 수 있어요.</small>`:''}<div class="explore-log">${this.logs.slice(-1).map(t=>`<p>${escape(t)}</p>`).join('')}</div>`;
    }
    for(const input of this.root.querySelectorAll<HTMLInputElement>('[data-knob]')){
      const id=input.dataset.knob!,values:Record<string,number>={kick:point[0]!,keeper:point[1]!,xWeight:m.inputHidden[l.selected]![0]!,yWeight:m.inputHidden[l.selected]![1]!,bias:m.hiddenBias[l.selected]!,connection:m.hiddenOutput[l.output]![l.selected]!,outputBias:m.outputBias[l.output]!};
      if(id!=='kick'&&id!=='keeper'){input.min=String(-l.parameterLimit);input.max=String(l.parameterLimit);}
      if(document.activeElement!==input)input.value=String(values[id]);this.el(`[data-knob-value="${id}"]`).textContent=n(values[id]!);
    }
    const row=this.root.querySelector<HTMLSelectElement>('[data-row]');if(row&&selected!==null)row.value=String(selected);
    this.el('.explore-status').textContent=this.status;this.root.dataset.animationPhase=String(this.phase);this.draw();
  }
  private picture(pixels:number[],active=-1):string {
    return `<svg class="explore-picture" viewBox="0 0 14 14" role="img" aria-label="선택한 실제 입력 그림">${pixels.map((v,i)=>`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="rgb(${Math.round(255*(1-v))} ${Math.round(255*(1-v))} ${Math.round(255*(1-v))})" stroke="${active===i?'#f17605':'#ddd'}" stroke-width="${active===i?.3:.025}"/>`).join('')}</svg>`;
  }
  private renderNetwork(m:PixelModel):void {
    const f=forwardPixels(m,this.lab.point),winner=manualPrediction(m,this.lab.point),steps=this.chapter>=2;
    this.el('.explore-network').innerHTML=`<div class="explore-input-node"><small>입력</small><b>${n(this.lab.point[0]!)}</b><b>${n(this.lab.point[1]!)}</b></div><span class="explore-wire">→</span><div class="explore-hidden-nodes"><small>은닉 뉴런 · 입력과 답 사이의 계산기</small><div>${f.hidden.map((h,i)=>`<button data-neuron="${i}" style="--neuron:${neuronColor(i)}" aria-pressed="${this.lab.selected===i}" aria-label="연결 지도 뉴런 ${i+1}"><span>${i+1}</span>${steps?`<b>${n(h)}</b>`:''}</button>`).join('')}</div></div><span class="explore-wire">→</span><div class="explore-output-nodes"><small>출력 · 답 종류마다 하나</small><div>${this.source.classes.map((c,i)=>`<span style="--class-color:${color(i)}" class="${this.chapter===3&&winner===i?'winning':''}">${escape(c)}${this.chapter===3?` <b>${n(f.logits[i]!)}</b>`:''}</span>`).join('')}</div></div>`;
  }
  private renderEquation(m:PixelModel):void {
    const l=this.lab,p=l.point,w=m.inputHidden[l.selected]!,sum=w[0]!*p[0]!+w[1]!*p[1]!+m.hiddenBias[l.selected]!,f=forwardPixels(m,p);
    let html='';
    if(this.chapter===0){
      if(this.source.kind==='penalty')html=`<div class="explore-calculation"><span>키커 ${n(p[0]!)} → 가로</span><span>골키퍼 ${n(p[1]!)} → 세로</span></div><p>두 방향을 한 쌍으로 기록하면 점 하나가 됩니다. 점의 위치가 달라도 방향이 같으면 같은 정답이에요.</p>`;
      else{
        const c=this.source.axisCalculation?.(l.pointIndex??0,this.axis),feature=this.source.features?.find(f=>f.id===this.source.featureIds?.[this.axis]);
        if(c){const term=this.featureFrame>=0?c.terms[this.featureFrame]:null,subtotal=this.featureFrame>=0?c.terms.slice(0,this.featureFrame+1).reduce((v,t)=>v+t.product,0):c.total;
          html=`<strong>${escape(feature?.name??'')} 계산</strong><p>${escape(feature?.description??'')}</p><div class="explore-calculation">${term?`<span>${Math.floor(this.featureFrame/14)+1}행 ${this.featureFrame%14+1}열: 진하기 ${n(term.pixel)} × ${n(term.weight)} = ${n(term.product)}</span><strong>여기까지 더하면 ${n(subtotal)}</strong>`:`<span>더하는 부분 ${n(c.positive)} + 빼는 부분 (${n(c.negative)})</span><strong>그림의 특징값 ${n(c.total)}</strong>`}</div><details><summary>이 값이 좌표 ${n(c.coordinate)}가 되는 이유</summary><p>모든 자료의 평균 ${n(c.mean)}을 빼고, 같은 수 ${n(c.scale)}로 나눠 그래프 안에 맞춥니다.</p><strong>(${n(c.total)} − ${n(c.mean)}) ÷ ${n(c.scale)} ≈ ${n(c.coordinate)}</strong><p>정답을 보고 정한 수가 아니에요. 반올림 전 값으로 계산합니다.</p></details>`;
        }else html='<p>먼저 자료 단계에서 그림을 모아 주세요.</p>';
      }
    }else if(this.chapter===1)html=this.oneAxis?'<p>두 번째 정보를 빼면 같은 자리에 겹칠 수 있어요.</p>':'';
    else if(this.chapter===2)html=`<div class="explore-calculation" data-calculation><span class="phase-input">${this.phase===1?`${n(p[0]!*w[0]!)} + (${n(p[1]!*w[1]!)}) + (${n(m.hiddenBias[l.selected]!)})`:`${n(p[0]!)} × ${n(w[0]!)} + (${n(p[1]!)}) × ${n(w[1]!)} + (${n(m.hiddenBias[l.selected]!)})`}</span><strong class="phase-sum">더하면 ${n(sum)} → <b class="phase-result">보낼 값 ${n(f.hidden[l.selected]!)}</b></strong></div>`;
    else{
      const c=l.output;html=`<div class="explore-calculation"><span>${escape(this.source.classes[c]!)} 점수 = ${f.hidden.map((h,i)=>`${n(h)} × ${n(m.hiddenOutput[c]![i]!)}`).join(' + ')} + (${n(m.outputBias[c]!)})</span><strong>${n(f.logits[c]!)} <small>가장 큰 점수의 답을 고릅니다. 확률이 아니에요.</small></strong></div>`;
    }
    this.el('.explore-equation').innerHTML=html;
  }
  private input(event:Event):void {
    const el=event.target as HTMLInputElement,id=el.dataset.knob;if(!id)return;this.stop();const v=Number(el.value);this.status='';
    if(id==='kick'||id==='keeper'){const point=[...this.lab.point];point[id==='kick'?0:1]=v;this.lab.choosePoint(point,null);}else this.lab.edit(id as ManualParameter,v);
    this.refresh();
  }
  private change(event:Event):void {
    const select=event.target as HTMLSelectElement;
    if(select.matches('[data-row]')){const i=Number(select.value);this.stop();this.lab.choosePoint(this.source.data[i]!.pixels,i);this.refresh();}
    if(select.matches('[data-output]')){this.lab.output=Number(select.value);this.inputKey='';this.render();}
    if(select.matches('[data-feature]')){const axes=[...this.source.featureIds!] as [string,string];axes[Number(select.dataset.feature)]=select.value;this.status=this.options.setAxes?.(...axes)??'특징을 바꿨어요. 점을 비교해 보세요. 실험 모델은 처음 상태입니다.';this.inputKey='';this.render();}
  }
  private click(event:Event):void {
    const b=(event.target as Element).closest<HTMLElement>('button');if(!b)return;
    if(b.dataset.exploreChapter!==undefined)return this.goTo(Number(b.dataset.exploreChapter));
    if(b.hasAttribute('data-explore-next')){if(this.chapter===3){this.stop();this.options.complete();}else this.goTo(this.chapter+1);return;}
    if(b.hasAttribute('data-explore-back')){if(this.chapter===0)this.options.back?.();else this.goTo(this.chapter-1);return;}
    if(b.dataset.neuron!==undefined){this.lab.selected=Number(b.dataset.neuron);this.inputKey='';this.render();return;}
    if(b.dataset.axis!==undefined){this.axis=Number(b.dataset.axis) as 0|1;this.stop();this.inputKey='';this.render();return;}
    if(b.dataset.filter!==undefined){this.filter=Number(b.dataset.filter);this.inputKey='';this.render();return;}
    if(b.dataset.dimension!==undefined){this.oneAxis=b.dataset.dimension==='1';this.inputKey='';this.render();return;}
    if(b.hasAttribute('data-add-neuron')){this.lab.addNeuron();this.status='출력 연결이 0이라 답은 그대로예요. 곱할 수를 바꾸어 연결해 보세요.';}
    if(b.hasAttribute('data-remove-neuron'))this.lab.removeNeuron();
    if(b.hasAttribute('data-undo'))this.lab.undo();
    if(b.hasAttribute('data-anchor')){this.baseline=copyModel(this.lab.model);this.status='지금 선을 회색 비교선으로 남겼어요. 수 하나를 바꿔 보세요.';}
    if(b.hasAttribute('data-record')){const l=this.lab,old=this.baseline??l.previous;this.logs.push(`뉴런 ${l.model.hiddenUnits}개 · 맞힌 자료 ${old?manualScore(old,this.source.data):l.score} → ${l.score}/${this.source.data.length} · 뉴런 ${l.selected+1}: 가로 ×${n(l.model.inputHidden[l.selected]![0]!)} / 세로 ×${n(l.model.inputHidden[l.selected]![1]!)} / 더하기 ${n(l.model.hiddenBias[l.selected]!)}`);this.status='최근 실험을 기록했어요. 다른 점도 눌러 같은 계산을 확인해 보세요.';}
    if(b.hasAttribute('data-train')){this.stop();this.lab.trainStep();this.status='모든 자료의 오차를 줄이도록 수를 조금 고쳤어요. 회색은 고치기 전 선입니다.';this.replay();return;}
    if(b.hasAttribute('data-replay')){this.replay();return;}
    if(b.hasAttribute('data-play-math')){this.animate(t=>this.phase=Math.min(2,Math.floor(t*3)),1800);return;}
    if(b.hasAttribute('data-next-cell')){const start=this.featureFrame;this.stop();const terms=this.source.axisCalculation?.(this.lab.pointIndex??0,this.axis).terms??[];this.featureFrame=terms.findIndex((t,i)=>i>start&&t.product!==0);this.refresh();return;}
    if(b.hasAttribute('data-play-cells')){if(this.timer){window.clearInterval(this.timer);this.timer=0;return;}const terms=this.source.axisCalculation?.(this.lab.pointIndex??0,this.axis).terms??[];const indices=terms.map((v,i)=>v.product!==0?i:-1).filter(i=>i>=0);this.animate(t=>this.featureFrame=indices[Math.min(indices.length-1,Math.floor(t*indices.length))]??-1,Math.max(2400,indices.length*450));return;}
    this.inputKey='';this.render();
  }
  private animate(update:(t:number)=>void,duration:number):void {
    this.stop();if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){update(1);this.refresh();return;}
    let elapsed=0;update(0);this.refresh();this.timer=window.setInterval(()=>{elapsed+=40;const t=Math.min(1,elapsed/duration);update(t*t*(3-2*t));this.refresh();if(t===1){window.clearInterval(this.timer);this.timer=0;}},40);
  }
  private replay():void {
    const to=copyModel(this.lab.model),from=this.baseline??this.lab.previous;
    if(!from||from.hiddenUnits!==to.hiddenUnits){this.status='먼저 비교 시작점을 저장하고 수 하나를 바꿔 보세요.';this.refresh();return;}
    this.animate(t=>{const result=copyModel(to),mix=(a:number,b:number)=>a+(b-a)*t;result.inputHidden=to.inputHidden.map((r,i)=>r.map((v,j)=>mix(from.inputHidden[i]![j]!,v)));result.hiddenBias=to.hiddenBias.map((v,i)=>mix(from.hiddenBias[i]!,v));result.hiddenOutput=to.hiddenOutput.map((r,i)=>r.map((v,j)=>mix(from.hiddenOutput[i]![j]!,v)));result.outputBias=to.outputBias.map((v,i)=>mix(from.outputBias[i]!,v));this.animation=result;},1500);
  }
}
