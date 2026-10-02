import {it,expect} from 'vitest';
import {learningScore} from './learningScore';
it('오차 감소에 따라 증가하며 정답 가능성의 기하평균이다',()=>{
  expect(learningScore(0)).toBe(100);
  expect(learningScore(-Math.log(.5))).toBeCloseTo(50);
  expect(learningScore((-Math.log(.25)-Math.log(.81))/2)).toBeCloseTo(45);
  expect(learningScore(.3)).toBeGreaterThan(learningScore(.5));
});
