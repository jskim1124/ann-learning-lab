import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { projectPixels, projectionFromFeatures, type PixelProjection } from '../core/pixelProjection';
import type { ImageState } from '../state/imageLabStore';
import './comparisonFlow.css';
import {sliceModel,sliceHeatmap} from './modelSlice';

const COLORS=['#f17605','#df466f','#7446f5','#1769d2','#1558b7','#a93658'];
const color=(i:number)=>COLORS[i%COLORS.length]!;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const n=(v:number)=>Math.abs(v)<.005?'0.00':v.toFixed(2);

/** Projection is ONLY an address for drawings. Inference always uses the original pixels. */
export function comparisonRows(state:ImageState,projection:PixelProjection) {
  return state.data.map(row=>{
    const xy=projectPixels(projection,row.pixels),result=forwardPixels(state.model,row.pixels);
    return {id:row.id,label:row.label,x:xy.x,y:xy.y,hidden:result.hidden,probabilities:result.probabilities,predicted:result.probabilities.indexOf(Math.max(...result.probabilities))};
  });
}
type Row=ReturnType<typeof comparisonRows>[number];
function pixelPicture(pixels:number[]):string {
  return `<svg viewBox="0 0 14 14" role="img" aria-label="지금 살펴보는 실제 입력 그림"><rect width="14" height="14" fill="white"/>${pixels.map((v,i)=>`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="black" opacity="${v}"/>`).join('')}</svg>`;
}
function dot(row:Row,fill:string,ring?:string,selected=false):string {
  const x=12+(row.x+1)*88,y=12+(1-row.y)*88;
  return `<circle cx="${x}" cy="${y}" r="${selected?5:3.2}" fill="${fill}" stroke="${selected?'#202b39':ring??'white'}" stroke-width="${selected?2:1.5}"/>`;
}
/** Read-only live view: no independent toy model and no invented boundary on a lossy map. */
export class ComparisonFlow {
  private data:ImageState['data']|null=null;
  private model:PixelModel|null=null;
  private projection:PixelProjection|null=null;
  private rows:Row[]=[];
  private selectedNeuron=0;
  private lastPaint=0;
  private currentState:ImageState|null=null;
  private training=false;
  private observedWidth=0;
  constructor(readonly root:HTMLElement,private choose:(id:number)=>void,private inspect:(neuron:number)=>void) {
    root.className='tm-flow';
    if(typeof ResizeObserver!=='undefined')new ResizeObserver(entries=>{
      const width=Math.round(entries[0]?.contentRect.width??0);
      if(width>0&&width!==this.observedWidth){this.observedWidth=width;this.lastPaint=-Infinity;if(this.currentState)this.render(this.currentState,this.training);}
    }).observe(root);
    root.addEventListener('click',e=>{
      const target=(e.target as Element).closest<HTMLElement>('[data-flow-sample],[data-flow-neuron]');
      if(!target)return;e.stopPropagation();this.lastPaint=-Infinity;
      if(target.dataset.flowSample!==undefined)this.choose(Number(target.dataset.flowSample));
      if(target.dataset.flowNeuron!==undefined){this.selectedNeuron=Number(target.dataset.flowNeuron);this.inspect(this.selectedNeuron);}
    });
  }
  render(s:ImageState,training:boolean):void {
    this.currentState=s;this.training=training;
    this.root.dataset.training=String(training);
    if(training&&this.model!==s.model&&s.model.epoch&&performance.now()-this.lastPaint<140)return;
    this.lastPaint=performance.now();
    if(!s.model.epoch&&!training){this.root.innerHTML='<div class="tm-flow-wait"><strong>그림을 모은 뒤 학습해 보세요</strong><p>자료 분포 <span>→</span> 뉴런 <span>→</span> 예상 결과</p><small>학습 버튼을 누르면 계산 과정이 여기에 나타나요.</small></div>';return;}
    if(this.data!==s.data||!this.projection){
      this.data=s.data;
      this.projection=projectionFromFeatures(s.data,s.features.find(f=>f.id==='auto1')!.weights,s.features.find(f=>f.id==='auto2')!.weights);this.model=null;
    }
    if(this.model!==s.model){this.model=s.model;this.rows=comparisonRows(s,this.projection);}
    this.selectedNeuron=Math.min(this.selectedNeuron,s.model.hiddenUnits-1);
    const selected=s.data.find(r=>r.id===s.selectedSample),fallback=s.input.some(v=>v>0)?null:s.data[0];
    const focus=selected??fallback,pixels=focus?.pixels??s.input,f=forwardPixels(s.model,pixels),winner=f.probabilities.indexOf(Math.max(...f.probabilities));
    const slice=sliceModel(s.model,this.projection);
    const map=(output:boolean)=>`<svg class="tm-sample-map" viewBox="0 0 200 200" role="img" aria-label="${output?'그림별 실제 예상 결과':'그림의 두 방향 차이를 요약한 자료 분포'}"><path d="M12 100 H188 M100 12 V188"/>${this.rows.map(row=>`<g data-flow-sample="${row.id}" role="button" tabindex="0" aria-label="자료 ${row.id} · 정답 ${esc(s.classes[row.label]!)}${output?` · 예상 ${esc(s.classes[row.predicted]!)}`:''}"><title>자료 ${row.id}: ${esc(s.classes[row.label]!)}${output?` → ${esc(s.classes[row.predicted]!)}`:''}</title>${dot(row,color(row.label),output?color(row.predicted):undefined,row.id===focus?.id)}</g>`).join('')}</svg>`;

    const compact=this.root.getBoundingClientRect().width>0&&this.root.getBoundingClientRect().width<800;
    const tile=compact?64:50,hx=compact?230:300,ox=compact?650:672;
    const hidden=s.model.inputHidden.map((_,i)=>({x:hx+(i%4)*(compact?80:68),y:52+Math.floor(i/4)*(compact?84:72)}));
    const outputs=s.classes.map((label,i)=>({label,x:ox,y:65+i*270/Math.max(1,s.classes.length-1)}));
    const wire=(x:number,y:number,tx:number,ty:number,w:number,id:string)=>`<path data-flow-wire="${id}" d="M${x} ${y} C${(x+tx)/2} ${y},${(x+tx)/2} ${ty},${tx} ${ty}" fill="none" stroke="${w<0?'#f17605':'#1f6bd6'}" stroke-width="${.6+2.5*Math.abs(w)/(1+Math.abs(w))}" opacity="${.2+.65*Math.abs(w)/(1+Math.abs(w))}"/>`;
    const wires=hidden.map((h,i)=>wire(210,196,h.x,h.y+tile/2,Math.sqrt(s.model.inputHidden[i]!.reduce((sum,v)=>sum+v*v,0)),'input-'+i)).join('')+
      hidden.map((h,i)=>outputs.map((o,c)=>wire(h.x+tile,h.y+tile/2,o.x,o.y,s.model.hiddenOutput[c]![i]!,'output-'+i+'-'+c)).join('')).join('');
    this.root.innerHTML=`<svg class="tm-live-network" viewBox="0 0 ${compact?800:1000} ${compact?670:400}" role="group" aria-label="학습 중인 신경망과 2차원 단면">
      <text x="10" y="25" class="flow-heading">자료 분포</text><text x="${hx}" y="25" class="flow-heading">은닉 뉴런</text><text x="${ox-20}" y="25" class="flow-heading">출력 · 클래스별 하나</text>
      <g class="flow-wires">${wires}</g>
      <svg x="0" y="105" width="175" height="175" viewBox="0 0 200 200">${map(false).replace(/^<svg[^>]*>|<\/svg>$/g,'')}</svg>
      <path d="M175 196H192" stroke="#abb2bd" stroke-width="2"/><circle cx="210" cy="196" r="23" fill="white" stroke="#768394"/><text x="210" y="201" text-anchor="middle" font-size="13">196칸</text>
      ${hidden.map((h,i)=>`<g data-flow-neuron="${i}" role="button" tabindex="0" aria-label="뉴런 ${i+1}의 반응 보기" aria-pressed="${i===this.selectedNeuron}"><svg x="${h.x}" y="${h.y}" width="${tile}" height="${tile}" viewBox="0 0 100 100">${sliceHeatmap(slice,i,14)}</svg><rect x="${h.x}" y="${h.y}" width="${tile}" height="${tile}" rx="4" fill="none" stroke="${i===this.selectedNeuron?'#7446f5':'#a4aebc'}" stroke-width="${i===this.selectedNeuron?3:1}"/><text x="${h.x+tile/2}" y="${h.y+tile+14}" text-anchor="middle" font-size="13">${i+1}</text></g>`).join('')}
      ${outputs.map((o,i)=>`<circle cx="${o.x}" cy="${o.y}" r="16" fill="${color(i)}" fill-opacity="${.1+.8*f.probabilities[i]!}" stroke="${color(i)}"/><text x="${o.x+23}" y="${o.y+5}" fill="${color(i)}" font-size="16">${esc(o.label)}</text>`).join('')}
      <svg x="${compact?485:810}" y="${compact?450:112}" width="${compact?190:175}" height="${compact?190:175}" viewBox="0 0 100 100" data-flow-boundary>${sliceHeatmap(slice)}</svg>
      <text x="${compact?485:810}" y="${compact?662:310}" font-size="15">색 영역과 최종 경계</text>
      <text x="10" y="${compact?406:367}" font-size="15">점 하나 = 실제 그림 한 장</text><text x="${hx}" y="${compact?406:367}" font-size="15">작은 색 지도 = 모델의 2차원 단면</text>
    ${compact?'<path d="M650 368 V428 H580 V446" fill="none" stroke="#b6bec9" stroke-width="2"/>':''}
    </svg>
      <div class="tm-focus">${pixelPicture(pixels)}<div><strong>${focus?`자료 ${focus.id}`:'새 그림'} → ${esc(s.classes[winner]??'')} <b>${n((f.probabilities[winner]??0)*100)}%</b></strong><span>뉴런 ${this.selectedNeuron+1}의 실제 값 <b>${n(f.hidden[this.selectedNeuron]!)}</b></span></div></div>
      <details class="tm-flow-note"><summary>색과 선은 무엇인가요?</summary><p>모델은 그림 196칸 전체를 학습해요. 작은 색 지도는 평균 그림에서 두 방향만 바꾼 단면이라, 실제 그림의 예상과 다를 수 있어요. 파랑은 양수, 주황은 음수입니다. 입력의 묶음선은 연결 크기, 출력선은 연결의 부호와 크기예요. 아래 예상은 선택한 원본 그림으로 계산합니다.</p></details>`;
    this.root.querySelectorAll<SVGGElement>('[data-flow-neuron]').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.lastPaint=-Infinity;this.selectedNeuron=Number(el.dataset.flowNeuron);this.inspect(this.selectedNeuron);}}));
    this.root.querySelectorAll<SVGGElement>('[data-flow-sample]').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.lastPaint=-Infinity;this.choose(Number(el.dataset.flowSample));}}));
  }
}
