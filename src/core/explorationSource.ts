import type { ManualSource } from './manualLab';
import type { ImageState } from '../state/imageLabStore';
import { featureCalculation, featureScore, type ImageFeature } from './imageFeatures';
import { projectPixels } from './pixelProjection';
import { projectCustomDataset, type CustomDatasetDraft } from '../data/customDataset';

export interface ExplorationSource extends ManualSource {
  kind: 'penalty' | 'image' | 'tabular';
  pictures?: number[][];
  features?: Pick<ImageFeature,'id'|'name'|'description'>[];
  featureIds?: [string,string];
  records?: {name:string;values:[number,number]}[];
  numericCalculation?: (index:number,axis:0|1)=>{value:number;low:number;high:number;coordinate:number};
  axisCalculation?: (index:number,axis:0|1)=>{
    terms: {pixel:number;weight:number;product:number}[];
    positive:number;negative:number;total:number;mean:number;scale:number;coordinate:number;
  };
}
/** The tabular journey and practice share the same min/max normalization. */
export function customExplorationSource(draft:CustomDatasetDraft):ExplorationSource {
  const projection=projectCustomDataset(draft);
  const textDescriptions=['공백을 빼고 글자를 셉니다.','공백으로 나뉜 덩어리를 셉니다.','공백을 뺀 글자에서 서로 다른 글자 수 ÷ 전체 글자 수 × 100입니다. 영문 대소문자는 같게 셉니다.','공백을 뺀 글자에서 숫자(0~9) 수 ÷ 전체 글자 수 × 100입니다.'];
  return {
    kind:'tabular',classes:projection.classes,axes:projection.axes,
    data:projection.points.map(p=>({pixels:[p.x,p.y],label:p.label})),
    features:draft.features.map((name,i)=>({id:String(i),name,description:draft.inputKind==='text'?textDescriptions[i]??'': '자료 수집에서 직접 입력한 숫자입니다.'})),
    featureIds:[String(draft.xFeature),String(draft.yFeature)],
    records:draft.rows.map(r=>({name:r.name,values:[r.values[draft.xFeature]??0,r.values[draft.yFeature]??0]})),
    numericCalculation:(index,axis)=>{
      const feature=axis===0?draft.xFeature:draft.yFeature,values=draft.rows.map(r=>r.values[feature]??0);
      return {value:values[index]??0,low:values.length?Math.min(...values):0,high:values.length?Math.max(...values):0,coordinate:axis===0?projection.points[index]?.x??0:projection.points[index]?.y??0};
    },
    note:(draft.inputKind==='text'?'글의 길이와 구성만 세며, 문장의 뜻을 이해하지는 않아요. ':'')+'고른 두 특징과 자료는 연습에도 이어집니다. 여기서 고친 작은 모델과 연습 모델의 학습 상태는 별개입니다. 여기서는 음수를 0으로 바꾸며, 연습에서는 중간값을 바꾸는 방법도 선택할 수 있어요.',
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
