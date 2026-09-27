import type { ManualSource } from './manualLab';
import type { ImageState } from '../state/imageLabStore';
import { featureCalculation, featureScore, type ImageFeature } from './imageFeatures';
import { projectPixels } from './pixelProjection';

export interface ExplorationSource extends ManualSource {
  kind: 'penalty' | 'image';
  pictures?: number[][];
  features?: ImageFeature[];
  featureIds?: [string,string];
  axisCalculation?: (index:number,axis:0|1)=>{
    terms: {pixel:number;weight:number;product:number}[];
    positive:number;negative:number;total:number;mean:number;scale:number;coordinate:number;
  };
}
/** Uses precisely the same projection and feature formulas as the practice workspace. */
export function imageExplorationSource(s:ImageState):ExplorationSource {
  return {
    kind:'image',classes:[...s.classes],axes:[s.xFeature,s.yFeature].map(id=>`${s.features.find(f=>f.id===id)!.name} (평균 0)`) as [string,string],
    data:s.data.map(row=>{const p=projectPixels(s.projection,row.pixels);return {pixels:[p.x,p.y],label:row.label};}),
    pictures:s.data.map(row=>row.pixels),features:s.features,featureIds:[s.xFeature,s.yFeature],
    note:(s.mode==='pixels'?'여기는 두 특징만 쓰는 작은 실험입니다. 연습의 전체 그림 모델은 196칸을 모두 입력하므로 결과가 다를 수 있어요.':'지금 고른 특징과 자료가 연습에도 이어집니다. 여기서 고친 작은 모델과 연습 모델의 학습 상태는 별개입니다.')+' 이 실험은 음수를 0으로 바꿉니다. 연습에서는 중간값을 바꾸는 방법도 선택할 수 있어요.',
    axisCalculation:(index,axis)=>{
      const f=s.features.find(f=>f.id===(axis===0?s.xFeature:s.yFeature))!;
      const calculation=featureCalculation(f,s.data[index]?.pixels??Array(196).fill(0));
      const mean=featureScore(f,s.projection.mean),scale=axis===0?s.projection.horizontalScale:s.projection.verticalScale;
      return {...calculation,mean,scale,coordinate:(calculation.total-mean)/scale};
    },
  };
}
export function penaltyExplorationSource(rows:{x:number;y:number;label:number}[],classes:string[]):ExplorationSource {
  return {kind:'penalty',data:rows.map(r=>({pixels:[r.x,r.y],label:r.label})),classes:[...classes],axes:['키커 방향','골키퍼 방향'],note:'같은 방향이면 막힘, 다른 방향이면 골이라고 단순화한 실험입니다. 실제 경기에서는 속도·높이 등도 영향을 줍니다. 여기서 고친 모델은 연습 모델과 별개입니다. 여기서는 음수를 0으로 바꾸고, 연습에서는 중간값을 바꾸는 방법도 선택할 수 있어요.'};
}
