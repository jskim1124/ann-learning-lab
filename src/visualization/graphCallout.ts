import { MAP_MARGIN } from './pixelLatentMap';

/** Keep the current calculation beside its point, in the same CSS-pixel coordinates as the map. */
export function drawGraphCallout(canvas:HTMLCanvasElement, point:number[], lines:string[]):void {
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const r=canvas.getBoundingClientRect(),w=r.width||720,h=r.height||460;
  const x=MAP_MARGIN.left+(point[0]!+1)/2*(w-MAP_MARGIN.left-MAP_MARGIN.right);
  const y=MAP_MARGIN.top+(1-point[1]!)/2*(h-MAP_MARGIN.top-MAP_MARGIN.bottom);
  ctx.save();ctx.font='600 14px sans-serif';ctx.textAlign='left';
  const width=Math.min(w-MAP_MARGIN.left-18,Math.max(...lines.map(s=>ctx.measureText(s).width))+16),height=lines.length*21+10;
  const left=Math.max(MAP_MARGIN.left+4,Math.min(w-MAP_MARGIN.right-width-4,x+15));
  const top=y+height+24<h-MAP_MARGIN.bottom?y+17:Math.max(MAP_MARGIN.top+4,y-height-24);
  ctx.fillStyle='rgba(255,255,255,.96)';ctx.fillRect(left,top,width,height);ctx.strokeStyle='#7446f5';ctx.lineWidth=2;ctx.strokeRect(left,top,width,height);
  ctx.beginPath();ctx.rect(left+4,top,width-8,height);ctx.clip();ctx.fillStyle='#202633';lines.forEach((s,i)=>ctx.fillText(s,left+8,top+20+i*21));ctx.restore();
}
