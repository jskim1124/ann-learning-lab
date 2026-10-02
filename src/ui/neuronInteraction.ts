import type { PixelModel, PixelExample } from '../core/pixelNetwork';
import { forwardPixels, evaluatePixelModel } from '../core/pixelNetwork';
import { learningDirection, withParameter, type InputParameter } from '../core/explorationLearning';

export const PLOT={left:50,right:14,top:13,bottom:51};
export function neuronPointAt(m:PixelModel,h:number,sx:number,sy:number,width:number,height:number):number[]|null {
  const w=width-PLOT.left-PLOT.right,v=height-PLOT.top-PLOT.bottom;
  if(w<=0||v<=0||sx<PLOT.left||sx>width-PLOT.right||sy<PLOT.top||sy>height-PLOT.bottom)return null;
  let x=(sx-PLOT.left)/w*2-1,y=1-(sy-PLOT.top)/v*2;
  const [a,b]=m.inputHidden[h]!,sum=a!*x+b!*y+m.hiddenBias[h]!,A=2*a!/w,B=-2*b!/v,norm=A*A+B*B;
  // Snap only within 12 CSS pixels. The selected coordinate stays fixed on later edits.
  if(norm>1e-14&&Math.abs(sum)/Math.sqrt(norm)<=12){const px=sx-A*sum/norm,py=sy-B*sum/norm;const nx=(px-PLOT.left)/w*2-1,ny=1-(py-PLOT.top)/v*2;if(Math.abs(nx)<=1&&Math.abs(ny)<=1){x=nx;y=ny;}}
  return [x,y];
}

export function scoreEvidence(before:PixelModel,after:PixelModel,p:number[],label:number) {
  const from=forwardPixels(before,p),to=forwardPixels(after,p);
  const rival=(values:number[])=>values.reduce((best,v,i)=>i!==label&&(best===label||v>values[best]!)?i:best,label);
  const r=rival(to.logits),oldR=rival(from.logits),gap=to.logits[label]!-to.logits[r]!,oldGap=from.logits[label]!-from.logits[oldR]!;
  const loss=evaluatePixelModel(after,[{pixels:p,label}]).loss,oldLoss=evaluatePixelModel(before,[{pixels:p,label}]).loss;
  return {from,to,rival:r,gap,oldGap,loss,oldLoss,result:loss<oldLoss-1e-9?'better':loss>oldLoss+1e-9?'worse':'same'};
}

/** Geometric direction from an actual loss-reducing parameter update, not a class line. */
export function lineDirection(m:PixelModel,p:number[],label:number,h:number,parameter:InputParameter,rows:PixelExample[]=[{pixels:p,label}]) {
  const d=learningDirection(m,rows,h,parameter);
  if(Math.abs(d.next-d.value)<1e-10)return null;
  const next=withParameter(m,h,parameter,d.next);
  const project=(model:PixelModel,point:number[])=>{const [a,b]=model.inputHidden[h]!,norm=a!*a!+b!*b!;if(norm<1e-12)return null;const sum=a!*point[0]!+b!*point[1]!+model.hiddenBias[h]!;return [point[0]!-a!*sum/norm,point[1]!-b!*sum/norm];};
  const start=project(m,p);if(!start||start.some(v=>Math.abs(v)>.95))return null;
  const end=project(next,start);return end?{start,end}:null;
}
