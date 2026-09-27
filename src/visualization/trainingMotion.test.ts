import {describe,it,expect} from 'vitest';
import {TrainingMotionHistory} from './trainingMotion';
import {journeyModel} from '../core/understandingJourney';
describe('실제 학습 시점의 이동 이력',()=>{
  it('입력 점만 움직여서는 이력이 늘지 않고 파라미터는 복사해 보존한다',()=>{
    const history=new TrainingMotionHistory(),model=journeyModel(-.5);history.record(model);history.record(model);expect(history.frames).toHaveLength(1);
    model.epoch=10;model.hiddenBias[0]=-.25;history.record(model);expect(history.frames[0]!.planes[0]![2]).toBe(-.5);expect(history.frames[1]!.epoch).toBe(10);
  });
  it('초기화·뉴런 수·같은 회차의 파라미터 교체는 이전 흔적을 지운다',()=>{
    const history=new TrainingMotionHistory();history.record(journeyModel());history.record({...journeyModel(),epoch:10});history.record(journeyModel());expect(history.frames).toHaveLength(1);
    history.record({...journeyModel(0,true),epoch:10});expect(history.frames).toHaveLength(1);
    history.record({...journeyModel(-.25,true),epoch:10});expect(history.frames).toHaveLength(1);
  });
  it('이력은 최근 세 시점으로 제한한다',()=>{const h=new TrainingMotionHistory();for(let epoch=0;epoch<10;epoch++)h.record({...journeyModel(),epoch});expect(h.frames.map(f=>f.epoch)).toEqual([7,8,9]);});
});
