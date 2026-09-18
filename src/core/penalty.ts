import type { Label, NetworkModel } from '../types';
import type { PixelModel } from './pixelNetwork';
import { trainOne } from './neuralNetwork';

export type GoalPick={u:number;v:number};
export type PenaltyRole='kicker'|'keeper';
// Bounds of the opening in our un-cropped 3:2 photograph. Both roles use the kicker's viewpoint.
export const GOAL_BOUNDS={left:.06,top:.225,width:.88,height:.43};
export const PENALTY_PROJECTION={mean:[0,0],horizontal:[1,0],vertical:[0,1],horizontalScale:1,verticalScale:1};
export const PENALTY_AXES={horizontal:{title:'공이 향한 좌우 위치',negative:'왼쪽',positive:'오른쪽'},vertical:{title:'골키퍼가 향한 좌우 위치',negative:'왼쪽',positive:'오른쪽'}};
export const directionCoordinate=(u:number)=>Number((2*u-1).toFixed(2));
export function pickInGoal(x:number,y:number):GoalPick|null {
  const u=(x-GOAL_BOUNDS.left)/GOAL_BOUNDS.width,v=(y-GOAL_BOUNDS.top)/GOAL_BOUNDS.height;
  if(!Number.isFinite(u)||!Number.isFinite(v)||u<0||u>1||v<0||v>1||Math.abs(u-.5)<.025)return null;
  return {u:Math.round(u*100)/100,v:Math.round(v*100)/100};
}
export function penaltyRecord(kick:GoalPick,keeper:GoalPick):{x:number;y:number;label:Label} {
  const x=directionCoordinate(kick.u),y=directionCoordinate(keeper.u);
  if(x===0||y===0)throw new Error('가운데 방향은 이번 두 방향 규칙에서 제외합니다.');
  return {x,y,label:x*y<0?1:0};
}
/** Simple ReLU calculation model, not claimed to be a learned football predictor. */
export function penaltyTeachingModel(hidden=2):NetworkModel {
  return {config:{hiddenUnits:hidden,activation:'relu',learningRate:.08,seed:31},epoch:0,
    parameters:{inputHidden:[[1,1],[-1,-1]].slice(0,hidden) as [number,number][],hiddenBias:[-.25,-.25].slice(0,hidden),hiddenOutput:[-1,-1].slice(0,hidden),outputBias:.5}};
}
/** softmax([0,z]) === sigmoid(z); the blocked score is a fixed reference, not a second trained output. */
export function penaltyPixelModel(m:NetworkModel):PixelModel {
  return {inputSize:2,hiddenUnits:m.config.hiddenUnits,classCount:2,activation:m.config.activation,epoch:m.epoch,
    inputHidden:m.parameters.inputHidden,hiddenBias:m.parameters.hiddenBias,hiddenOutput:[Array(m.config.hiddenUnits).fill(0),m.parameters.hiddenOutput],outputBias:[0,m.parameters.outputBias]};
}
export const PENALTY_CASES=[{pixels:[-.5,-.5],label:0},{pixels:[-.5,.5],label:1},{pixels:[.5,-.5],label:1},{pixels:[.5,.5],label:0}];
export function penaltyLearningTrace():NetworkModel[] {
  let m=penaltyTeachingModel();m={...m,parameters:{...m.parameters,hiddenBias:[.5,.5],outputBias:.2}};
  const frames=[m];for(let i=0;i<20;i++){m=trainOne(m,[{x:-.5,y:.5,label:1}]);frames.push(m);}return frames;
}
