import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageLabStore } from "../state/imageLabStore";
import { ImageFeatureLesson } from "./imageFeatureLesson";

vi.mock("../core/imageInput",async original=>({...await original<typeof import("../core/imageInput")>(),drawImagePixels:vi.fn()}));
vi.mock("../visualization/pixelLatentMap",async original=>({...await original<typeof import("../visualization/pixelLatentMap")>(),drawPixelLatentMap:vi.fn(),drawPixelNeuronMovement:vi.fn()}));
vi.mock("../visualization/lessonMovement",()=>({drawLessonMovement:vi.fn()}));
vi.mock("../visualization/neuronTrace",()=>({drawNeuronTrace:vi.fn()}));

function finishIntro(root:HTMLElement) {
  const click=(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
  for(let i=0;i<5;i++)click("#flAction");
  click('[data-neuron-answer="0"]');
  for(let i=0;i<4;i++)click("#flAction");
}

describe("네 단계 특징 탐구",()=>{
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
  it("계산·분포·이동·출력 퀴즈를 따라 연습으로 가며, 이전 장면도 다시 볼 수 있다",()=>{
    vi.useFakeTimers();
    document.body.innerHTML='<div id="lesson"></div>';
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue({fillRect:vi.fn()} as unknown as CanvasRenderingContext2D);
    const root=document.getElementById("lesson")!,store=new ImageLabStore("digits"),next=vi.fn(),message=vi.fn();
    const lesson=new ImageFeatureLesson(root,store,next,message);lesson.render();
    const click=(id:string)=>(root.querySelector(`#${id}`) as HTMLButtonElement).click();
    const answer=(index:number)=>(root.querySelector(`[data-fl-choice="${index}"]`) as HTMLButtonElement).click();
    click("flNext");expect(next).not.toHaveBeenCalled();expect((root.querySelector("#flNext") as HTMLButtonElement).disabled).toBe(true);
    expect(root.querySelector('input[type="text"]')).toBeNull();
    click("flPlay");vi.advanceTimersByTime(9000);
    expect(root.querySelector("#flCalculation")!.textContent).toContain("4.5");
    answer(0);expect(root.querySelector('[data-fl-choice="0"]')!.classList.contains("wrong")).toBe(true);
    expect(root.querySelector('#flChoices .correct')).toBeNull();
    expect(root.querySelector('#flFeedback')!.textContent).not.toContain("4.5");
    answer(1);expect(root.querySelector('[data-fl-choice="1"]')!.classList.contains("correct")).toBe(true);click("flNext");
    expect(root.querySelector("#flTitle")!.textContent).toContain("두 특징");
    click("flAction");answer(0);click("flNext");
    finishIntro(root);click("flPlay");vi.advanceTimersByTime(10000);
    expect(root.querySelector("#flCalculation")!.textContent).toContain("지금 예상 B");
    expect((root.querySelector("#flText") as HTMLElement).hidden).toBe(true);
    expect((root.querySelector("#flPredict") as HTMLElement).hidden).toBe(false);
    click("flBiasCheck");click("flNext");
    for(let i=0;i<4;i++)click("flAction");
    expect(root.querySelector("#flCalculation")!.textContent).toContain("은닉 1개 → 출력 3개");
    (root.querySelector('[data-output-neurons="2"]') as HTMLButtonElement).click();
    expect(root.querySelector("#flCalculation")!.textContent).toContain("은닉 2개 → 출력 3개");
    answer(0);click("flNext");expect(next).toHaveBeenCalledOnce();
    (root.querySelector('[data-fl-step="1"]') as HTMLButtonElement).click();expect(root.querySelector("#flTitle")!.textContent).toContain("어떻게 더할");
    lesson.reset();lesson.render();expect((root.querySelector("#flNext") as HTMLButtonElement).disabled).toBe(true);
  },15000);
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
  it("재생은 중간 값을 그리며 정지와 장면 이동 시 애니메이션을 중단한다",()=>{
    vi.useFakeTimers();document.body.innerHTML='<div id="lesson"></div>';
    const root=document.getElementById("lesson")!,lesson=new ImageFeatureLesson(root,new ImageLabStore("digits"),vi.fn(),vi.fn());lesson.render();
    const click=(selector:string)=>(root.querySelector(selector) as HTMLButtonElement).click();
    click('[data-fl-step="3"]');finishIntro(root);click('#flPlay');vi.advanceTimersByTime(400);
    const middle=root.querySelector('#flCalculation')!.textContent;
    expect(middle).toContain('0.05'); // Interpolated, not merely initial/final snapshots.
    click('#flPlay');vi.advanceTimersByTime(2000);expect(root.querySelector('#flCalculation')!.textContent).toBe(middle);
    click('#flPlay');vi.advanceTimersByTime(200);click('[data-fl-step="4"]');
    const next=root.querySelector('#flCalculation')!.textContent;vi.advanceTimersByTime(2000);
    expect(root.querySelector('#flCalculation')!.textContent).toBe(next);lesson.stop();
  });
  it("곱셈과 덧셈을 한 항씩 재생하고 직접 계산 문제에서 기다린다",()=>{
    vi.useFakeTimers();document.body.innerHTML='<div id="lesson"></div>';
    const root=document.getElementById("lesson")!,lesson=new ImageFeatureLesson(root,new ImageLabStore("digits"),vi.fn(),vi.fn());lesson.render();
    const click=(selector:string)=>(root.querySelector(selector) as HTMLButtonElement).click();
    click('[data-fl-step="3"]');
    expect(root.querySelector('#flTitle')!.textContent).toContain("작은 계산기");
    expect((root.querySelector('#flPredict') as HTMLElement).hidden).toBe(true);
    click('#flAction');
    expect(root.querySelector('#flCalculation')!.textContent).toContain("합 = □ + □ + □ = ?");
    click('#flAction');
    expect(root.querySelector('#flCalculation')!.textContent).toContain("합 = 0.2 + □ + □ = ?");
    expect(root.querySelector('#flArithmeticFlow animateMotion')!.getAttribute('path')).toBe('M 290 49 L 459 123');
    expect(root.querySelector('#flArithmeticFlow .flow-packet')!.textContent).toBe('0.2');
    click('#flPlay');vi.advanceTimersByTime(15000);
    expect(root.querySelector('#flCalculation')!.textContent).toContain("합 = 0.2 + 0.1 + 0 = 0.3");
    expect(root.querySelector('#flPlay')!.textContent).toContain("재생");
    expect(root.querySelector<HTMLButtonElement>('#flAction')!.disabled).toBe(true);
    click('[data-neuron-answer="1"]');
    expect(root.querySelector('.arithmetic-check .correct')).toBeNull();
    expect(root.querySelector('.arithmetic-check [role="status"]')!.textContent).not.toContain("0.5");
    click('[data-neuron-answer="0"]');click('#flAction');
    expect(root.querySelector('#flTitle')!.textContent).toContain("보라선");
    expect(root.querySelector('[data-neuron-probe]')).toBeNull();
    click('#flPrevious');expect(root.querySelector('#flTitle')!.textContent).toContain("곱한 두 값");
    lesson.stop();
  });
  it("직접 그린 위치와 연결지도 값이 같고 슬라이더는 마지막 더하는 값만 바꾼다",()=>{
    document.body.innerHTML='<div id="lesson"></div>';
    const root=document.getElementById("lesson")!,store=new ImageLabStore("omr"),lesson=new ImageFeatureLesson(root,store,vi.fn(),vi.fn());lesson.render();
    const click=(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
    click('[data-fl-step="3"]');finishIntro(root);
    click('#flPrevious'); // Black boundary exploration.
    const map=root.querySelector<HTMLCanvasElement>('#flMap')!;
    vi.spyOn(map,"getBoundingClientRect").mockReturnValue({left:10,top:20,width:720,height:460} as DOMRect);
    const revision=store.snapshot.revision;
    const point=(type:string,x:number)=>map.dispatchEvent(new MouseEvent(type,{clientX:10+50+(x+1)*328,clientY:20+13+.5*408,bubbles:true}));
    point('pointerdown',-.5);point('pointermove',.8);point('pointerup',.8);
    expect(root.querySelector('.neuron-inputs')!.textContent).toContain("가로 0.8");
    expect(root.querySelector('.neuron-outputs')!.textContent).toContain("B 0.8");
    expect(root.querySelector('.trace-result')!.textContent).toContain("(0.5, 0) · A = B = 0.5");
    expect(store.snapshot.revision).toBe(revision);
    click('#flAction');
    const slider=root.querySelector<HTMLInputElement>('#flBias')!;
    const slide=(value:string)=>{slider.value=value;slider.dispatchEvent(new Event('input',{bubbles:true}));};
    slide('-.5');click('#flBiasCheck');
    expect(root.querySelector('#flCalculation')!.textContent).toContain("합이 음수라 0");
    expect(root.querySelector('#flBiasFeedback')!.className).toBe('wrong');
    expect(root.querySelector('#flChoices .correct')).toBeNull();
    slide('.1');
    expect(root.querySelector('.bias-equation')!.textContent).toContain("0.2 + 0.1 + (0.1) = 0.4");
    expect(root.querySelector('.movement-scores')!.textContent).toContain("처음 0.3 → 0.4");
    expect(root.querySelector('.neuron-inputs')!.textContent).toContain("가로 0.2");
    expect(root.querySelector('.neuron-links')!.textContent).toContain("× 0.5");
    click('#flBiasCheck');expect(root.querySelector('#flBiasFeedback')!.className).toBe('correct');
    expect(root.querySelector<HTMLButtonElement>('#flBias')!).toBe(slider); // Native drag target survives rendering.
    lesson.stop();
  });
});
