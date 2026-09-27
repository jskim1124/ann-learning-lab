import { describe,it,expect } from 'vitest';
import { imageExplorationSource,penaltyExplorationSource } from './explorationSource';
import { ImageLabStore } from '../state/imageLabStore';
import { projectPixels } from './pixelProjection';
import { ManualLab } from './manualLab';
import { evaluatePixelModel,trainPixelModel } from './pixelNetwork';

describe('탐구와 실제 연습의 계산 연결',()=>{
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
