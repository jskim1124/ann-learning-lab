import {describe,it,expect} from 'vitest';
import {ManualLab} from './manualLab';
import {penaltyExplorationSource} from './explorationSource';
import {trainPixelModel,evaluatePixelModel} from './pixelNetwork';
import {trainingEvidence,outputWeightGradient,classificationReadout} from './trainingEvidence';
import {learningDirection} from './explorationLearning';
const source=penaltyExplorationSource([{x:-.5,y:-.5,label:0},{x:-.5,y:.5,label:1},{x:.5,y:-.5,label:1},{x:.5,y:.5,label:0}],['A','B']);
describe('학습 방향과 표시 지표의 실제 모델 일치',()=>{
  it('표시 지표는 실제 틀린 자료 수이며 학습 기준과 구분한다',()=>{
    const model=new ManualLab('data',source).model,next=trainPixelModel(model,source.data,10,.1),e=trainingEvidence(model,next,source.data);
    expect(e.after.correct).toBe(evaluatePixelModel(next,source.data).correct);
    expect(e.after.wrong).toBe(source.data.length-e.after.correct);
    expect(e.loss).toBe(evaluatePixelModel(next,source.data).loss);
    expect(e).not.toHaveProperty('relative');
    expect(e.examples).toHaveLength(4);expect(e.result).toBe('better');
  });
  it('동점과 여러 클래스에서도 실제 평가와 같은 정답·오답을 센다',()=>{
    const model={...new ManualLab('data',source).model,classCount:3,hiddenOutput:[[0],[0],[0]],outputBias:[0,0,0]};
    const rows=[{pixels:[0,0],label:0},{pixels:[.5,.5],label:1},{pixels:[-.5,.5],label:2}];
    const result=classificationReadout(model,rows);
    expect(result.predictions).toEqual([0,0,0]);expect(result.wrongIndices).toEqual([1,2]);
    expect(result.correct).toBe(evaluatePixelModel(model,rows).correct);
    expect(classificationReadout(model,[]).wrong).toBe(0);
  });
  it('전체 자료 기울기는 실제 한 번 학습의 입력 가중치 변화와 일치한다',()=>{
    const model=new ManualLab('data',source).model;
    for(const p of ['xWeight','yWeight','bias'] as const){const d=learningDirection(model,source.data,0,p);expect(d.nextLoss).toBeLessThanOrEqual(d.loss+1e-12);}
  });
  it('출력 연결은 0/1 선택이 아니라 p−정답에 뉴런 값을 곱한 연속적 수정이다',()=>{
    const m=new ManualLab('data',source).model,after=trainPixelModel(m,source.data,1,.1);
    for(const c of [0,1])expect(after.hiddenOutput[c]![0]).toBeCloseTo(m.hiddenOutput[c]![0]!-.1*outputWeightGradient(m,source.data,0,c),12);
  });
});
