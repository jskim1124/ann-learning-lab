import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageLabStore } from "../state/imageLabStore";
import { ImageFeatureLesson } from "./imageFeatureLesson";

vi.mock("../core/imageInput",async original=>({...await original<typeof import("../core/imageInput")>(),drawImagePixels:vi.fn()}));
vi.mock("../visualization/pixelLatentMap",async original=>({...await original<typeof import("../visualization/pixelLatentMap")>(),drawPixelLatentMap:vi.fn(),drawPixelNeuronMovement:vi.fn()}));

describe("네 단계 특징 탐구",()=>{
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
  it("계산·분포·뉴런·이동 퀴즈를 따라 연습으로 가며, 이전 장면도 다시 볼 수 있다",()=>{
    vi.useFakeTimers();
    document.body.innerHTML='<div id="lesson"></div>';
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect:vi.fn()} as unknown as CanvasRenderingContext2D);
    const root=document.getElementById("lesson")!,store=new ImageLabStore("digits"),next=vi.fn(),message=vi.fn();
    const lesson=new ImageFeatureLesson(root,store,next,message);lesson.render();
    const click=(id:string)=>(root.querySelector(`#${id}`) as HTMLButtonElement).click();
    const answer=(index:number)=>(root.querySelector(`[data-fl-choice="${index}"]`) as HTMLButtonElement).click();
    click("flNext");expect(next).not.toHaveBeenCalled();expect((root.querySelector("#flNext") as HTMLButtonElement).disabled).toBe(true);
    expect(root.querySelector('input[type="text"]')).toBeNull();
    click("flPlay");vi.advanceTimersByTime(7100);
    expect(root.querySelector("#flCalculation")!.textContent).toContain("4.5");
    answer(0);expect(root.querySelector('[data-fl-choice="0"]')!.classList.contains("wrong")).toBe(true);
    answer(1);expect(root.querySelector('[data-fl-choice="1"]')!.classList.contains("correct")).toBe(true);click("flNext");
    expect(root.querySelector("#flTitle")!.textContent).toContain("두 특징");
    click("flAction");answer(0);click("flNext");click("flAction");click("flAction");click("flAction");answer(1);click("flNext");
    (root.querySelector('[data-fl-predict="up"]') as HTMLButtonElement).click();click("flPlay");vi.advanceTimersByTime(8100);
    expect(root.querySelector("#flCalculation")!.textContent).toContain("0.1 × 8");
    expect((root.querySelector("#flPredict") as HTMLElement).hidden).toBe(true);
    answer(1);click("flNext");expect(next).toHaveBeenCalledOnce();
    (root.querySelector('[data-fl-step="1"]') as HTMLButtonElement).click();expect(root.querySelector("#flTitle")!.textContent).toContain("어떻게 더할");
    lesson.reset();lesson.render();expect((root.querySelector("#flNext") as HTMLButtonElement).disabled).toBe(true);
  });
  it("실제 그림과 작은 예제는 다른 영역이며 계산 과정이 순서대로 드러난다",()=>{
    document.body.innerHTML='<div id="lesson"></div>';
    const root=document.getElementById("lesson")!,store=new ImageLabStore("omr");
    const lesson=new ImageFeatureLesson(root,store,vi.fn(),vi.fn());lesson.render();
    expect(root.querySelector("#flSourceNote")!.textContent).toContain("실제 학습 자료와는 별개");
    (root.querySelector('[data-fl-source="data"]') as HTMLButtonElement).click();
    expect((root.querySelector("#flTiny") as HTMLElement).hidden).toBe(true);
    for(let i=0;i<3;i++)(root.querySelector("#flAction") as HTMLButtonElement).click();
    expect(root.querySelector("#flCalculation")!.textContent).toContain("자료 90장의 특징값 합");
    expect(root.querySelector("#flCalculation")!.textContent).toContain("평균에서 가장 먼 거리");
    lesson.stop();
  });
});
