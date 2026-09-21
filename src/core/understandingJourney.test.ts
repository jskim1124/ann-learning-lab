import {describe,it,expect} from 'vitest';
import {JOURNEY_ROWS,journeyPoint,journeyFeature,journeyModel,journeyScore,journeyPrediction,decimal} from './understandingJourney';
import {forwardPixels} from './pixelNetwork';
describe('한 자료를 끝까지 사용하는 공통 이해 과정',()=>{
  it('그림 평균과 좌표가 같은 계산에서 나오고 전체 평균에서는 정답이 다른 그림이 겹친다',()=>{
    expect(journeyPoint(JOURNEY_ROWS[0]!.cells)).toEqual([.75,.25]);
    expect(journeyFeature(JOURNEY_ROWS[0]!.cells,'all')).toBe(.5);
    expect(journeyFeature(JOURNEY_ROWS[3]!.cells,'all')).toBe(.5);
    expect(JOURNEY_ROWS[0]!.label).not.toBe(JOURNEY_ROWS[3]!.label);
  });
  it('더할 값을 바꾸면 합과 출력과 경계가 같은 실제 신경망을 따라 바뀐다',()=>{
    const p=journeyPoint(JOURNEY_ROWS[0]!.cells);
    expect(forwardPixels(journeyModel(-.5),p).hidden[0]).toBe(0);
    expect(forwardPixels(journeyModel(-.25),p).hidden[0]).toBe(.25);
    expect(journeyPrediction(journeyModel(-.25),p)).toBeNull();
    expect(journeyPrediction(journeyModel(0),p)).toBe(1);
    expect(journeyScore(journeyModel(0))).toBe(5);
  });
  it('뉴런만 추가하면 예측은 불변, 연결하면 양쪽 B를 찾아 7개 모두 맞힌다',()=>{
    const one=journeyModel(0),disconnected=journeyModel(0,true,0),connected=journeyModel(0,true,1);
    for(const row of JOURNEY_ROWS){const p=journeyPoint(row.cells);expect(forwardPixels(one,p).logits).toEqual(forwardPixels(disconnected,p).logits);}
    expect(journeyScore(connected)).toBe(7);expect(connected.classCount).toBe(2);
    expect(journeyPrediction(connected,[.5,.75])).toBeNull();
    expect(journeyScore(journeyModel(0,true,1,true))).toBeLessThan(7);
  });
  it('소수 두 자리 표시는 실제 값과 분리되고 음의 0을 숨긴다',()=>{
    expect(decimal(.5)).toBe('0.50');expect(decimal(-.0001)).toBe('0.00');expect(decimal(.1234)).toBe('0.12');
  });
});
