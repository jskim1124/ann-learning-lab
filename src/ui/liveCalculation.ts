import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { networkOverview } from './networkOverview';

/** Exact arithmetic is testable; the screen shows only one selected route. */
export function networkArithmetic(model:PixelModel,input:number[],neuron=0,output=0) {
  const r=forwardPixels(model,input),products=model.inputHidden[neuron]!.map((w,i)=>w*(input[i]??0));
  const sum=products.reduce((a,b)=>a+b,model.hiddenBias[neuron]!);
  const outputProducts=model.hiddenOutput[output]!.map((w,i)=>w*r.hidden[i]!);
  const maximum=Math.max(...r.logits),positive=r.logits.map(v=>Math.exp(v-maximum));
  return {...r,products,sum,outputProducts,positive,total:positive.reduce((a,b)=>a+b,0),maximum};
}
export function signalNetwork(model:PixelModel,input:number[],labels:readonly string[],selected=true,neuron=0,output=0,showValues=false):string {
  neuron=Math.max(0,Math.min(model.hiddenUnits-1,neuron));output=Math.max(0,Math.min(model.classCount-1,output));
  return `<div class="network-flow" aria-label="입력에서 예상까지 연결지도">${networkOverview(model,input,labels,selected,neuron,output,{showValues:showValues&&selected})}</div>`;
}
type Frame={model:PixelModel;input:number[];labels:readonly string[];selected:boolean;hidden:number[];parameters:string;incoming:string[];outgoing:string[][];hiddenBias:number[];outputBias:number[];epoch:number};
const frames=new WeakMap<HTMLElement,Frame>();
export function renderSignalNetwork(panel:HTMLElement,model:PixelModel,input:number[],labels:readonly string[],selected=true):void {
  const previous=frames.get(panel),first=!previous;
  const incoming=model.inputHidden.map(row=>JSON.stringify(row)),outgoing=model.hiddenOutput.map(row=>row.map(String));
  const parameters=JSON.stringify([incoming,outgoing,model.hiddenBias,model.outputBias]),hidden=forwardPixels(model,input).hidden;
  frames.set(panel,{model,input:[...input],labels,selected,hidden,parameters,incoming,outgoing,hiddenBias:[...model.hiddenBias],outputBias:[...model.outputBias],epoch:model.epoch});
  const neuron=Math.min(Number(panel.dataset.neuron??0),model.hiddenUnits-1);
  const defaultOutput=model.classCount===2&&model.hiddenOutput[0]!.every(v=>v===0)&&model.outputBias[0]===0?1:0;
  const output=Math.min(Number(panel.dataset.output??defaultOutput),model.classCount-1);
  panel.dataset.neuron=String(neuron);panel.dataset.output=String(output);
  const focused=panel.querySelector(':focus') as HTMLElement|null;
  const selector=focused?.matches('[data-network-neuron]')?`[data-network-neuron="${focused.dataset.networkNeuron}"]`:focused?.matches('[data-network-output]')?`[data-network-output="${focused.dataset.networkOutput}"]`:null;
  panel.innerHTML=signalNetwork(model,input,labels,selected,neuron,output,panel.dataset.values==='true');
  if(previous&&model.epoch>previous.epoch&&parameters!==previous.parameters&&hidden.length===previous.hidden.length){
    incoming.forEach((value,h)=>{if(value!==previous.incoming[h])panel.querySelector(`[data-input-wire="${h}"]`)?.classList.add('is-changed');});
    outgoing.forEach((row,c)=>row.forEach((value,h)=>{if(value!==previous.outgoing[c]?.[h])panel.querySelector(`[data-output-wire="${h}-${c}"]`)?.classList.add('is-changed');}));
    model.hiddenBias.forEach((value,h)=>{if(value!==previous.hiddenBias[h])panel.querySelector(`[data-network-neuron="${h}"]`)?.classList.add('is-changed');});
    model.outputBias.forEach((value,c)=>{if(value!==previous.outputBias[c])panel.querySelector(`[data-network-output="${c}"]`)?.classList.add('is-changed');});
    panel.querySelector('.network-change')!.textContent='학습으로 바뀐 길이 반짝여요.';
  }
  if(selected&&previous?.selected)hidden.forEach((value,h)=>{if(Math.abs(value-(previous.hidden[h]??value))>1e-6)panel.querySelector(`[data-network-neuron="${h}"]`)?.classList.add('is-reacting');});
  if(selector)panel.querySelector<HTMLElement>(selector)?.focus({preventScroll:true});
  if(first)panel.addEventListener('click',e=>{
    const target=(e.target as HTMLElement).closest<HTMLElement>('[data-network-neuron],[data-network-output]');if(!target)return;
    if(target.dataset.networkNeuron!==undefined)panel.dataset.neuron=target.dataset.networkNeuron;
    if(target.dataset.networkOutput!==undefined)panel.dataset.output=target.dataset.networkOutput;
    panel.dataset.values='true';const frame=frames.get(panel)!;renderSignalNetwork(panel,frame.model,frame.input,frame.labels,frame.selected);
    panel.dispatchEvent(new CustomEvent('networkfocus',{bubbles:true,detail:{neuron:Number(panel.dataset.neuron),output:Number(panel.dataset.output)}}));
  });
}
export function installSignalNetwork(svg:Element,id:string):void {
  const panel=document.createElement('div');panel.id=id;svg.before(panel);
  svg.setAttribute('hidden','');svg.classList.add('retired-network');svg.setAttribute('aria-hidden','true');
}
