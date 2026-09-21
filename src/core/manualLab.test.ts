import { describe,it,expect } from 'vitest';
import { ManualLab,manualPrediction,manualScore,type ManualSource } from './manualLab';
import { forwardPixels } from './pixelNetwork';

const source:ManualSource={data:[{pixels:[-.5,.5],label:0},{pixels:[.5,-.5],label:1}],classes:['왼쪽','오른쪽'],axes:['길이','높이'],note:'test'};
describe('학생이 직접 고치는 실제 신경망',()=>{
  it('아직 자료가 없으면 정답을 꾸며 내지 않고 계산용 좌표에서 시작한다',()=>{
    const l=new ManualLab('data',{...source,data:[]});
    expect(l.pointIndex).toBeNull();expect(l.point).toEqual([.5,.5]);expect(l.score).toBe(0);expect(l.won).toBe(false);
  });
  it('선의 자리만 고쳐 첫 과제의 오답을 줄인다',()=>{
    const l=new ManualLab('move',source);expect(l.score).toBe(3);
    l.edit('bias',0);expect(l.score).toBe(6);expect(l.won).toBe(true);expect(l.model.epoch).toBe(0);
    l.undo();expect(l.score).toBe(3);expect(l.model.hiddenBias[0]).toBe(-.5);
  });
  it('뉴런 추가는 기존 모델을 보존하고 연결해야 꺾인 경계가 생긴다',()=>{
    const l=new ManualLab('bend',source),before=l.source.data.map(row=>forwardPixels(l.model,row.pixels));
    expect(l.score).toBe(4);l.addNeuron();
    l.source.data.forEach((row,i)=>expect(forwardPixels(l.model,row.pixels).probabilities).toEqual(before[i]!.probabilities));
    l.edit('connection',1);expect(l.score).toBe(6);
    // Three pieces: vertical, diagonal, horizontal. These are actual score ties.
    for(const point of [[.5,-.5],[.25,.25],[-.5,.5]])expect(manualPrediction(l.model,point)).toBeNull();
    l.muted=1;expect(l.score).toBe(4);l.muted=null;expect(l.score).toBe(6);
    expect(forwardPixels(l.model,[.5,.5]).logits).toEqual([0,.5]);
  });
  it('기준선을 넘었다고 항상 답이 바뀌는 것은 아니며 출력 연결에 따라 방향이 다르다',()=>{
    const l=new ManualLab('bend',source);l.choosePoint([.5,.5],null);
    expect(l.biasPreview().after).toBeGreaterThan(l.biasPreview().before);
    l.edit('connection',-1);expect(l.biasPreview().after).toBeLessThan(l.biasPreview().before);
    l.edit('connection',0);expect(l.biasPreview().after).toBe(l.biasPreview().before);
    l.edit('bias',-.5);expect(l.calculation.sum).toBe(0);expect(l.calculation.answer).toBe(0);
    expect(manualPrediction(l.model,[.5,.5])).toBe(0);
  });
  it('뉴런의 음수는 0으로 바꾸고 동점은 정답으로 세지 않는다',()=>{
    const l=new ManualLab('bend',source);l.choosePoint([-.5,1],null);expect(l.calculation.answer).toBe(0);
    l.model.hiddenOutput.forEach(row=>row.fill(0));l.model.outputBias.fill(0);
    expect(manualScore(l.model,l.source.data)).toBe(0);expect(manualPrediction(l.model,[0,0])).toBeNull();
  });
  it('연속 드래그는 하나의 시도로 묶여 한 번에 되돌아간다',()=>{
    const l=new ManualLab('move',source);l.beginGesture();for(const value of [-.25,0,.25,.5])l.edit('bias',value);l.endGesture();
    expect(l.edits).toBe(1);expect(l.history).toHaveLength(1);l.undo();expect(l.model.hiddenBias[0]).toBe(-.5);
  });
  it('원래 자료와 모델을 훼손하지 않고 각 과제를 따로 실험한다',()=>{
    const initial=JSON.stringify(source),l=new ManualLab('data',source);
    l.source.data[0]!.pixels[0]=1;l.source.classes[0]='new';l.addNeuron();l.removeNeuron();l.reset();
    expect(JSON.stringify(source)).toBe(initial);expect(l.model.hiddenUnits).toBe(1);expect(l.history).toHaveLength(0);
    const count=l.edits;l.edit('bias',l.model.hiddenBias[0]!);l.edit('bias',NaN);expect(l.edits).toBe(count);
    for(let i=0;i<8;i++)l.addNeuron();expect(l.model.hiddenUnits).toBe(4);
    for(let i=0;i<8;i++)l.removeNeuron();expect(l.model.hiddenUnits).toBe(1);
  });
});
