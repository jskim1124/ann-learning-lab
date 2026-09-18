import type { PixelModel, PixelExample } from "../core/pixelNetwork";
import type { PixelProjection, PixelAxisLegend } from "../core/pixelProjection";
import { drawPixelLatentMap, MAP_MARGIN } from "./pixelLatentMap";

/** Current regions always come from the current model, including interpolated display frames. */
export function drawLessonMovement(canvas:HTMLCanvasElement,before:PixelModel,current:PixelModel,data:PixelExample[],point:number[],projection:PixelProjection,labels:string[],axisLegend?:PixelAxisLegend,toy=false):void {
  drawPixelLatentMap(canvas,current,data,point,projection,{view:"decision",onlyNeuron:0,showDecisionBoundary:true,showNeuronBoundaries:true,classLabels:labels,focusLabel:toy?"고정된 점 · 정답 B":"고른 그림",axisLegend,resolution:48});
  const ctx=canvas.getContext("2d");if(!ctx)return;
  // Matches the shared map's geometry. No second, differently scaled map is layered on top.
  const width=canvas.width/(window.devicePixelRatio||1),height=canvas.height/(window.devicePixelRatio||1);
  const {left,top}=MAP_MARGIN,w=width-left-MAP_MARGIN.right,h=height-top-MAP_MARGIN.bottom;
  const px=(x:number)=>left+(x+1)/2*w,py=(y:number)=>top+(1-y)/2*h;
  if(toy){
    const y=point[1]!,start=.5-.5*y-before.hiddenBias[0]!,end=.5-.5*y-current.hiddenBias[0]!;
    ctx.strokeStyle="#344054";ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(px(-1),py(y));ctx.lineTo(px(1),py(y));ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#202633";ctx.beginPath();ctx.arc(px(end),py(y),5,0,Math.PI*2);ctx.fill();
    if(Math.abs(end-start)>.005){const ex=px(end),sx=px(start),yy=py(y)+25;ctx.strokeStyle="#1f6bd6";ctx.fillStyle="#1f6bd6";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sx,yy);ctx.lineTo(ex,yy);ctx.stroke();ctx.beginPath();ctx.moveTo(ex,yy);ctx.lineTo(ex+8,yy-5);ctx.lineTo(ex+8,yy+5);ctx.closePath();ctx.fill();}
  }
}
