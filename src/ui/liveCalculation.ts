import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';
import { networkOverview } from './networkOverview';

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
    ${networkOverview(model,input,labels,selected,neuron,output)}
    ${selected?`<details class="network-calculations"><summary>계산값 자세히 보기</summary><p class="network-guide">뉴런이나 답을 누르면 아래 계산이 바뀝니다. 원은 진할수록 반응의 크기가 크고, +/−는 값의 부호입니다. 큰 반응이 꼭 정답을 뜻하지는 않아요. 연결선은 경로만 보여 줍니다.</p><div class="network-path" style="--node-color:${NEURON_COLORS[neuron%NEURON_COLORS.length]};--class-color:${colors[output%colors.length]}">
      <section class="path-hidden"><strong>뉴런 ${neuron+1}로 들어가는 길</strong><div class="flow-terms">${terms}${model.inputSize>2?`<span>나머지 ${model.inputSize-2}칸의 곱을 더하면 <b>${n(rest)}</b></span>`:''}</div><div class="flow-join">곱한 값들 + <mark>${n(model.hiddenBias[neuron]!)}</mark> → 합 <b>${n(r.sum)}</b></div><div class="flow-transfer"><span>${activation}</span><b>↓ ${n(r.hidden[neuron]!)}</b></div></section>
      <section class="path-output"><strong>${esc(labels[output]??String(output))} 출력으로 가는 길</strong>${shown.map(({v,i})=>`<span class="flow-term"><small>뉴런 ${i+1}</small><span>${n(r.hidden[i]!)} <em>× (${n(model.hiddenOutput[output]![i]!)})</em> → <b>${n(v)}</b></span></span>`).join('')}${outputTerms.length>2?`<span>나머지 ${outputTerms.length-2}개 곱의 합 <b>${n(remaining)}</b></span>`:''}<div class="flow-join">곱한 값들 + <mark>${n(model.outputBias[output]!)}</mark> → 점수 <b>${n(r.logits[output]!)}</b></div></section>
      <div class="flow-probability"><span>양수로 바꾼 뒤, 이 답의 값 ÷ 전체 합</span><b>${n(r.positive[output]!)} ÷ ${n(r.total)} × 100 ≈ ${(r.probabilities[output]!*100).toFixed(1)}%</b></div>
      <details class="probability-rule"><summary>변환 규칙${fixedReference?' · 막힘은 기준 점수 0':''}</summary><p>각 점수에서 가장 큰 점수 ${n(r.maximum)}를 뺀 뒤 exp로 양수로 바꿉니다. 이 양수들의 합으로 나누어 퍼센트를 구해요. 점수 자체가 확률인 것은 아닙니다.</p><p>${labels.map((label,i)=>`${esc(label)}: ${n(r.logits[i]!)} → ${n(r.positive[i]!)}`).join(' · ')}</p><p>계산은 원래 값으로 하며 화면 숫자는 반올림합니다.${fixedReference?' 막힘의 0은 비교 기준으로 고정되어 있고, 골 점수와 비교합니다.':''}</p></details>
    </div></details>`:'<details class="network-calculations"><summary>계산값 자세히 보기</summary><p class="network-guide">자료의 점을 고르면 실제 계산도 볼 수 있어요.</p></details>'}
  </div>`;
}

type Frame={model:PixelModel;input:number[];labels:readonly string[];selected:boolean;hidden:number[];parameters:string;incoming:string[];outgoing:string[][];hiddenBias:number[];outputBias:number[];epoch:number};
const frames=new WeakMap<HTMLElement,Frame>();
export function renderSignalNetwork(panel:HTMLElement,model:PixelModel,input:number[],labels:readonly string[],selected=true):void {
  const previous=frames.get(panel),first=!previous;
  const incoming=model.inputHidden.map(row=>JSON.stringify(row));
  const outgoing=model.hiddenOutput.map(row=>row.map(w=>String(w)));
  const parameters=JSON.stringify([incoming,outgoing,model.hiddenBias,model.outputBias]),hidden=forwardPixels(model,input).hidden;
  const frame={model,input:[...input],labels,selected,hidden,parameters,incoming,outgoing,hiddenBias:[...model.hiddenBias],outputBias:[...model.outputBias],epoch:model.epoch};
  frames.set(panel,frame);
  const neuron=Math.min(Number(panel.dataset.neuron??0),model.hiddenUnits-1);
  const defaultOutput=model.classCount===2&&model.hiddenOutput[0]!.every(v=>v===0)&&model.outputBias[0]===0?1:0;
  const output=Math.min(Number(panel.dataset.output??defaultOutput),model.classCount-1);
  panel.dataset.neuron=String(neuron);panel.dataset.output=String(output);
  const focused=panel.querySelector(':focus') as HTMLElement|null;
  const focusSelector=focused?.matches('[data-network-neuron]')?`[data-network-neuron="${focused.dataset.networkNeuron}"]`:focused?.matches('[data-network-output]')?`[data-network-output="${focused.dataset.networkOutput}"]`:null;
  const ruleOpen=panel.querySelector<HTMLDetailsElement>('.probability-rule')?.open??false;
  const calculationsOpen=panel.querySelector<HTMLDetailsElement>('.network-calculations')?.open??false;
  // Keep the legacy graph mounted (and its disclosure state) inside the one advanced view.
  const wires=panel.querySelector('.network-wires')??(panel.nextElementSibling?.matches('.network-wires')?panel.nextElementSibling:null);
  wires?.remove();
  panel.innerHTML=signalNetwork(model,input,labels,selected,neuron,output);
  const calculations=panel.querySelector<HTMLDetailsElement>('.network-calculations');if(calculations)calculations.open=calculationsOpen;
  if(wires)calculations?.append(wires);
  const rule=panel.querySelector<HTMLDetailsElement>('.probability-rule');if(rule)rule.open=ruleOpen;
  const learned=previous&&model.epoch>previous.epoch&&parameters!==previous.parameters&&hidden.length===previous.hidden.length;
  if(learned){
    incoming.forEach((value,h)=>{if(value!==previous.incoming[h])panel.querySelector(`[data-input-wire="${h}"]`)?.classList.add('is-changed');});
    outgoing.forEach((row,c)=>row.forEach((value,h)=>{if(value!==previous.outgoing[c]?.[h])panel.querySelector(`[data-output-wire="${h}-${c}"]`)?.classList.add('is-changed');}));
    model.hiddenBias.forEach((value,h)=>{if(value!==previous.hiddenBias[h])panel.querySelector(`[data-network-neuron="${h}"]`)?.classList.add('is-changed');});
    model.outputBias.forEach((value,c)=>{if(value!==previous.outputBias[c])panel.querySelector(`[data-network-output="${c}"]`)?.classList.add('is-changed');});
    panel.querySelector('.network-change')!.textContent='학습으로 바뀐 곳을 표시했어요.';
  }
  if(selected&&previous?.selected)hidden.forEach((value,h)=>{if(Math.abs(value-(previous.hidden[h]??value))>1e-6)panel.querySelector(`[data-network-neuron="${h}"]`)?.classList.add('is-reacting');});
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
  const legend=svg.closest('.connection-panel')?.querySelector('.weight-legend');if(legend)detail.append(legend);
}
