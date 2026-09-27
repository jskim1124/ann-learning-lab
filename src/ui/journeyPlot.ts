import { JOURNEY_ROWS, journeyPoint, decimal as n } from '../core/understandingJourney';
import { forwardPixels, type PixelModel } from '../core/pixelNetwork';
import { classContours } from '../visualization/classContours';

export interface JourneyPlotOptions {
  width:number; height:number; scene:number; separated:number; cursor:[number,number]; located:boolean;
  threshold:number; oldThreshold:number|null; selected:number; model:PixelModel; frame:number; solved:boolean;
}
const colors=['#f17605','#df466f'];
/** Shared by drawing and pointer conversion, including after tablet rotation. */
export const JOURNEY_MARGIN = { left: 68, right: 28, top: 26, bottom: 44 };
export function journeyCoordinate(x:number,y:number,width:number,height:number):[number,number] {
  const m=JOURNEY_MARGIN,clamp=(v:number)=>Math.max(0,Math.min(1,v));
  return [clamp((x-m.left)/Math.max(1,width-m.left-m.right)),clamp((height-m.bottom-y)/Math.max(1,height-m.top-m.bottom))];
}
export function renderJourneyPlot(o:JourneyPlotOptions):string {
  if(o.scene===5)return `<div class="journey-neuron-demo"><div class="journey-demo-inputs"><span class="${o.frame>=0?'lit':''}"><small>윗줄 평균</small>0.75<small>× 1.00 · 그대로</small></span><span class="${o.frame>=1?'lit':''}"><small>아랫줄 평균</small>0.25<small>× (−1.00) · 빼기</small></span></div><div class="journey-down">↓ 두 수를 받아요</div><div class="journey-calculator ${o.frame>=2?'lit':''}"><small>은닉 뉴런 1</small><strong>0.75 − 0.25</strong><span>이 예제는 두 수를 그대로 빼도록 정했어요</span></div><div class="journey-down ${o.frame>=3?'lit':''}">↓ 음수는 0으로, 그 밖에는 그대로 보내요</div><output>${o.solved?'0.50':'?'}</output></div>`;
  const {width,height,scene}=o,m=JOURNEY_MARGIN,w=Math.max(1,width-m.left-m.right),h=Math.max(1,height-m.top-m.bottom);
  const map=(x:number,y:number)=>({x:m.left+x*w,y:height-m.bottom-y*h});
  const parts:string[]=[];
  const line=(t:number,stroke:string,dash='',label='')=>{
    const a=map(Math.max(0,t),Math.max(0,-t)),b=map(Math.min(1,1+t),Math.min(1,1-t));
    return `<path d="M${a.x},${a.y}L${b.x},${b.y}" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="${dash}"/>${label?`<text x="${(a.x+b.x)/2+8}" y="${(a.y+b.y)/2-12}" fill="${stroke}">${label}</text>`:''}`;
  };
  if(scene===6){const p1=map(o.threshold,0),p2=map(1,1-o.threshold),end=map(1,0);parts.push(`<path d="M${p1.x},${p1.y}L${p2.x},${p2.y}L${end.x},${end.y}Z" fill="#f0eaff"/>`);}
  if(scene>=7){
    const count=38,grid=Array.from({length:count+1},(_,j)=>Array.from({length:count+1},(_,i)=>({...map(i/count,j/count),scores:forwardPixels(o.model,[i/count,j/count]).logits})));
    const fills=new Map<string,string>();
    for(let j=0;j<count;j++)for(let i=0;i<count;i++){
      const r=forwardPixels(o.model,[(i+.5)/count,(j+.5)/count]),winner=r.logits[0]!>r.logits[1]!?0:1,color=colors[winner]!,alpha=.10+Math.abs(r.probabilities[0]!-.5)*.55,p=map(i/count,(j+1)/count);
      const key=`${color}|${alpha.toFixed(2)}`;
      fills.set(key,(fills.get(key)??'')+`M${p.x},${p.y}h${w/count+.4}v${h/count+.4}h${-w/count-.4}Z`);
    }
    fills.forEach((path,key)=>{const [color,alpha]=key.split('|'),rgb=[1,3,5].map(i=>Math.round(255+(parseInt(color!.slice(i,i+2),16)-255)*Number(alpha)));parts.push(`<path d="${path}" fill="rgb(${rgb.join(',')})"/>`);});
    if(scene!==7||o.frame>=3){let path='';for(let j=0;j<count;j++)for(let i=0;i<count;i++)classContours([grid[j]![i]!,grid[j]![i+1]!,grid[j+1]![i+1]!,grid[j+1]![i]!]).forEach(([a,b])=>path+=`M${a.x},${a.y}L${b.x},${b.y}`);parts.push(`<path data-final-boundary d="${path}" stroke="#202633" stroke-width="3" fill="none"/>`);}
  }
  for(const v of [0,.25,.5,.75,1]){const p=map(v,v);parts.push(`<path d="M${p.x},${m.top}V${height-m.bottom}M${m.left},${p.y}H${width-m.right}" stroke="#d9dde5" stroke-width=".8"/><text x="${p.x}" y="${height-23}" text-anchor="middle">${n(v)}</text><text x="${m.left-8}" y="${p.y+5}" text-anchor="end">${n(v)}</text>`);}
  if(scene===6){
    if(o.oldThreshold!==null)parts.push(line(o.oldThreshold,'#8b93a0','6 5'));
    parts.push(line(o.threshold,'#7446f5'));
    // The crossing stays at y=.25, so the learner can relate x = .25 + threshold to motion.
    const p=map(.25+o.threshold,.25),left=map(0,.25),dot=map(.75,.25);
    parts.push(`<path d="M${left.x},${left.y}H${p.x}" stroke="#7446f5" stroke-dasharray="3 4"/><circle cx="${p.x}" cy="${p.y}" r="7" fill="white" stroke="#7446f5" stroke-width="3"/><text x="${p.x}" y="${p.y-17}" text-anchor="middle" fill="#7446f5">선의 가로 ${n(.25+o.threshold)}</text><circle cx="${dot.x}" cy="${dot.y}" r="5" fill="#df466f"/><text x="${dot.x-8}" y="${dot.y+23}" text-anchor="end">고정된 그림 B</text>`);
    const label=map(.98,.05);parts.push(`<text x="${label.x}" y="${label.y}" text-anchor="end" fill="#7446f5">뉴런이 0보다 큰 쪽</text>`);
  }else if(scene>=7){
    parts.push(line(0,'#7446f5','7 4'));
    if(scene>=8){ // opposite neurons have the SAME zero-line; color halves, do not invent two lines.
      const a=map(0,0),b=map(.5,.5);parts.push(`<path d="M${a.x},${a.y}L${b.x},${b.y}" stroke="#df466f" stroke-width="3" stroke-dasharray="7 4"/>`);
      parts.push(`<text x="${width-34}" y="${height-70}" text-anchor="end" fill="#7446f5">1: 윗줄 − 아랫줄</text><text x="${m.left+10}" y="43" fill="#df466f">2: 아랫줄 − 윗줄</text>`);
    }
    if(scene===7&&o.frame>=3){const p=map(.5,.25);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="6" fill="#202633"/><text x="${p.x}" y="${p.y+23}" text-anchor="middle">A = B = 0.25</text>`);}
  }
  if(scene===3){const p=map(...o.cursor);parts.push(`<path d="M${m.left},${p.y}H${p.x}V${height-m.bottom}" stroke="#1c68d6" stroke-width="2" stroke-dasharray="5 4"/><circle cx="${p.x}" cy="${p.y}" r="8" fill="${o.located?'#df466f':'#1c68d6'}" stroke="white" stroke-width="2"/>`);}
  else if(scene!==6)JOURNEY_ROWS.forEach((row,i)=>{
    const point=journeyPoint(row.cells),all=row.cells.reduce((a,b)=>a+b,0)/4,p=map(...(scene===4?point.map(v=>all+(v-all)*o.separated):point) as [number,number]);
    parts.push(`<g ${scene===9?`data-journey-point="${i}" role="button" tabindex="0" aria-label="${i+1}번 그림 정답 ${row.label?'B':'A'}"`:''}><circle cx="${p.x}" cy="${p.y}" r="${i===o.selected?9:6}" fill="${colors[row.label]}" stroke="white" stroke-width="2"/><text x="${Math.max(57,Math.min(width-34,p.x+12))}" y="${Math.max(17,p.y-10)}" fill="${colors[row.label]}">${row.label?'B':'A'}</text></g>`);
  });
  if(scene===4&&o.separated===0){const p=map(.5,.5);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="18" fill="white" stroke="#7446f5" stroke-width="2"/><text x="${p.x}" y="${p.y+5}" text-anchor="middle">5</text><text x="${p.x}" y="${p.y-28}" text-anchor="middle">A 1장 · B 4장이 겹침</text>`);}
  const xLabel=scene===4&&o.separated===0?'전체 평균':'윗줄 평균',yLabel=scene===4&&o.separated===0?'전체 평균':'아랫줄 평균';
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${scene===3?'그림의 좌표 찾기':'특징 지도'}"><rect x="${m.left}" y="${m.top}" width="${w}" height="${h}" rx="2" fill="#fcfcfe"/>${parts.join('')}<text x="${m.left+w/2}" y="${height-3}" text-anchor="middle">${xLabel}</text><text x="14" y="${height/2}" transform="rotate(-90 14 ${height/2})" text-anchor="middle">${yLabel}</text></svg>`;
}
