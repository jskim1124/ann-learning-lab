import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';

const n=(v:number)=>String(Number(v.toFixed(3)));
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Grouped arrows represent the same fully-connected layers; values are actual forward-pass results. */
export function signalNetwork(model:PixelModel,input:number[],labels:readonly string[],selected=true):string {
  const r=forwardPixels(model,input);
  return `<div class="live-network" aria-label="다음 계산으로 전달하는 숫자 연결지도"><div class="live-inputs"><strong>입력</strong>${model.inputSize===2?`<span>가로<br><b>${n(input[0]!)}</b></span><span>세로<br><b>${n(input[1]!)}</b></span>`:`<span>그림<br>${model.inputSize}칸</span>`}</div><span aria-hidden="true">→</span><div><strong>은닉 ${model.hiddenUnits}개</strong><div class="live-hidden" style="--node-columns:${Math.min(4,model.hiddenUnits)}">${r.hidden.map((v,i)=>`<span style="--node-color:${NEURON_COLORS[i%NEURON_COLORS.length]}"><small>${i+1}</small><b>${selected?Number(v.toFixed(2)):'—'}</b></span>`).join('')}</div></div><span aria-hidden="true">→</span><div class="live-outputs"><strong>답 ${labels.length}개</strong>${labels.map((label,i)=>`<span title="${esc(label)}">${esc(label)} <b>${selected?(r.probabilities[i]!*100).toFixed(0)+'%':'—'}</b></span>`).join('')}</div></div>`;
}

export function installSignalNetwork(svg:Element,id:string):void {
  const panel=document.createElement('div');panel.id=id;svg.before(panel);
  const detail=document.createElement('details');detail.className='network-wires';
  const summary=document.createElement('summary');summary.textContent='전체 연결선 보기';
  svg.before(detail);detail.append(summary,svg);
}
/** A compact worked calculation for neuron 1; all hidden values remain visible in the network. */
export function liveCalculation(model:PixelModel,input:number[],labels:readonly string[]):string {
  const r=forwardPixels(model,input),w=model.inputHidden[0]!,sum=w.reduce((v,a,i)=>v+a*(input[i]??0),model.hiddenBias[0]!);
  const fixedReference=model.classCount===2&&model.hiddenOutput[0]!.every(v=>v===0)&&model.outputBias[0]===0;
  const top=fixedReference?1:r.logits.indexOf(Math.max(...r.logits));
  const inputText=model.inputSize===2?`${n(input[0]!)} × (${n(w[0]!)}) + ${n(input[1]!)} × (${n(w[1]!)}) + (${n(model.hiddenBias[0]!)})`:`${model.inputSize}칸의 진하기 × 각 연결값을 더한 뒤 ${n(model.hiddenBias[0]!)} 더하기`;
  return `<div class="live-calculation"><strong>뉴런 1 계산 따라가기</strong><span>${inputText} ≈ ${n(sum)}</span><span>합 ${n(sum)} → 넘기는 숫자 <b>${n(r.hidden[0]!)}</b>${model.activation==='relu'?' (음수면 0)':' (선택한 중간값 바꾸기 적용)'}</span><span>${esc(labels[top]??String(top))} 출력: ${r.hidden.map((h,i)=>`${n(h)} × (${n(model.hiddenOutput[top]![i]!)})`).slice(0,3).join(' + ')}${r.hidden.length>3?' + …':''} + (${n(model.outputBias[top]!)}) ≈ <b>${n(r.logits[top]!)}</b>${fixedReference?' · 막힘의 기준 점수는 0':''}</span></div>`;
}
