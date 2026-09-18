/** Visual tokens carry the very same products used by the small calculation example. */
export function neuronArithmeticFlow(phase:number,playing=false):string {
  const rows=[{name:"가로 입력",input:"0.2",weight:"× 1",result:"0.2",y:43},{name:"세로 입력",input:"0.2",weight:"× 0.5",result:"0.1",y:119},{name:"더해주는 값",input:"0",weight:"그대로",result:"0",y:195}];
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const branches=rows.map((row,i)=>{
    const reached=phase>=i+1,active=phase===i+1;
    return `<g class="${active?'flow-active':''}"><text x="73" y="${row.y-20}" text-anchor="middle" class="flow-label">${row.name}</text><rect x="28" y="${row.y-12}" width="90" height="37" rx="12"/><text x="73" y="${row.y+13}" text-anchor="middle">${row.input}</text><path d="M 120 ${row.y+6} L 290 ${row.y+6} L 459 123" class="flow-wire ${reached?'flow-reached':''}"/><text x="180" y="${row.y-7}" text-anchor="middle" class="flow-label">${row.weight}</text>${reached?`<text x="271" y="${row.y+1}" text-anchor="middle">${row.result}</text>`:''}</g>`;
  }).join("");
  const moving=phase>=1&&phase<=3?rows[phase-1]!:null;
  const packet=moving&&!reduced?`<g class="flow-packet" aria-hidden="true"><circle r="21"/><text text-anchor="middle" y="6">${moving.result}</text><animateMotion dur=".85s" fill="freeze" path="M 290 ${moving.y+6} L 459 123"/></g>`:'';
  return `<svg viewBox="0 0 600 250" role="img" aria-label="가로 0.2에 1을 곱한 0.2, 세로 0.2에 0.5를 곱한 0.1, 더해주는 값 0이 은닉 뉴런으로 모입니다.">${branches}<rect x="460" y="72" width="122" height="103" rx="22" class="flow-total"/><text x="521" y="98" text-anchor="middle" class="flow-label">${phase===4?'합 완성':'은닉 뉴런'}</text><text x="521" y="140" text-anchor="middle" class="flow-number">${phase===4?'0.3':'?'}</text>${packet}</svg><p>${phase===4?'합 0.3이 양수이므로 그대로 출력 쪽에 보냅니다.':'색이 켜진 길을 따라 곱한 값이 뉴런으로 들어갑니다.'}</p><div class="flow-mobile-controls">${phase<4?`<button data-neuron-flow-next>한 항씩 보기</button><button data-neuron-flow-play>${playing?'Ⅱ 멈춤':'▶ 재생'}</button>`:'설명·확인에서 직접 계산해 보세요.'}</div>`;
}
