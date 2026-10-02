import { describe,it,expect } from 'vitest';
import { ImageLabStore } from '../state/imageLabStore';
import { imageExplorationSource } from '../core/explorationSource';
import { axisTrace,featureGroups,featurePicture,featureExpression } from './featureTrace';
import { exampleComparison } from './exampleFeedback';
import { ManualLab,copyModel } from '../core/manualLab';
describe('표시된 특징 계산과 실제 좌표',()=>{
  for(const id of ['lr','tb','ink','center','position'])it(id+'의 그룹 계산은 실제 특징 합을 정확히 보존한다',()=>{
    const store=new ImageLabStore('omr');store.setAxes(id,id==='ink'?'lr':'ink');const source=imageExplorationSource(store.snapshot),c=source.axisCalculation!(4,0),g=featureGroups(id,c);
    const total=id==='lr'||id==='tb'?g[0]!.value-g[1]!.value:g.reduce((s,v)=>s+v.value,0);
    expect(total).toBeCloseTo(c.total,10);expect((total-c.mean)/c.scale).toBeCloseTo(source.data[4]!.pixels[0]!,10);
    expect(axisTrace(source,4,0)).toContain(c.coordinate.toFixed(2));expect(featureExpression(id,c)).not.toContain('고른 칸');
  });
  it('특징별로 다른 영역을 강조하며 이미지의 실제 진하기는 보존한다',()=>{
    const pixels=Array.from({length:196},(_,i)=>i/196);
    expect(featurePicture(pixels,'lr',1)).not.toEqual(featurePicture(pixels,'lr',2));
    expect(featurePicture(pixels,'lr',1)).not.toEqual(featurePicture(pixels,'tb',1));
    expect(featurePicture(pixels,'center',1).match(/opacity=".22"/g)).toHaveLength(36);
    expect(featurePicture(pixels,'position',1,3).match(/opacity=".22"/g)).toHaveLength(14);
    expect(featurePicture(pixels,'ink',1).match(/opacity=".22"/g)).toHaveLength(196);
  });
  it('다중 클래스에서 정답의 확률 변화는 실제 모델 출력과 일치한다',()=>{
    const lab=new ManualLab('data',{data:[{pixels:[.5,.5],label:2}],classes:['A','B','C'],axes:['x','y'],note:''}),before=lab.model,after=copyModel(before);
    after.hiddenOutput[2]![0]=2;const c=exampleComparison(before,after,[.5,.5],2);
    expect(c.result).toBe('better');expect(c.delta).toBeGreaterThan(0);expect(c.to.probabilities.reduce((s,p)=>s+p,0)).toBeCloseTo(1,12);
    expect(exampleComparison(after,before,[.5,.5],2).result).toBe('worse');
  });
});
