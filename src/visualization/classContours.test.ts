import { describe, expect, it } from "vitest";
import { classContours, type ScorePoint } from "./classContours";

const corners = (scores: (x:number,y:number)=>number[]): [ScorePoint,ScorePoint,ScorePoint,ScorePoint] => [[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>({x:x!,y:y!,scores:scores(x!,y!)})) as [ScorePoint,ScorePoint,ScorePoint,ScorePoint];
describe("실제 1등 클래스가 바뀌는 경계",()=>{
  it("격자 모서리를 잇는 계단 대신 점수차의 0을 잇는다",()=>{
    const segments=classContours(corners((x,y)=>[x+y,.7]));
    expect(segments.length).toBe(2);
    segments.flat().forEach(p=>expect(p.x+p.y).toBeCloseTo(.7,12));
  });
  it("2등끼리 점수가 같아도 1등이 따로 있으면 경계를 그리지 않는다",()=>{
    expect(classContours(corners((x,y)=>[x,y,2]))).toEqual([]);
  });
  it("세 클래스가 만날 때 다른 클래스가 이기는 쪽으로 경계가 뻗지 않는다",()=>{
    const segments=classContours(corners((x,y)=>[x,y,.4]));
    expect(segments.length).toBeGreaterThan(0);
    for(const [a,b] of segments){const x=(a.x+b.x)/2,y=(a.y+b.y)/2;const scores=[x,y,.4].sort((a,b)=>b-a);expect(scores[0]).toBeCloseTo(scores[1]!,12);}
  });
});
