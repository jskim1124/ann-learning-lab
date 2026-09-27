import { describe,it,expect } from 'vitest';
import { learningDirection,parameterValue,withParameter,zeroPoint,type InputParameter } from './explorationLearning';
import { evaluatePixelModel,initializePixelModel,trainPixelModel } from './pixelNetwork';
const data=[{pixels:[-.7,-.2],label:0},{pixels:[.3,.8],label:1},{pixels:[.9,-.1],label:0}];
describe('탐구의 오차와 실제 학습 방향',()=>{
  it.each<InputParameter>(['xWeight','yWeight','bias'])('%s 변화율은 수치 미분 및 실제 학습과 일치한다',p=>{
    const m=initializePixelModel(2,2,2,31,'relu');m.hiddenBias[0]=.4;
    const d=learningDirection(m,data,0,p),epsilon=1e-6;
    const numerical=(evaluatePixelModel(withParameter(m,0,p,d.value+epsilon),data).loss-evaluatePixelModel(withParameter(m,0,p,d.value-epsilon),data).loss)/(2*epsilon);
    expect(d.gradient).toBeCloseTo(numerical,7);expect(d.nextLoss).toBeLessThanOrEqual(d.loss+1e-12);
    expect(parameterValue(trainPixelModel(m,data,1,d.rate),0,p)).toBeCloseTo(d.next,12);
    expect(data.reduce((sum,row)=>sum+learningDirection(m,[row],0,p).gradient,0)/data.length).toBeCloseTo(d.gradient,12);
  });
  it('연결되지 않거나 꺼진 뉴런의 수에 거짓 이동 방향을 만들지 않는다',()=>{
    const m=initializePixelModel(2,1,2);m.activation='relu';m.hiddenBias[0]=-10;
    const d=learningDirection(m,data,0,'bias');expect(d.gradient).toBe(0);expect(d.next).toBe(d.value);
  });
  it('기준선 위의 점은 실제 합이 0이고 화면 밖·퇴화된 선은 만들지 않는다',()=>{
    const m=initializePixelModel(2,1,2);m.inputHidden[0]=[-1.57,.24];m.hiddenBias[0]=-.43;
    const z=zeroPoint(m,0)!;expect(z[0]*-1.57+z[1]*.24-.43).toBeCloseTo(0,12);
    m.hiddenBias[0]=10;expect(zeroPoint(m,0)).toBeNull();m.inputHidden[0]=[0,0];m.hiddenBias[0]=0;expect(zeroPoint(m,0)).toBeNull();
  });
});
