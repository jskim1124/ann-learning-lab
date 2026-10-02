import type { ExplorationSource } from '../core/explorationSource';

type Calculation = NonNullable<ReturnType<NonNullable<ExplorationSource['axisCalculation']>>>;
export const featureNumber=(v:number)=>Math.abs(v)<.005?'0.00':v.toFixed(2);
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Group the actual pixel products. This never changes the feature or its coordinates. */
export function featureGroups(id:string,c:Calculation):{name:string;value:number}[] {
  const sum=(test:(i:number)=>boolean)=>c.terms.reduce((s,t,i)=>s+(test(i)?t.product:0),0);
  if(id==='lr')return [{name:'오른쪽 칸의 진하기 합',value:sum(i=>i%14>=7)},{name:'왼쪽 칸의 진하기 합',value:-sum(i=>i%14<7)}];
  if(id==='tb')return [{name:'위쪽 칸의 진하기 합',value:sum(i=>i<98)},{name:'아래쪽 칸의 진하기 합',value:-sum(i=>i>=98)}];
  if(id==='position')return Array.from({length:14},(_,x)=>({name:`${x+1}열 진하기 합 × ${x+1}`,value:sum(i=>i%14===x)}));
  return [{name:id==='center'?'가운데 36칸의 진하기 합':'196칸의 진하기 합',value:c.total}];
}

export function featureExpression(id:string,c:Calculation):string {
  const g=featureGroups(id,c),n=featureNumber;
  if(id==='lr'||id==='tb')return `${g[0]!.name} ${n(g[0]!.value)} − ${g[1]!.name} ${n(g[1]!.value)} = ${n(c.total)}`;
  if(id==='position')return `열마다 (진하기 합 × 열 번호)를 구한 뒤, 14개를 더해 ${n(c.total)}`;
  return `${g[0]!.name} = ${n(c.total)}`;
}

/** Large original image plus a feature-specific mask; colours mark terms, not labels. */
export function featurePicture(pixels:number[],id:string,phase=2,column=0):string {
  const active=(i:number)=>phase===0?false:id==='lr'?(phase===1?i%14>=7:i%14<7):id==='tb'?(phase===1?i<98:i>=98):id==='center'?i%14>=4&&i%14<=9&&Math.floor(i/14)>=4&&Math.floor(i/14)<=9:id==='position'?i%14===column:true;
  const color=(id==='lr'||id==='tb')&&phase===2?'#7446f5':'#f17605';
  return `<svg class="feature-picture" viewBox="0 0 14 14" role="img" aria-label="원본 그림에서 ${phase===0?'전체':'계산할 칸'} 보기"><rect width="14" height="14" fill="white"/>${pixels.map((v,i)=>`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="black" opacity="${v}"/>${active(i)?`<rect x="${i%14}" y="${Math.floor(i/14)}" width="1" height="1" fill="${color}" opacity=".22"/>`:''}`).join('')}<path d="${phase===0?'':id==='lr'?'M7 0V14':id==='tb'?'M0 7H14':id==='center'?'M4 4H10V10H4Z':''}" fill="none" stroke="${color}" stroke-width=".12"/></svg>`;
}

/** The two displayed calculations belong to ONE sample and each ends at its own axis. */
export function axisTrace(s:ExplorationSource,row:number,axis:0|1):string {
  const c=s.axisCalculation?.(row,axis),numeric=s.numericCalculation?.(row,axis),n=featureNumber,id=s.featureIds?.[axis]??'',name=s.features?.find(f=>f.id===id)?.name??s.axes[axis];
  const title=axis===0?'가로':'세로';
  if(c)return `<article class="feature-axis-trace" data-feature-trace="${axis}"><header><b>${title} · ${esc(name)}</b><strong>${n(c.coordinate)}</strong></header><div>${esc(featureExpression(id,c))}</div><div class="feature-coordinate">(${n(c.total)} − 평균 ${n(c.mean)}) ÷ ${c.scale<.005?'0.01보다 작은 간격':`간격 ${n(c.scale)}`} ≈ <b>${title} ${n(c.coordinate)}</b></div></article>`;
  if(numeric)return `<article class="feature-axis-trace" data-feature-trace="${axis}"><header><b>${title} · ${esc(name)}</b><strong>${n(numeric.coordinate)}</strong></header><div>이 자료의 값 ${n(numeric.value)}</div><div class="feature-coordinate">${numeric.high===numeric.low?'모든 자료의 값이 같아서 0.00':`(${n(numeric.value)} − ${n(numeric.low)}) ÷ (${n(numeric.high)} − ${n(numeric.low)}) × 1.80 − 0.90 ≈ ${n(numeric.coordinate)}`}</div></article>`;
  return `<article class="feature-axis-trace" data-feature-trace="${axis}"><header><b>${title} · ${esc(name)}</b><strong>${n(s.data[row]?.pixels[axis]??0)}</strong></header><div>가운데는 0 · 왼쪽 − · 오른쪽 +</div></article>`;
}
