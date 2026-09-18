import { describe, expect, it, vi } from "vitest";
import { lineCrossing, targetValue, traceHits } from "./neuronTrace";
import { neuronCalculation, neuronLessonModel } from "./neuronLesson";
import { pixelMapInputAt } from "../visualization/pixelLatentMap";

describe("그리는 좌표와 선의 교차점",()=>{
  it.each([false,true])("선 사이를 빠르게 지나도 실제 교차점을 계산한다 (%s)",output=>{
    const hit=lineCrossing([-.8,-.2],[.9,.8],output)!;
    expect(targetValue(hit,output)).toBeCloseTo(0,12);
    const r=neuronCalculation(neuronLessonModel(),hit);
    expect(r.sum).toBeCloseTo(output?.5:0,12);
    if(output)expect(r.logits[0]).toBeCloseTo(r.logits[1]!,12);
  });
  it("선을 만나지 않거나 서로 다른 획 사이에는 교차점을 만들지 않는다",()=>{
    expect(lineCrossing([.2,.2],[.3,.2],true)).toBeNull();
    expect(traceHits([[[-.8,0]],[ [.8,0] ]],true)).toEqual([]);
    expect(traceHits([[[.5,0]]],true)).toEqual([[.5,0]]);
  });
  it.each([1,2])("DPR %s에서도 실제 그리드 원점과 끝점을 정확히 선택한다",ratio=>{
    vi.stubGlobal("devicePixelRatio",ratio);
    const canvas=document.createElement('canvas');canvas.width=720*ratio;canvas.height=460*ratio;
    vi.spyOn(canvas,"getBoundingClientRect").mockReturnValue({left:30,top:70,width:720,height:460} as DOMRect);
    expect(pixelMapInputAt(canvas,30+50+328,70+13+204)).toEqual([0,0]);
    expect(pixelMapInputAt(canvas,30+50,70+13)).toEqual([-1,1]);
    expect(pixelMapInputAt(canvas,30+706,70+421)).toEqual([1,-1]);
    expect(pixelMapInputAt(canvas,30+49,100)).toBeNull();
    vi.unstubAllGlobals();vi.restoreAllMocks();
  });
});
