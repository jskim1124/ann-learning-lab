import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';

const n=(v:number)=>String(Number(v.toFixed(3)));
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const COLORS=['#f17605','#df466f','#7446f5','#1f6bd6','#1558b7','#a93658'];
/** Every displayed contribution comes from the same forward pass as prediction. */
export function networkArithmetic(model:PixelModel,input:number[],neuron=0,output=0) {
  const r=forwardPixels(model,input);
  const products=model.inputHidden[neuron]!.map((w,i)=>w*(input[i]??0));
  const sum=products.reduce((a,b)=>a+b,model.hiddenBias[neuron]!);
  const outputProducts=model.hiddenOutput[output]!.map((w,i)=>w*r.hidden[i]!);
  const maximum=Math.max(...r.logits),positive=r.logits.map(v=>Math.exp(v-maximum));
  return {...r,products,sum,outputProducts,positive,total:positive.reduce((a,b)=>a+b,0),maximum};
}

export function signalNetwork(model:PixelModel,input:number[],labels:readonly string[],selected=true,neuron=0,output=0):string {
  neuron=Math.max(0,Math.min(model.hiddenUnits-1,neuron));output=Math.max(0,Math.min(model.classCount-1,output));
  const r=networkArithmetic(model,input,neuron,output),weights=model.inputHidden[neuron]!;
  const value=(v:number)=>selected?n(v):'—';
  // Pixel models use ALL pixels; the remaining-products row is an actual sum, not an approximation.
  const entries=model.inputSize===2?[0,1]:r.products.map((v,i)=>({v:Math.abs(v),i})).sort((a,b)=>b.v-a.v).slice(0,2).map(p=>p.i);
  const terms=entries.map(i=>`<span class="flow-term"><small>${model.inputSize===2?(i===0?'가로':'세로'):`${i+1}번 칸`}</small><span>${value(input[i]??0)} <em>× (${n(weights[i]!)})</em> → <b>${value(r.products[i]!)}</b></span></span>`).join('');
  const rest=r.products.reduce((sum,v,i)=>sum+(entries.includes(i)?0:v),0);
  const outputTerms=r.outputProducts.map((v,i)=>({v,i}));
  const shown=[outputTerms[neuron]!,...outputTerms.filter(p=>p.i!==neuron).slice(0,1)];
  const remaining=outputTerms.filter(p=>!shown.some(s=>s.i===p.i)).reduce((sum,p)=>sum+p.v,0);
  const activation=model.activation==='relu'?'음수는 0 · 양수는 그대로':model.activation==='sigmoid'?'0~1 사이로 바꾸기':'−1~1 사이로 바꾸기';
  const fixedReference=model.classCount===2&&model.hiddenOutput[0]!.every(v=>v===0)&&model.outputBias[0]===0;
  const colors=fixedReference?['#1f6bd6','#f17605']:COLORS;
  return `<div class="network-flow" aria-label="입력에서 확률까지 실제 계산 연결지도">
    <div class="live-network"><div class="live-inputs"><strong>입력</strong>${model.inputSize===2?`<span>가로 <b>${value(input[0]!)}</b></span><span>세로 <b>${value(input[1]!)}</b></span>`:`<span>그림 ${model.inputSize}칸</span>`}</div><span aria-hidden="true">→</span><div><strong>은닉 ${model.hiddenUnits}개</strong><div class="live-hidden" style="--node-columns:${Math.min(4,model.hiddenUnits)}">${r.hidden.map((v,i)=>`<button type="button" data-network-neuron="${i}" aria-label="뉴런 ${i+1} 계산 보기" aria-pressed="${i===neuron}" style="--node-color:${NEURON_COLORS[i%NEURON_COLORS.length]}"><small>${i+1}</small><b>${value(v)}</b></button>`).join('')}</div></div><span aria-hidden="true">→</span><div class="live-outputs"><strong>${fixedReference?"비교할 답":"출력"} ${labels.length}개</strong>${labels.map((label,i)=>`<button type="button" data-network-output="${i}" aria-label="${esc(label)} 출력 계산 보기" aria-pressed="${i===output}" style="--class-color:${colors[i%colors.length]}">${esc(label)} <b>${selected?(r.probabilities[i]!*100).toFixed(1)+'%':'—'}</b></button>`).join('')}</div></div>
    ${selected?`<div class="network-path" style="--node-color:${NEURON_COLORS[neuron%NEURON_COLORS.length]};--class-color:${colors[output%colors.length]}">
      <section class="path-hidden"><strong>뉴런 ${neuron+1}로 들어가는 길</strong><div class="flow-terms">${terms}${model.inputSize>2?`<span>나머지 ${model.inputSize-2}칸의 곱을 더하면 <b>${n(rest)}</b></span>`:''}</div><div class="flow-join">곱한 값들 + <mark>${n(model.hiddenBias[neuron]!)}</mark> → 합 <b>${n(r.sum)}</b></div><div class="flow-transfer"><span>${activation}</span><b>↓ ${n(r.hidden[neuron]!)}</b></div></section>
      <section class="path-output"><strong>${esc(labels[output]??String(output))} 출력으로 가는 길</strong>${shown.map(({v,i})=>`<span class="flow-term"><small>뉴런 ${i+1}</small><span>${n(r.hidden[i]!)} <em>× (${n(model.hiddenOutput[output]![i]!)})</em> → <b>${n(v)}</b></span></span>`).join('')}${outputTerms.length>2?`<span>나머지 ${outputTerms.length-2}개 곱의 합 <b>${n(remaining)}</b></span>`:''}<div class="flow-join">곱한 값들 + <mark>${n(model.outputBias[output]!)}</mark> → 점수 <b>${n(r.logits[output]!)}</b></div></section>
      <div class="flow-probability"><span>양수로 바꾼 뒤, 이 답의 값 ÷ 전체 합</span><b>${n(r.positive[output]!)} ÷ ${n(r.total)} × 100 ≈ ${(r.probabilities[output]!*100).toFixed(1)}%</b></div>
      <details class="probability-rule"><summary>변환 규칙${fixedReference?' · 막힘은 기준 점수 0':''}</summary><p>각 점수에서 가장 큰 점수 ${n(r.maximum)}를 뺀 뒤 exp로 양수로 바꿉니다. 이 양수들의 합으로 나누어 퍼센트를 구해요. 점수 자체가 확률인 것은 아닙니다.</p><p>${labels.map((label,i)=>`${esc(label)}: ${n(r.logits[i]!)} → ${n(r.positive[i]!)}`).join(' · ')}</p><p>계산은 원래 값으로 하며 화면 숫자는 반올림합니다.${fixedReference?' 막힘의 0은 비교 기준으로 고정되어 있고, 골 점수와 비교합니다.':''}</p></details>
    </div>`:'<p>자료의 점을 눌러 계산을 확인하세요.</p>'}
  </div>`;
}

