import type { HistoryPoint } from "../types";
import { chartControls, type ChartMetric } from "../ui/learningChart";

export function chartRange(history:HistoryPoint[],metric:ChartMetric,zoom:boolean):[number,number]{
  const values=history.map(p=>metric==="loss"?p.loss:p.accuracy).filter((v):v is number=>v!==undefined&&Number.isFinite(v));
  if(!values.length)return[0,1];
  const min=Math.min(...values),max=Math.max(...values),padding=Math.max(metric==="loss"?.005:.01,(max-min)*.12);
  if(zoom)return[Math.max(0,min-padding),metric==="accuracy"?Math.min(1,max+padding):max+padding];
  return[0,metric==="accuracy"?1:Math.max(.01,max*1.08)];
}
export function drawLossChart(canvas:HTMLCanvasElement,history:HistoryPoint[]):void {
  const state=chartControls(canvas,history,()=>drawLossChart(canvas,state.history)),ctx=canvas.getContext("2d");if(!ctx)return;
  const rect=canvas.getBoundingClientRect(),w=Math.max(180,Math.round(rect.width||canvas.width)),h=Math.max(70,Math.round(rect.height||canvas.height)),dpr=window.devicePixelRatio||1;
  if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const [min,max]=chartRange(history,state.metric,state.zoom),left=45,right=12,top=12,bottom=22,plotW=w-left-right,plotH=h-top-bottom;
  const value=(p:HistoryPoint)=>state.metric==="loss"?p.loss:p.accuracy;
  const format=(v:number)=>state.metric==="accuracy"?`${(v*100).toFixed(0)}%`:v.toFixed(max-min<.1?3:2);
  ctx.font="12px sans-serif";ctx.textAlign="right";
  [min,(min+max)/2,max].forEach(v=>{const y=top+(max-v)/(max-min)*plotH;ctx.strokeStyle="#dde2ea";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle="#596574";ctx.fillText(format(v),left-5,y+4);});
  const first=history[0]?.epoch??0,last=history.at(-1)?.epoch??0;
  ctx.textAlign="left";ctx.fillText(`${first}번`,left,h-3);ctx.textAlign="right";ctx.fillText(`${last}번`,w-right,h-3);
  ctx.textAlign="center";ctx.fillText(state.zoom?"학습 횟수 · 세로축 확대":"학습 횟수",left+plotW/2,h-3);
  ctx.strokeStyle=state.metric==="accuracy"?"#df466f":"#1f6bd6";ctx.lineWidth=2.5;ctx.beginPath();let started=false;
  history.forEach(p=>{const v=value(p);if(v===undefined)return;const x=left+(p.epoch-first)/Math.max(1,last-first)*plotW,y=top+(max-v)/(max-min)*plotH;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);});ctx.stroke();
  const v=history.at(-1)&&value(history.at(-1)!);canvas.setAttribute("aria-label",`${state.metric==="loss"?"오차: 낮을수록 좋음":"학습 정답률: 높을수록 좋음"}. 현재 ${v===undefined?"자료 없음":format(v)}. 가로축은 학습 횟수입니다.`);
}
