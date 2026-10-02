import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { NEURON_COLORS } from '../visualization/neuronColors';
import type { InputParameter } from '../core/explorationLearning';
const n=(v:number)=>Math.abs(v)<.005?'0.00':v.toFixed(2);
// Bold, underlined text identifies the editable number without overlapping shapes.
const value=(id:string,v:number,active:boolean)=>`<tspan data-network-parameter="${id}" class="${active?'parameter-active':''}">${n(v)}</tspan>`;
/** The expression lives on the actual input → multiply → add → output route. */
export function explorationNetwork(m:PixelModel,p:number[],selected:number,parameter?:InputParameter):string {
  const w=m.inputHidden[selected]!,bias=m.hiddenBias[selected]!,f=forwardPixels(m,p),a=p[0]!*w[0]!,b=p[1]!*w[1]!,sum=a+b+bias;
  return `<svg viewBox="0 0 680 158" role="img" aria-label="뉴런 ${selected+1}: 두 입력에 각각 곱한 뒤 더하고, 음수는 0으로 보냅니다" style="--neuron:${NEURON_COLORS[selected%NEURON_COLORS.length]}">
    <path class="calc-wire" d="M90 48 H225 L287 77 M90 114 H225 L287 77 M460 77 H500"/>
    <g class="phase-input"><rect x="2" y="27" width="88" height="40" rx="10"/><text x="46" y="19" class="calc-label">가로 입력</text><text x="46" y="53">${n(p[0]!)}</text>
    <rect x="2" y="93" width="88" height="40" rx="10"/><text x="46" y="85" class="calc-label">세로 입력</text><text x="46" y="119">${n(p[1]!)}</text>
    <text x="166" y="39">× (${value('xWeight',w[0]!,parameter==='xWeight')})</text><text x="166" y="66" class="calc-label">= ${n(a)}</text>
    <text x="166" y="105">× (${value('yWeight',w[1]!,parameter==='yWeight')})</text><text x="166" y="133" class="calc-label">= ${n(b)}</text></g>
    <g class="phase-sum"><rect x="285" y="25" width="178" height="112" rx="18"/><text x="374" y="17" class="calc-label">은닉 뉴런 ${selected+1} · 더하기</text>
    <text x="374" y="53" class="calc-label">${n(a)} + (${n(b)})</text><text x="374" y="80" class="calc-label">+ (${value('bias',bias,parameter==='bias')})</text><text x="374" y="113">= ${n(sum)}</text></g>
    <g class="phase-result"><rect x="506" y="44" width="171" height="74" rx="18"/><text x="591" y="32" class="calc-label">다음으로 보낼 값</text><text x="591" y="73" class="calc-label">음수면 0, 양수면 그대로</text><text x="591" y="104">${n(f.hidden[selected]!)}</text></g>
  </svg>`;
}

/** One chosen hidden neuron fans out to every class, each with its own weight. */
export function explorationOutputNetwork(m:PixelModel,p:number[],selected:number,output:number,labels:string[]):string {
  const f=forwardPixels(m,p),height=Math.max(136,labels.length*26+14),middle=height/2;
  const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
  const rows=labels.map((label,c)=>{
    const y=20+c*26,w=m.hiddenOutput[c]![selected]!,v=f.hidden[selected]!;
    return `<g data-output-class="${c}" class="${c===output?'output-selected':''}"><path class="calc-wire" data-output-wire="${c}" style="opacity:${w===0?.28:.75};stroke-dasharray:${w===0?'5 5':'none'}" d="M145 ${middle} C210 ${middle} 208 ${y} 258 ${y} H476"/>
      <text x="354" y="${y-6}" class="calc-label">× (${value('connection-'+selected,w,c===output)}) = ${n(v*w)}</text>
      <rect x="480" y="${y-14}" width="196" height="24" rx="9"/><text x="578" y="${y+4}" class="calc-label">${escape(label)} · 점수 ${n(f.logits[c]!)}</text></g>`;
  }).join('');
  const terms=f.hidden.map((h,i)=>n(h)+' × ('+n(m.hiddenOutput[output]![i]!)+')').join(' + ');
  return `<svg class="class-connection-network" viewBox="0 0 680 ${height}" role="img" aria-label="뉴런 ${selected+1}에서 각 클래스로 가는 가중치와 전체 점수" style="--neuron:${NEURON_COLORS[selected%NEURON_COLORS.length]}">${rows}
    <rect x="2" y="${middle-26}" width="143" height="53" rx="12"/><text x="74" y="${middle-6}" class="calc-label">뉴런 ${selected+1}의 값</text><text x="74" y="${middle+17}">${n(f.hidden[selected]!)}</text></svg>
    <div class="output-score-equation">${escape(labels[output]!)} 점수 = ${terms} + (${n(m.outputBias[output]!)}) = <b>${n(f.logits[output]!)}</b></div>`;
}
