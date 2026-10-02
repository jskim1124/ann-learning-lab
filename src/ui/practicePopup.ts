export function updatePracticePopup(root: HTMLElement, point: number[], truth: string | null, prediction: string, pixels?: number[]): void {
  const popup = root.querySelector<HTMLElement>('.practice-point-popup');
  if (!popup) return;
  const body = popup.querySelector<HTMLElement>('[data-point-body]')!;
  body.replaceChildren();
  if (pixels) {
    const image = document.createElement('canvas'); image.width = image.height = 14; image.setAttribute('aria-label','고른 자료 그림');
    const ctx = image.getContext('2d');
    pixels.forEach((v,i)=>{if(ctx){ctx.fillStyle=`rgb(${Math.round((1-v)*255)} ${Math.round((1-v)*255)} ${Math.round((1-v)*255)})`;ctx.fillRect(i%14,Math.floor(i/14),1,1);}});
    body.append(image);
  }
  const caption=document.createElement('div');
  const xy=document.createElement('span');xy.textContent=`(${point.map(v=>v.toFixed(2)).join(', ')})`;
  const answer=document.createElement('strong');answer.textContent=`${truth===null?'새 입력':`정답 ${truth}`} · 예상 ${prediction}`;
  caption.append(xy,answer);body.append(caption);
  popup.hidden=popup.dataset.open!=='true';
  const viewport=popup.parentElement!,w=viewport.clientWidth,h=viewport.clientHeight;
  // The image map includes axis margins; numeric maps reserve margins in their wrapper.
  const imageMap=!!viewport.querySelector('#imageMap');
  const x=imageMap?50+(point[0]!+1)/2*(w-64):28+(point[0]!+1)/2*(w-28);
  const y=imageMap?13+(1-point[1]!)/2*(h-64):(1-point[1]!)/2*(h-28);
  popup.style.left=`${Math.max(0,Math.min(w-(popup.offsetWidth||215),x-65))}px`;
  popup.style.top=`${Math.max(0,Math.min(h-(popup.offsetHeight||86),y+8))}px`;
}
