import { JOURNEY_ROWS, JOURNEY_FEATURES, journeyPoint, journeyFeature, journeyModel, journeyPrediction, journeyScore, decimal as n, type JourneyFeature } from '../core/understandingJourney';
import { forwardPixels } from '../core/pixelNetwork';
import { classContours } from '../visualization/classContours';
import './understandingJourney.css';

const names=['특징 계산','분포·선택','뉴런·선','뉴런·출력'];
const colors=['#f17605','#df466f'];
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
interface JourneyOptions { context:()=>string; complete:()=>void; }

/** One guided experience, not two unrelated explain/explore modes. */
export class UnderstandingJourney {
  readonly root:HTMLElement;
  private step=0;private reached=0;private done=new Set<number>();private picked=new Set<number>();
  private x:JourneyFeature='all';private y:JourneyFeature='all';private distributions=new Set<string>();
  private selected=0;private probe:[number,number]|null=null;private bias=-.5;private predicted=false;
  private second=false;private connection=0;private muted=false;private compared=false;private vertical=false;
  private outputCalculated=false;private feedback='';private wrong:number|null=null;private controlKey='';private timer=0;private calcFrame=0;private calcRow=0;
  constructor(root:HTMLElement,private options:JourneyOptions) {
    this.root=root;root.className='image-workspace understanding-journey';
    root.innerHTML=`<nav class="journey-nav" aria-label="이해 순서">${names.map((name,i)=>`<button data-journey-step="${i}">${i+1} ${name}</button>`).join('')}</nav>
      <div class="journey-context"></div><div class="journey-body"><section class="journey-visual"><div class="journey-visual-heading"><strong></strong><span></span></div><div class="journey-picture"></div><div class="journey-plot" hidden></div><div class="journey-key" hidden>● 점은 정답 · 바탕색은 예상 · 검은 경계에서는 A = B</div><div class="journey-sample-row"></div><div class="journey-live"></div><div class="journey-network"></div></section>
      <section class="journey-action"><h2></h2><div class="journey-controls"></div><div class="journey-question" aria-live="polite"></div><div class="journey-summary" hidden></div><footer><button data-journey-restart>이 장면 다시</button><button class="button primary" data-journey-next>다음 →</button></footer></section></div>`;
    root.addEventListener('click',event=>this.click(event));
    root.addEventListener('keydown',event=>{const point=(event.target as Element).closest<SVGElement>('g[data-journey-point]');if(point&&(event.key==='Enter'||event.key===' ')){event.preventDefault();this.selected=Number(point.dataset.journeyPoint);this.probe=null;this.render();}});
    root.addEventListener('change',event=>{const t=event.target as HTMLSelectElement;if(t.dataset.journeyAxis){this[t.dataset.journeyAxis as 'x'|'y']=t.value as JourneyFeature;this.distributions.add(`${this.x}/${this.y}`);this.done.delete(1);this.wrong=null;this.feedback='';this.render();}if(t.dataset.journeyDirection){this.vertical=t.value==='vertical';this.render();}});
    root.addEventListener('input',event=>{const t=event.target as HTMLInputElement;if(t.dataset.journeyBias!==undefined){this.bias=Number(t.value);this.done.delete(2);}else if(t.dataset.journeyConnection!==undefined)this.connection=Number(t.value);else return;this.wrong=null;this.feedback='';this.render();});
    const plot=this.el('.journey-plot');let dragging=false;
    const move=(event:PointerEvent)=>{if(!dragging||this.step<2)return;const svg=plot.querySelector('svg')!,r=svg.getBoundingClientRect();const x=event.clientX-r.left,y=event.clientY-r.top,w=r.width-70,h=r.height-55;if(x<50||x>r.width-20||y<15||y>r.height-40)return;this.probe=[Math.round((x-50)/w*100)/100,Math.round((r.height-40-y)/h*100)/100];this.wrong=null;this.feedback='';this.renderVisual();this.renderQuestion();};
    plot.addEventListener('pointerdown',e=>{if((e.target as Element).closest('[data-journey-point]'))return;dragging=true;plot.setPointerCapture?.(e.pointerId);move(e);});plot.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel'])plot.addEventListener(type,()=>dragging=false);
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(()=>{if(!this.root.hidden&&this.step>0)this.renderVisual();}).observe(plot);
    this.render();
  }
  private el<T extends HTMLElement=HTMLElement>(selector:string):T {return this.root.querySelector<T>(selector)!;}
  stop():void {window.clearInterval(this.timer);this.timer=0;}
  reset():void {this.stop();this.step=0;this.reached=0;this.done.clear();this.picked.clear();this.x='all';this.y='all';this.distributions.clear();this.selected=0;this.probe=null;this.bias=-.5;this.predicted=false;this.second=false;this.connection=0;this.muted=false;this.compared=false;this.vertical=false;this.outputCalculated=false;this.feedback='';this.wrong=null;this.controlKey='';this.calcFrame=0;this.calcRow=0;}
  show(visible:boolean):void {this.root.hidden=!visible;if(visible)this.render();else this.stop();}
  private get point():[number,number] {return this.probe??journeyPoint(JOURNEY_ROWS[this.selected]!.cells);}
  private get model(){return journeyModel(this.bias,this.step===3&&this.second,this.muted?0:this.connection,this.vertical);}
  private click(event:MouseEvent):void {
    const button=(event.target as HTMLElement).closest<HTMLElement>('button,[data-journey-point]');if(!button)return;const d=button.dataset;
    if(d.journeyStep!==undefined&&Number(d.journeyStep)<=this.reached&&Array.from({length:Number(d.journeyStep)},(_,i)=>i).every(i=>this.done.has(i))){this.stop();this.step=Number(d.journeyStep);this.feedback='';this.wrong=null;this.controlKey='';this.probe=null;}
    if(d.journeyCell!==undefined){this.picked.add(Number(d.journeyCell));this.calcFrame=this.picked.size;}
    if(d.journeyPlay!==undefined){this.stop();this.picked.clear();this.calcFrame=0;this.timer=window.setInterval(()=>{this.picked.add(this.calcFrame+this.calcRow*2);this.calcFrame++;if(this.calcFrame>=2)this.stop();this.render();},650);}
    if(d.journeyPoint!==undefined){this.selected=Number(d.journeyPoint);this.probe=null;}
    if(d.journeyPredict!==undefined){this.selected=0;this.probe=null;this.predicted=Number(d.journeyPredict)===1;this.wrong=this.predicted?null:9;this.feedback=this.predicted?'예상했어요. 이제 더할 값을 0.00까지 바꿔 확인하세요.':'오답이에요. 같은 두 수에 더하는 값만 커집니다.';}
    if(d.journeyAdd!==undefined){this.second=true;this.connection=0;this.selected=1;this.probe=null;}
    if(d.journeyCompare!==undefined){this.muted=!this.muted;if(this.connection>0)this.compared=true;}
    if(d.journeyAnswer!==undefined&&this.ready()){const answer=Number(d.journeyAnswer);if(answer===this.question().correct){this.wrong=null;this.feedback='';if(this.step===0&&this.calcRow===0){this.calcRow=1;this.picked.clear();this.calcFrame=0;}else if(this.step===3&&!this.outputCalculated){this.outputCalculated=true;}else this.done.add(this.step);}else{this.wrong=answer;this.feedback='오답이에요. 왼쪽의 같은 색 부분을 다시 살펴보세요.';}}
    if(d.journeyRestart!==undefined){this.done.delete(this.step);this.feedback='';this.wrong=null;if(this.step===0){this.picked.clear();this.calcFrame=0;this.calcRow=0;}if(this.step===1){this.distributions=new Set(['all/all']);this.x=this.y='all';}if(this.step===2){this.bias=-.5;this.predicted=false;}if(this.step===3){this.second=false;this.connection=0;this.compared=false;this.outputCalculated=false;this.muted=false;this.vertical=false;}}
    if(d.journeyNext!==undefined&&this.done.has(this.step)&&this.ready()){this.stop();if(this.step===3){if(this.done.size===4)this.options.complete();}else{this.step++;this.reached=Math.max(this.reached,this.step);this.feedback='';this.wrong=null;this.selected=0;this.probe=null;this.controlKey='';if(this.step===1)this.distributions.add('all/all');}}
    this.render();
  }
  private ready():boolean {
    return this.step===0?this.picked.has(this.calcRow*2)&&this.picked.has(this.calcRow*2+1):this.step===1?this.distributions.has('all/all')&&this.x==='top'&&this.y==='bottom':this.step===2?this.predicted&&Math.abs(this.bias)<1e-9:this.bias===0&&this.second&&this.connection===1&&this.compared&&!this.muted&&!this.vertical;
  }
  private question(){const p=this.point,r=forwardPixels(this.model,p),answer=r.logits[1]!;return [
    this.calcRow===0?{title:'윗줄 두 칸의 평균은?',choices:['0.50','0.75','1.50'],correct:1}:{title:'같은 그림의 아랫줄: 두 칸의 평균은?',choices:['0.00','0.25','0.50'],correct:1},
    {title:'전체 평균이 같아도 두 줄을 따로 보면?',choices:['같은 자리에 있던 A와 B를 구별할 수 있다','어떤 자료든 반드시 완벽히 나눌 수 있다'],correct:0},
    {title:`선택한 점: ${n(p[0])} × 1.00 + ${n(p[1])} × (−1.00) + (${n(this.bias)}). 음수는 0.00으로 바꾸면?`,choices:[n(r.hidden[0]!+.5),n(r.hidden[0]!+.25),n(r.hidden[0]!)],correct:2},
    this.outputCalculated?{title:'은닉 뉴런을 1개에서 2개로 늘려도, A·B 출력은?',choices:['2개 — 클래스마다 하나','3개 — 뉴런 수만큼 늘어남'],correct:0}:{title:`선택한 점: 뉴런 1은 ${n(r.hidden[0]!)}, 뉴런 2는 ${n(r.hidden[1]??0)}. 두 수를 더한 B 점수는?`,choices:[n(answer+.5),n(answer+.25),n(answer)],correct:2},
  ][this.step]!;}
  render():void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-journey-step]').forEach((b,i)=>{b.disabled=i>this.reached||Array.from({length:i},(_,j)=>j).some(j=>!this.done.has(j));b.setAttribute('aria-pressed',String(i===this.step));b.classList.toggle('is-done',this.done.has(i));});
    this.el('.journey-context').textContent=`${this.options.context()} · 이해에서는 같은 2×2 예제를 끝까지 사용합니다. 실제 학습 모델과는 별개예요.`;
    const titles=['두 칸을 더하고, 칸 수로 나눠요','같은 그림도 고른 특징에 따라 자리가 달라져요','뉴런 하나를 고쳐 한쪽 B를 찾아요','두 뉴런의 숫자를 모아 답을 골라요'];
    this.el('.journey-action h2').textContent=titles[this.step]!;
    const key=JSON.stringify([this.step,this.predicted,this.second,this.outputCalculated,this.calcRow]);
    if(this.controlKey!==key){this.controlKey=key;const options=Object.entries(JOURNEY_FEATURES).map(([value,label])=>`<option value="${value}">${label}</option>`).join('');
      this.el('.journey-controls').innerHTML=[
        `<div class="journey-operation"><span>① ${this.calcRow?'아랫줄':'윗줄'} 칸 두 개를 눌러요</span><span>② 선택한 값을 더해요</span><span>③ 두 칸이므로 2.00으로 나눠요</span></div><button data-journey-play>▶ 두 칸 따라 보기</button><p>흰 칸 0.00 · 검정 칸 1.00 · 회색은 그 사이</p>`,
        `<label>가로 특징<select data-journey-axis="x">${options}</select></label><label>세로 특징<select data-journey-axis="y">${options}</select></label><p>먼저 전체 평균끼리 비교한 뒤, 가로는 윗줄·세로는 아랫줄로 바꿔 보세요.</p>`,
        `<div class="journey-fixed"><span>가로 × <b>1.00</b> 그대로 더하기</span><span>세로 × <b>−1.00</b> 빼기</span></div><p>윗줄에서 아랫줄을 빼도록 정한 예제예요. 마지막에 더할 값만 고쳐 봐요.</p>${!this.predicted?'<p>첫 B 그림에서 더할 값을 −0.50 → 0.00으로 올리면 뉴런 값은?</p><div class="journey-choices"><button data-journey-predict="1">커진다</button><button data-journey-predict="0">작아진다</button></div>':''}<label>뉴런 1에 더할 값 <output data-bias-value></output><input aria-label="뉴런 1에 더할 값" data-journey-bias type="range" min="-.5" max="0" step=".05" ${this.predicted?'':'disabled'}></label>`,
        `<div class="journey-count"><span>은닉 뉴런 <b>${this.second?'2':'1'}개</b></span><span>출력 <b>A · B, 2개</b></span></div>${!this.second?'<button class="button primary" data-journey-add>+ 반대 차이를 보는 뉴런 추가</button>':`<label>뉴런 2를 B에 얼마나 더할까요? <output data-connection-value></output><input aria-label="뉴런 2의 출력 연결값" data-journey-connection type="range" min="0" max="1" step=".25"></label><button data-journey-compare></button><label>뉴런 2가 보는 차이<select data-journey-direction="true"><option value="opposite">아랫줄 − 윗줄</option><option value="vertical">아랫줄 − 0.50 (다른 방향 시험)</option></select></label>`}<p>A 점수는 비교 기준 0.25. B는 뉴런들이 넘긴 수를 더해요. 검은 선은 두 점수가 같은 자리예요.</p>`,
      ][this.step]!;
    }
    this.root.querySelectorAll<HTMLSelectElement>('[data-journey-axis]').forEach(s=>s.value=this[s.dataset.journeyAxis as 'x'|'y']);
    const bias=this.root.querySelector<HTMLInputElement>('[data-journey-bias]');if(bias){bias.value=String(this.bias);this.el('[data-bias-value]').textContent=n(this.bias);}
    const connection=this.root.querySelector<HTMLInputElement>('[data-journey-connection]');if(connection){connection.value=String(this.connection);this.el('[data-connection-value]').textContent=n(this.connection);this.el('[data-journey-compare]').textContent=this.muted?'뉴런 2 다시 연결':'뉴런 2 없이 비교';this.el<HTMLSelectElement>('[data-journey-direction]').value=this.vertical?'vertical':'opposite';}
    this.renderQuestion();this.renderVisual();
  }
  private renderQuestion():void {
    const q=this.question(),ready=this.ready(),complete=this.done.has(this.step)&&ready;
    this.el('.journey-question').innerHTML=complete?'':`<small>직접 확인</small><strong>${q.title}</strong><div class="journey-choices">${q.choices.map((s,i)=>`<button data-journey-answer="${i}" ${ready?'':'disabled'} class="${this.wrong===i?'is-wrong':''}">${s}</button>`).join('')}</div><p role="status">${this.feedback||(!ready?[`${this.calcRow?'아랫줄':'윗줄'} 두 칸을 먼저 선택하세요.`,'두 축을 윗줄·아랫줄로 바꿔 보세요.','예상한 뒤 슬라이더를 0.00까지 옮겨 보세요.','연결값 1.00으로 연결하고, 뉴런 2를 껐다 켜서 비교해 보세요.'][this.step]:'')}</p>`;
    const summaries=['특징은 그림에서 정한 방법으로 계산한 숫자예요. 이 그림의 윗줄 평균은 0.75, 아랫줄 평균은 0.25예요.','윗줄과 아랫줄을 따로 보면 전체 평균이 같던 그림도 구별할 수 있어요. 좋은 특징인지는 다른 자료에서도 확인해야 해요.','뉴런은 두 특징에 곱하고 더한 뒤 숫자 하나를 넘겨요. 이 예제에서는 음수를 0으로 바꿔요. 한쪽 B는 찾았지만 반대쪽 B는 아직 놓쳤어요.','새 뉴런은 연결해야 답에 영향을 줘요. 출력은 클래스마다 하나씩 있고, 가장 큰 점수의 답을 골라요. 뉴런이 늘어도 경계가 항상 꺾이는 것은 아니에요.'];
    const summary=this.el('.journey-summary');summary.hidden=!complete;summary.innerHTML=`<strong>✓ 내가 확인한 것</strong><p>${summaries[this.step]}</p>`;
    const next=this.el<HTMLButtonElement>('[data-journey-next]');next.disabled=!complete||(this.step===3&&this.done.size!==4);next.textContent=this.step===3?'내 문제에서 학습하기 →':`${this.step+2} ${names[this.step+1]} →`;
  }
  private picture(cells:number[],clickable=false):string {return `<div class="journey-pixels">${cells.map((v,i)=>`<${clickable?'button':'span'} ${clickable?`data-journey-cell="${i}" ${Math.floor(i/2)!==this.calcRow?'disabled':''} aria-label="${i<2?'윗줄':'아랫줄'} ${i%2+1}번째 칸 ${n(v)}"`:''} class="${clickable&&this.picked.has(i)?'is-picked':''}" style="--ink:${v};color:${v>.55?'white':'#202633'}">${n(v)}</${clickable?'button':'span'}>`).join('')}</div>`;}
  private renderVisual():void {
    const row=JOURNEY_ROWS[this.selected]!,point=this.point,r=forwardPixels(this.model,point);
    this.el('.journey-visual-heading strong').textContent=['그림 한 장 → 특징 두 개','정답이 붙은 7장의 위치','보라 선 = 뉴런 합이 0.00','검은 선 = A·B 점수가 같은 곳'][this.step]!;
    this.el('.journey-visual-heading span').textContent=this.step===0?'같은 그림의 두 줄을 비교해요':this.step===1?'A: 두 줄이 같음 · B: 두 줄이 다름':`${journeyScore(this.model)} / ${JOURNEY_ROWS.length}개 맞힘`;
    const picture=this.el('.journey-picture'),plot=this.el('.journey-plot');picture.hidden=this.step!==0;plot.hidden=this.step===0;
    this.el('.journey-key').hidden=this.step<2;
    if(this.step===0){picture.innerHTML=`${this.picture(JOURNEY_ROWS[0]!.cells,true)}<div class="journey-sum"><span class="${this.picked.has(this.calcRow*2)?'on':''}">${this.calcRow?'0.00':'1.00'}</span> + <span class="${this.picked.has(this.calcRow*2+1)?'on':''}">0.50</span> → <b>${this.picked.size>=2?this.calcRow?'0.50':'1.50':'?'}</b><small>두 칸의 값을 더한 합</small><span>합 ÷ 2.00 = ${this.calcRow?'아랫줄':'윗줄'} 평균 <b>${this.done.has(0)?'0.25':'?'}</b></span>${this.calcRow?'<small>✓ 윗줄 평균 0.75</small>':''}</div>`;}
    else plot.innerHTML=this.plot();
    this.el('.journey-sample-row').innerHTML=this.step===0?'':JOURNEY_ROWS.map((r,i)=>`<button data-journey-point="${i}" aria-label="${i+1}번 그림 정답 ${r.label?'B':'A'}" aria-pressed="${i===this.selected&&!this.probe}" style="--class:${colors[r.label]}">${this.picture(r.cells)}<b>정답 ${r.label?'B':'A'}</b></button>`).join('');
    this.el('.journey-live').innerHTML=this.step===0?'<span>다음 장면에서도 이 그림을 사용해요.</span>':this.step===1?`<span>가로 ${this.featureFormula(row.cells,this.x)}</span><span>세로 ${this.featureFormula(row.cells,this.y)}</span> → <span>좌표 <b>(${n(journeyFeature(row.cells,this.x))}, ${n(journeyFeature(row.cells,this.y))})</b></span>`:`<span>${this.probe?'계산용 좌표':`정답 <b style="color:${colors[row.label]}">${row.label?'B':'A'}</b>`} (${n(point[0])}, ${n(point[1])})</span><span>예상 <b style="color:${colors[journeyPrediction(this.model,point)??0]}">${journeyPrediction(this.model,point)===null?'동점':journeyPrediction(this.model,point)===0?'A':'B'}</b></span>`;
    const network=this.el('.journey-network');network.hidden=this.step<2;
    if(this.step>=2){network.innerHTML=`<div class="journey-number-flow"><span>가로 ${n(point[0])}<br>세로 ${n(point[1])}</span><i>→</i><span style="color:#7446f5">뉴런 1<br><b>${n(r.hidden[0]!)}</b>${this.second&&this.step===3?`<br><em style="color:#df466f">뉴런 2 <b>${n(r.hidden[1]!)}</b></em>`:''}</span><i>→</i><span style="color:${colors[0]}">A 점수 <b>0.25</b><small>예제에서 정한 비교 점수</small><br><em style="color:${colors[1]}">B 점수 <b>${n(r.logits[1]!)}</b></em></span></div>${this.step===2?`<div class="journey-equation">${n(point[0])} × 1.00 + ${n(point[1])} × (−1.00) + (${n(this.bias)}) → <b>${n(r.hidden[0]!)}</b><small>음수는 0.00으로 · 넘긴 수 = B 점수</small></div>`:`<div class="journey-equation">B: ${n(r.hidden[0]!)}${this.second?` + ${n(r.hidden[1]!)} × ${n(this.muted?0:this.connection)}`:''} = <b>${n(r.logits[1]!)}</b><small>점수와 확률은 달라요. 여기서는 점수를 비교합니다.</small></div>`}`;}
  }
  private featureFormula(cells:number[],feature:JourneyFeature):string {const values=feature==='top'?cells.slice(0,2):feature==='bottom'?cells.slice(2):cells;return `${n(values.reduce((a,b)=>a+b,0))} ÷ ${n(values.length)} = <b>${n(journeyFeature(cells,feature))}</b>`;}
  private plot():string {
    const width=this.el('.journey-plot').clientWidth||600,height=this.el('.journey-plot').clientHeight||390;
    const w=width-70,h=height-55,map=(x:number,y:number)=>({x:50+x*w,y:height-40-y*h}),m=this.model,parts:string[]=[];
    const blend=(color:string,t:number)=>`rgb(${[1,3,5].map(i=>Math.round(255+(parseInt(color.slice(i,i+2),16)-255)*t)).join(',')})`;
    if(this.step>=2){
      const grid=Array.from({length:31},(_,j)=>Array.from({length:31},(_,i)=>({...map(i/30,j/30),scores:forwardPixels(m,[i/30,j/30]).logits})));
      for(let j=0;j<30;j++)for(let i=0;i<30;i++){
        const p=forwardPixels(m,[(i+.5)/30,(j+.5)/30]),winner=p.logits[0]!>p.logits[1]!?0:1,position=map(i/30,(j+1)/30);
        parts.push(`<rect x="${position.x}" y="${position.y}" width="${w/30+.3}" height="${h/30+.3}" fill="${blend(colors[winner]!,.10+Math.abs(p.probabilities[0]!-.5)*.55)}"/>`);
      }
      let path='';for(let j=0;j<30;j++)for(let i=0;i<30;i++)classContours([grid[j]![i]!,grid[j]![i+1]!,grid[j+1]![i+1]!,grid[j+1]![i]!]).forEach(([a,b])=>path+=`M${a.x},${a.y}L${b.x},${b.y}`);
      parts.push(`<path d="${path}" fill="none" stroke="#202633" stroke-width="3"/>`);
      m.inputHidden.forEach(([a,b],neuron)=>{
        const c=m.hiddenBias[neuron]!,ends:{x:number;y:number}[]=[];
        for(const x of [0,1])if(b){const y=-(a!*x+c)/b;if(y>=0&&y<=1)ends.push(map(x,y));}
        for(const y of [0,1])if(a){const x=-(b!*y+c)/a;if(x>=0&&x<=1)ends.push(map(x,y));}
        const first=ends[0],last=ends.find(p=>first&&Math.hypot(p.x-first.x,p.y-first.y)>1),color=neuron?'#df466f':'#7446f5';
        if(first&&last){
          parts.push(`<line x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}" stroke="${color}" stroke-width="2.5" stroke-dasharray="7 4"/>`);
          const x=first.x*.4+last.x*.6,y=first.y*.4+last.y*.6,length=Math.hypot(a!/w,b!/h),dx=a!/w/length*20,dy=-b!/h/length*20,angle=Math.atan2(dy,dx);
          parts.push(`<path d="M${x},${y}l${dx},${dy}m${-7*Math.cos(angle-.5)},${-7*Math.sin(angle-.5)}L${x+dx},${y+dy}l${-7*Math.cos(angle+.5)},${-7*Math.sin(angle+.5)}" fill="none" stroke="${color}" stroke-width="2"/>`);
        }
      });
    }
    for(const v of [0,.25,.5,.75,1]){const p=map(v,v);parts.push(`<path d="M${p.x},15V${height-40} M50,${p.y}H${width-20}" stroke="#cdd2d9" stroke-width=".7"/><text x="${p.x}" y="${height-20}" text-anchor="middle">${n(v)}</text><text x="43" y="${p.y+5}" text-anchor="end">${n(v)}</text>`);}
    JOURNEY_ROWS.forEach((row,i)=>{
      const point=journeyPoint(row.cells,this.step===1?this.x:'top',this.step===1?this.y:'bottom'),p=map(...point);
      parts.push(`<g data-journey-point="${i}" role="button" aria-label="${i+1}번 정답 ${row.label?'B':'A'}" tabindex="0"><circle cx="${p.x}" cy="${p.y}" r="${i===this.selected&&!this.probe?9:6}" fill="${colors[row.label]}" stroke="white" stroke-width="2"/><text x="${Math.min(width-15,p.x+10)}" y="${Math.max(14,p.y-8)}" fill="${colors[row.label]}">${row.label?'B':'A'}</text></g>`);
    });
    if(this.step===1&&this.x==='all'&&this.y==='all'){const p=map(.5,.5);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="15" fill="white" stroke="#7446f5" stroke-width="2"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle">5</text><text x="${Math.max(55,p.x-90)}" y="${p.y-23}">같은 자리: A 1장 · B 4장</text>`);}
    if(this.probe){const p=map(...this.probe);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="7" fill="white" stroke="#202633" stroke-width="2"/>`);}
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="특징 지도. 점 색은 정답, 배경은 예상, 점선은 뉴런 기준, 검은 선은 최종 경계"><rect x="50" y="15" width="${w}" height="${h}" fill="#fafafa"/>${parts.join('')}<text x="${width/2}" y="${height-2}" text-anchor="middle">${JOURNEY_FEATURES[this.step===1?this.x:'top']}</text><text x="13" y="${height/2}" transform="rotate(-90 13 ${height/2})" text-anchor="middle">${JOURNEY_FEATURES[this.step===1?this.y:'bottom']}</text></svg>`;
  }
}
