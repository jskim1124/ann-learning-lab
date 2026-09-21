import { forwardPixels, type PixelModel } from './pixelNetwork';

/** The same labelled examples and exact arithmetic are carried through all four scenes. */
export const JOURNEY_ROWS = [
  { cells:[1,.5,0,.5], label:1 },
  { cells:[0,.5,1,.5], label:1 },
  { cells:[.5,0,.5,0], label:0 },
  { cells:[.5,.5,.5,.5], label:0 },
  { cells:[1,.5,1,.5], label:0 },
  { cells:[1,1,0,0], label:1 },
  { cells:[0,0,1,1], label:1 },
];
export type JourneyFeature = 'top'|'bottom'|'all';
export const JOURNEY_FEATURES:Record<JourneyFeature,string>={top:'윗줄 평균',bottom:'아랫줄 평균',all:'전체 평균'};
export function journeyFeature(cells:number[],feature:JourneyFeature):number {
  const values=feature==='top'?cells.slice(0,2):feature==='bottom'?cells.slice(2):cells;
  return values.reduce((a,b)=>a+b,0)/values.length;
}
export function journeyPoint(cells:number[],x:JourneyFeature='top',y:JourneyFeature='bottom'):[number,number] {
  return [journeyFeature(cells,x),journeyFeature(cells,y)];
}
export function journeyModel(bias=0,second=false,connection=0,vertical=false):PixelModel {
  return {inputSize:2,hiddenUnits:second?2:1,classCount:2,epoch:0,activation:'relu',
    inputHidden:second?[[1,-1],vertical?[0,1]:[-1,1]]:[[1,-1]],hiddenBias:second?[bias,vertical?-.5:0]:[bias],
    hiddenOutput:second?[[0,0],[1,connection]]:[[0],[1]],outputBias:[.25,0]};
}
export function journeyPrediction(model:PixelModel,point:number[]):number|null {
  const scores=forwardPixels(model,point).logits;
  return Math.abs(scores[0]!-scores[1]!)<1e-9?null:scores[0]!>scores[1]!?0:1;
}
export function journeyScore(model:PixelModel):number {
  return JOURNEY_ROWS.filter(r=>journeyPrediction(model,journeyPoint(r.cells))===r.label).length;
}
export const decimal=(value:number):string=>(Math.abs(value)<.005?0:value).toFixed(2);
