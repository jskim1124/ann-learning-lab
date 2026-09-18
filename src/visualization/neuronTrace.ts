import { traceHits, type LessonStroke } from "../core/neuronTrace";
import { MAP_MARGIN } from "./pixelLatentMap";

/** Trace overlays use the exact same logical-pixel geometry as the underlying map. */
export function drawNeuronTrace(canvas: HTMLCanvasElement, strokes: LessonStroke[], output: boolean): void {
  if (!strokes.length) return;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const ratio = window.devicePixelRatio || 1;
  const w = canvas.width/ratio-MAP_MARGIN.left-MAP_MARGIN.right;
  const h = canvas.height/ratio-MAP_MARGIN.top-MAP_MARGIN.bottom;
  const x=(v:number)=>MAP_MARGIN.left+(v+1)/2*w, y=(v:number)=>MAP_MARGIN.top+(1-v)/2*h;
  ctx.save(); ctx.beginPath(); ctx.rect(MAP_MARGIN.left,MAP_MARGIN.top,w,h); ctx.clip();
  ctx.lineWidth=3;ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#87909b";
  for (const stroke of strokes) {
    ctx.beginPath();stroke.forEach((p,i)=>i?ctx.lineTo(x(p[0]),y(p[1])):ctx.moveTo(x(p[0]),y(p[1])));ctx.stroke();
  }
  for (const hit of traceHits(strokes,output)) {
    ctx.beginPath();ctx.arc(x(hit[0]),y(hit[1]),7,0,Math.PI*2);
    ctx.fillStyle=output?"#1f6bd6":"#7446f5";ctx.fill();ctx.strokeStyle="white";ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();
}
