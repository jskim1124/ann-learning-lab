import { copyModel } from './manualLab';
import { evaluatePixelModel, trainPixelModel, type PixelExample, type PixelModel } from './pixelNetwork';

export type InputParameter = 'xWeight' | 'yWeight' | 'bias';
export function parameterValue(m:PixelModel,h:number,p:InputParameter):number {
  return p==='bias'?m.hiddenBias[h]!:m.inputHidden[h]![p==='xWeight'?0:1]!;
}
export function withParameter(m:PixelModel,h:number,p:InputParameter,value:number):PixelModel {
  const next=copyModel(m);
  if(p==='bias')next.hiddenBias[h]=value;else next.inputHidden[h]![p==='xWeight'?0:1]=value;
  return next;
}
/** The same full-batch gradient used in real training, isolated to one parameter.
 * Loss is cross entropy, NOT geometric point-to-line distance or error rate.
 * Backtracking prevents an oversized demonstration step from increasing loss.
 */
export function learningDirection(m:PixelModel,data:PixelExample[],h:number,p:InputParameter) {
  const value=parameterValue(m,h,p),loss=evaluatePixelModel(m,data).loss;
  const gradient=value-parameterValue(trainPixelModel(m,data,1,1),h,p);
  let rate=.1,next=value-rate*gradient,nextLoss=evaluatePixelModel(withParameter(m,h,p,next),data).loss;
  for(let i=0;i<20&&nextLoss>loss+1e-12;i++){
    rate/=2;next=value-rate*gradient;nextLoss=evaluatePixelModel(withParameter(m,h,p,next),data).loss;
  }
  if(nextLoss>loss+1e-12){next=value;nextLoss=loss;rate=0;}
  return {value,loss,gradient,rate,next,nextLoss,
    lower:evaluatePixelModel(withParameter(m,h,p,value-.1),data).loss,
    higher:evaluatePixelModel(withParameter(m,h,p,value+.1),data).loss};
}

/** A visible point satisfying wx*x + wy*y + bias = 0, or null if off-screen/degenerate. */
export function zeroPoint(m:PixelModel,h:number):[number,number]|null {
  const [a,b]=m.inputHidden[h]!,c=m.hiddenBias[h]!,norm=a!*a!+b!*b!;
  if(norm<1e-12)return null;
  const candidates:[number,number][]=[[-c*a!/norm,-c*b!/norm]];
  if(Math.abs(b!)>1e-10)for(const x of [-1,0,1])candidates.push([x,(-c-a!*x)/b!]);
  if(Math.abs(a!)>1e-10)for(const y of [-1,0,1])candidates.push([(-c-b!*y)/a!,y]);
  return candidates.find(([x,y])=>Math.abs(x)<=1&&Math.abs(y)<=1)??null;
}