type Frame={model:PixelModel;input:number[];labels:readonly string[];selected:boolean};
const frames=new WeakMap<HTMLElement,Frame>();
export function renderSignalNetwork(panel:HTMLElement,model:PixelModel,input:number[],labels:readonly string[],selected=true):void {
  const first=!frames.has(panel);frames.set(panel,{model,input,labels,selected});
  const neuron=Math.min(Number(panel.dataset.neuron??0),model.hiddenUnits-1);
  const defaultOutput=model.classCount===2&&model.hiddenOutput[0]!.every(v=>v===0)&&model.outputBias[0]===0?1:0;
  const output=Math.min(Number(panel.dataset.output??defaultOutput),model.classCount-1);
  panel.dataset.neuron=String(neuron);panel.dataset.output=String(output);
  const focused=panel.querySelector(':focus') as HTMLElement|null;
  const focusSelector=focused?.matches('[data-network-neuron]')?`[data-network-neuron="${focused.dataset.networkNeuron}"]`:focused?.matches('[data-network-output]')?`[data-network-output="${focused.dataset.networkOutput}"]`:null;
  const ruleOpen=panel.querySelector<HTMLDetailsElement>('.probability-rule')?.open??false;
  panel.innerHTML=signalNetwork(model,input,labels,selected,neuron,output);
  const rule=panel.querySelector<HTMLDetailsElement>('.probability-rule');if(rule)rule.open=ruleOpen;
  if(focusSelector)panel.querySelector<HTMLElement>(focusSelector)?.focus({preventScroll:true});
  if(first)panel.addEventListener('click',e=>{
    const target=(e.target as HTMLElement).closest<HTMLElement>('[data-network-neuron],[data-network-output]');if(!target)return;
    if(target.dataset.networkNeuron!==undefined)panel.dataset.neuron=target.dataset.networkNeuron;
    if(target.dataset.networkOutput!==undefined)panel.dataset.output=target.dataset.networkOutput;
    const frame=frames.get(panel)!;renderSignalNetwork(panel,frame.model,frame.input,frame.labels,frame.selected);
  });
}
export function installSignalNetwork(svg:Element,id:string):void {
  const panel=document.createElement('div');panel.id=id;svg.before(panel);
  const detail=document.createElement('details');detail.className='network-wires';
  const summary=document.createElement('summary');summary.textContent='전체 연결선 보기';
  svg.before(detail);detail.append(summary,svg);
}
