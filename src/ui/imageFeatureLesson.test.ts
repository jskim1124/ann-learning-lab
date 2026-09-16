import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageLabStore } from "../state/imageLabStore";
import { ImageFeatureLesson } from "./imageFeatureLesson";
import { featureScore } from "../core/imageFeatures";

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
    const answer=(text:string)=>{(root.querySelector("#flAnswer") as HTMLInputElement).value=text;root.querySelector("#flQuiz")!.dispatchEvent(new Event("submit",{cancelable:true}));};
    click("flNext");expect(next).not.toHaveBeenCalled();expect(message).toHaveBeenCalled();
    click("flAction");click("flAction");click("flAction");
    const state=store.snapshot;answer(featureScore(state.features.find(f=>f.id===state.xFeature)!,state.data[0]!.pixels).toFixed(2));click("flNext");
    expect(root.querySelector("#flTitle")!.textContent).toContain("두 특징");
    click("flAction");answer("아니요");click("flNext");click("flAction");answer("0");click("flNext");
    (root.querySelector('[data-fl-predict="up"]') as HTMLButtonElement).click();click("flAction");vi.advanceTimersByTime(3100);
    expect(root.querySelector("#flCalculation")!.textContent).toContain("예상대로");
    expect((root.querySelector("#flPredict") as HTMLElement).hidden).toBe(true);
    answer("예상과 정답이 다르기 때문");click("flNext");expect(next).toHaveBeenCalledOnce();
    (root.querySelector('[data-fl-step="1"]') as HTMLButtonElement).click();expect(root.querySelector("#flTitle")!.textContent).toContain("어떤 수");
    lesson.reset();expect((root.querySelector("#flAnswer") as HTMLInputElement).value).toBe("");
  });
});
