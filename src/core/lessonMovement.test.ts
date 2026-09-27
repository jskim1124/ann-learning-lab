import {describe,it,expect} from 'vitest';
import {lessonMovement} from './lessonMovement';
import {journeyModel} from './understandingJourney';
import {forwardPixels} from './pixelNetwork';
describe('예측용 숫자와 선의 실제 방정식',()=>{
  it.each([[.5,.25],[.25,.5],[.5,0]])('%s → %s: 계산한 자리는 실제 뉴런의 0 선에 있다',(before,after)=>{
    const m=lessonMovement(before,after);const model=journeyModel(-after);
    expect(m.afterX-.25-after).toBeCloseTo(0);
    expect(forwardPixels(model,[.75,.25]).hidden[0]).toBeCloseTo(m.afterSignal);
    expect(m.direction).toBe(after<before?'left-up':'right-down');
  });
});
