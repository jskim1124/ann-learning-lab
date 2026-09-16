import { describe, expect, it } from "vitest";
import { descentTrace, exampleGradient, exampleLoss, exampleMinima } from "./optimizationExample";

describe("실제 학습 기록과 분리된 최적점 모형",()=>{
  it("양쪽 출발점에서 오차를 줄이지만 서로 다른 골짜기에 도착한다",()=>{
    const minima=exampleMinima();
    [-1.5,1.5].forEach((start,index)=>{
      const trace=descentTrace(start);
      trace.slice(1).forEach((x,i)=>expect(exampleLoss(x)).toBeLessThanOrEqual(exampleLoss(trace[i]!)+1e-12));
      expect(trace.at(-1)).toBeCloseTo(minima[index]!,8);
      expect(exampleGradient(minima[index]!)).toBeCloseTo(0,10);
    });
    expect(exampleLoss(minima[0]!)).toBeLessThan(exampleLoss(minima[1]!));
    for(let x=-3;x<=3;x+=.01)expect(exampleLoss(x)).toBeGreaterThanOrEqual(exampleLoss(minima[0]!)-1e-10);
  });
});
