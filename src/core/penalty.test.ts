import {describe,it,expect} from 'vitest';
import {directionCoordinate,pickInGoal,penaltyRecord,GOAL_BOUNDS,penaltyTeachingModel,penaltyPixelModel,penaltyLearningTrace,PENALTY_CASES} from './penalty';
import {forward} from './neuralNetwork';
import {forwardPixels} from './pixelNetwork';

describe('승부차기 사진 선택과 실제 계산',()=>{
  it('사진의 골대 경계와 좌우 위치를 사용하고 높이는 분류 입력에 넣지 않는다',()=>{
    const b=GOAL_BOUNDS,p=pickInGoal(b.left+b.width*.25,b.top+b.height*.2)!;
    expect(p).toEqual({u:.25,v:.2});expect(directionCoordinate(p.u)).toBe(-.5);
    expect(penaltyRecord(p,{u:.75,v:.1})).toEqual({x:-.5,y:.5,label:1});
    expect(penaltyRecord({...p,v:.9},{u:.75,v:.8})).toEqual({x:-.5,y:.5,label:1});
    expect(pickInGoal(.01,.3)).toBeNull();expect(pickInGoal(.5,.4)).toBeNull();
    expect(pickInGoal(NaN,.5)).toBeNull();
  });
  it('역할 선택 순서와 무관하게 네 방향의 정답을 동일하게 만든다',()=>{
    for(const a of [.25,.75])for(const b of [.25,.75])expect(penaltyRecord({u:a,v:.5},{u:b,v:.5}).label).toBe(a!==b?1:0);
  });
  it('교수용 1뉴런은 네 점 중 하나를 놓치고 2뉴런은 모두 맞힌다',()=>{
    const correct=(h:number)=>PENALTY_CASES.filter(p=>Number(forward(penaltyTeachingModel(h),p.pixels[0]!,p.pixels[1]!).probability>=.5)===p.label).length;
    expect(correct(1)).toBe(3);expect(correct(2)).toBe(4);
    expect(forward(penaltyTeachingModel(),1,1)).toMatchObject({hidden:[2,0],logit:-1});
  });
  it('그래프의 2점수 표현은 실제 이진 출력과 수학적으로 같다',()=>{
    const model=penaltyTeachingModel();for(let x=-1;x<=1;x+=.2)for(let y=-1;y<=1;y+=.2){
      expect(forwardPixels(penaltyPixelModel(model),[x,y]).probabilities[1]).toBeCloseTo(forward(model,x,y).probability,12);
    }
  });
  it('대표선 움직임은 실제 학습이며 점을 옮기지 않고 골 예상이 커진다',()=>{
    const frames=penaltyLearningTrace(),before=forward(frames[0]!,-.5,.5),after=forward(frames.at(-1)!,-.5,.5);
    expect(before.logit).toBeCloseTo(-1);expect(after.probability).toBeGreaterThan(.5);
    expect(after.hidden[0]).toBeLessThan(before.hidden[0]!);
    expect(frames[0]!.parameters.inputHidden).not.toEqual(frames.at(-1)!.parameters.inputHidden);
    frames.slice(1).forEach((m,i)=>expect(forward(m,-.5,.5).probability).toBeGreaterThan(forward(frames[i]!,-.5,.5).probability));
  });
});
