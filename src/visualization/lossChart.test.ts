import { describe, expect, it, vi } from "vitest";
import { chartRange } from "./lossChart";
import { chartControls } from "../ui/learningChart";

describe("오차·정답률 그래프",()=>{
  const history=[{epoch:0,loss:.1,accuracy:.95},{epoch:10,loss:.09,accuracy:.96}];
  it("정답률의 원래 범위와 확대 범위를 구분한다",()=>{
    expect(chartRange(history,"accuracy",false)).toEqual([0,1]);
    const zoom=chartRange(history,"accuracy",true);
    expect(zoom[0]).toBeGreaterThan(.9);expect(zoom[0]).toBeLessThan(.95);expect(zoom[1]).toBeGreaterThan(.96);
    expect(chartRange(history,"loss",false)[0]).toBe(0);
    expect(chartRange(history,"loss",true)[0]).toBeGreaterThan(0);
    expect(chartRange([{epoch:0,loss:0,accuracy:1}],"accuracy",true)[0]).toBeLessThan(1);
  });
  it("그래프를 다시 그려도 선택한 지표와 확대 상태를 유지한다",()=>{
    document.body.innerHTML='<div><div>이전 설명</div><canvas></canvas></div>';
    const canvas=document.querySelector("canvas")!,draw=vi.fn();
    const state=chartControls(canvas,history,draw);
    (document.querySelector('[data-metric="accuracy"]') as HTMLButtonElement).click();
    (document.querySelector('[data-chart-zoom]') as HTMLInputElement).click();
    expect(state.metric).toBe("accuracy");expect(state.zoom).toBe(true);expect(draw).toHaveBeenCalledTimes(2);
    expect(chartControls(canvas,history,draw)).toBe(state);
    expect(document.querySelectorAll(".learning-chart-controls")).toHaveLength(1);
  });
});
