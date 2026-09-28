import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';
import type { InputParameter } from '../core/explorationLearning';
const n=(v:number)=>Math.abs(v)<.005?'0.00':v.toFixed(2);
// A persistent outline and bold type identify the editable number without
// relying on colour alone. Input values and calculated results stay unmarked.
const marker=(id:string,active:boolean,x:number,y:number,width:number,height:number)=>`<rect class="parameter-marker" data-parameter-mark="${id}" x="${x}" y="${y}" width="${width}" height="${height}" rx="7" ${active?'':'visibility="hidden"'}/>`;
const value=(id:string,v:number,active:boolean)=>`<tspan data-network-parameter="${id}" class="${active?'parameter-active':''}">${n(v)}</tspan>`;
/** The expression lives on the actual input → multiply → add → output route. */
export function explorationNetwork(m:PixelModel,p:number[],selected:number,parameter:InputParameter='bias'):string {
  const w=m.inputHidden[selected]!,bias=m.hiddenBias[selected]!,f=forwardPixels(m,p),a=p[0]!*w[0]!,b=p[1]!*w[1]!,sum=a+b+bias;
  return `<svg viewBox="0 0 680 158" role="img" aria-label="뉴런 ${selected+1}: 두 입력에 각각 곱한 뒤 더하고, 음수는 0으로 보냅니다" style="--neuron:${NEURON_COLORS[selected%NEURON_COLORS.length]}">
    <path class="calc-wire" d="M90 48 H225 L287 77 M90 114 H225 L287 77 M460 77 H500"/>
    <g class="phase-input"><rect x="2" y="27" width="88" height="40" rx="10"/><text x="46" y="19" class="calc-label">가로 입력</text><text x="46" y="53">${n(p[0]!)}</text>
    <rect x="2" y="93" width="88" height="40" rx="10"/><text x="46" y="85" class="calc-label">세로 입력</text><text x="46" y="119">${n(p[1]!)}</text>
    ${marker('xWeight',parameter==='xWeight',135,17,88,29)}<text x="166" y="39">× (${value('xWeight',w[0]!,parameter==='xWeight')})</text><text x="166" y="66" class="calc-label">= ${n(a)}</text>
    ${marker('yWeight',parameter==='yWeight',135,83,88,29)}<text x="166" y="105">× (${value('yWeight',w[1]!,parameter==='yWeight')})</text><text x="166" y="133" class="calc-label">= ${n(b)}</text></g>
    <g class="phase-sum"><rect x="285" y="25" width="178" height="112" rx="18"/><text x="374" y="17" class="calc-label">은닉 뉴런 ${selected+1} · 더하기</text>
    <text x="374" y="53" class="calc-label">${n(a)} + (${n(b)})</text>${marker('bias',parameter==='bias',350,61,68,27)}<text x="374" y="80" class="calc-label">+ (${value('bias',bias,parameter==='bias')})</text><text x="374" y="113">= ${n(sum)}</text></g>
    <g class="phase-result"><rect x="506" y="44" width="171" height="74" rx="18"/><text x="591" y="32" class="calc-label">다음으로 보낼 값</text><text x="591" y="73" class="calc-label">음수면 0, 양수면 그대로</text><text x="591" y="104">${n(f.hidden[selected]!)}</text></g>
  </svg>`;
}

/** Only the chosen class's route is expanded, with every hidden contribution. */
export function explorationOutputNetwork(m:PixelModel,p:number[],selected:number,output:number,label:string):string {
  const f=forwardPixels(m,p),escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const rows=m.inputHidden.map((_,i)=>{
    const y=24+i*34,v=f.hidden[i]!,w=m.hiddenOutput[output]![i]!,color=NEURON_COLORS[i%NEURON_COLORS.length];
    return `<g style="--neuron:${color}" class="${i===selected?'output-selected':''}"><path class="calc-wire" d="M138 ${y} H337 L400 78"/><rect x="2" y="${y-14}" width="136" height="28" rx="10"/><text class="calc-label" x="70" y="${y+5}">뉴런 ${i+1} · ${n(v)}</text>${marker(`connection-${i}`,i===selected,185,y-23,68,24)}<text x="240" y="${y-6}" class="calc-label">× (${value(`connection-${i}`,w,i===selected)}) = ${n(v*w)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 680 158" role="img" aria-label="${escape(label)} 점수: 각 뉴런의 값에 연결값을 곱하고 모두 더합니다" style="--neuron:${NEURON_COLORS[selected%NEURON_COLORS.length]}">${rows}<rect x="400" y="35" width="275" height="99" rx="18"/><text x="537" y="24" class="calc-label">${escape(label)}의 점수</text><text x="537" y="61" class="calc-label">왼쪽 값을 모두 더하고</text><text x="537" y="88" class="calc-label">+ (${n(m.outputBias[output]!)})</text><text x="537" y="118">= ${n(f.logits[output]!)}</text></svg>`;
}
