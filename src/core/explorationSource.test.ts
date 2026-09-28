import { describe,it,expect } from 'vitest';
import { customExplorationSource,imageExplorationSource,penaltyExplorationSource } from './explorationSource';
import { createCustomExample,projectCustomDataset } from '../data/customDataset';
import { ImageLabStore } from '../state/imageLabStore';
import { projectPixels } from './pixelProjection';
import { ManualLab } from './manualLab';
import { evaluatePixelModel,trainPixelModel } from './pixelNetwork';

describe('탐구와 실제 연습의 계산 연결',()=>{
  it('자율 숫자의 원자료·축·좌표는 연습에서 쓰는 값과 같다',()=>{
    const draft=createCustomExample();draft.xFeature=2;draft.yFeature=0;
    const source=customExplorationSource(draft),p=projectCustomDataset(draft);
    expect(source.axes).toEqual(p.axes);expect(source.featureIds).toEqual(['2','0']);
    expect(source.data).toEqual(p.points.map(r=>({pixels:[r.x,r.y],label:r.label})));
    draft.rows.forEach((row,i)=>{
      expect(source.records![i]!.values).toEqual([row.values[2],row.values[0]]);
      for(const axis of [0,1] as const){const c=source.numericCalculation!(i,axis);expect((c.value-c.low)/(c.high-c.low)*1.8-.9).toBeCloseTo(source.data[i]!.pixels[axis]!,12);}
    });
    draft.rows.forEach(r=>r.label=1-r.label);expect(customExplorationSource(draft).data.map(r=>r.pixels)).toEqual(source.data.map(r=>r.pixels));
  });
  it('자율 자료의 특징이 모두 같으면 좌표 0이며 나누기 0이 되지 않는다',()=>{
    const draft=createCustomExample();draft.rows.forEach(r=>r.values[0]=7);
    const s=customExplorationSource(draft);expect(s.data.every(r=>r.pixels[0]===0)).toBe(true);
    expect(s.numericCalculation!(0,0)).toEqual({value:7,low:7,high:7,coordinate:0});
  });
  it.each(['digits','omr'] as const)('%s의 원그림·가중합·좌표는 같은 원자료에서 계산한다',task=>{
    const store=new ImageLabStore(task);
    for(const [x,y] of [['ink','center'],['lr','tb'],['position','ink']]){
      store.setAxes(x!,y!);const s=store.snapshot,source=imageExplorationSource(s);
      s.data.forEach((r,i)=>{
        const p=projectPixels(s.projection,r.pixels);expect(source.data[i]!.pixels).toEqual([p.x,p.y]);
        for(const axis of [0,1] as const){const c=source.axisCalculation!(i,axis);expect(c.terms.reduce((a,t)=>a+t.product,0)).toBeCloseTo(c.total,12);expect((c.total-c.mean)/c.scale).toBeCloseTo(source.data[i]!.pixels[axis]!,10);}
      });
    }
  });
  it('클래스 이름을 바꿔도 특징 추출 값은 바뀌지 않는다',()=>{
    const store=new ImageLabStore('digits'),old=imageExplorationSource(store.snapshot).data;store.renameClass(0,'다른 이름');expect(imageExplorationSource(store.snapshot).data).toEqual(old);
  });
  it('클래스가 10개여도 시작 연결값은 슬라이더 범위 안에 있다',()=>{
    const source=penaltyExplorationSource([],Array.from({length:10},(_,i)=>String(i))),lab=new ManualLab('data',source);
    expect(lab.model.classCount).toBe(10);expect(lab.model.outputBias.every(v=>v>=-2&&v<=2)).toBe(true);
  });
  it('실험의 자동 고치기는 동일한 백프로퍼게이션을 사용하며 한 번 되돌릴 수 있다',()=>{
    const lab=new ManualLab('data',penaltyExplorationSource([{x:-.5,y:-.5,label:0},{x:.5,y:-.5,label:1}],['막힘','골']));
    const before=lab.model,expected=trainPixelModel(before,lab.source.data,1,.1);lab.trainStep();expect(lab.model).toEqual(expected);
    expect(evaluatePixelModel(lab.model,lab.source.data).loss).toBeLessThan(evaluatePixelModel(before,lab.source.data).loss);
    lab.undo();expect(lab.model).toEqual(before);
  });
});
