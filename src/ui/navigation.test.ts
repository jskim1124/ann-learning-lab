import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

describe("자료에서 연습으로 이어지는 실제 화면 이동",()=>{
  beforeEach(async()=>{
    vi.resetModules();
    document.body.innerHTML=readFileSync("index.html","utf8");
    Object.defineProperty(document,"readyState",{get:()=>"complete",configurable:true});
    const ctx=new Proxy({measureText:()=>({width:60}),getImageData:()=>({data:new Uint8ClampedArray(196*4)})},{get:(target,key)=>key in target?target[key as keyof typeof target]:vi.fn(),set:(target,key,value)=>{Reflect.set(target,key,value);return true;}});
    vi.spyOn(HTMLCanvasElement.prototype,"getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype,"toDataURL").mockReturnValue("data:image/png;base64,test");
    vi.stubGlobal("requestAnimationFrame",vi.fn()); vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
    await import("../main");
  });
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
  const click=(selector:string)=>document.querySelector<HTMLButtonElement>(selector)!.click();
  it("승부차기에서도 오답만 표시하고 정답이나 해설을 공개하지 않는다",()=>{
    click('[data-preset="xor"]');click('#scenarioNext');click('#dataNext');
    const root=document.getElementById('penaltyUnderstanding')!;
    expect([...root.querySelectorAll('.journey-nav button')].map(b=>b.textContent)).toEqual(['1 특징 계산','2 분포·선택','3 뉴런·선','4 뉴런·출력']);
    click('#penaltyUnderstanding [data-journey-cell="0"]');click('#penaltyUnderstanding [data-journey-cell="1"]');click('#penaltyUnderstanding [data-journey-answer="0"]');
    expect(root.querySelectorAll('.is-wrong')).toHaveLength(1);expect(root.querySelector('.correct')).toBeNull();
    expect(root.querySelector('.journey-summary')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('[role=status]')!.textContent).toContain('오답');
  },20000);
  it("자율 숫자 문제는 이해 없이 연습으로 가고, 특징을 바꿔도 그 화면에 남는다",()=>{
    click('[data-preset="custom"]');click("#scenarioNext");click("#customLoadExample");click("#dataNext");
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.getElementById("stepThreeLabel")!.textContent).toBe("이해");
    expect(document.querySelector<HTMLButtonElement>('.lesson-progress [data-go-step="3"]')!.disabled).toBe(true);
    const x=document.getElementById("featurePracticeX") as HTMLSelectElement;x.value="2";x.dispatchEvent(new Event("change",{bubbles:true}));
    expect(document.getElementById("featureTrainAxisX")!.textContent).toBe("밝기");
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.getElementById("featureNetworkSvg")!.hasAttribute("hidden")).toBe(false);
    click('[data-app-page="4"] [data-back]');expect(document.querySelector<HTMLElement>('[data-app-page="2"]')!.hidden).toBe(false);
    click("#dataNext");expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.getElementById("customRowName")).toBeNull();
    click('.lesson-progress [data-go-step="1"]');click('[data-preset="omr"]');click('#scenarioNext');
    expect(document.querySelector<HTMLButtonElement>('.lesson-progress [data-go-step="4"]')!.disabled).toBe(true);
    click('.lesson-progress [data-go-step="4"]');
    expect(document.querySelector<HTMLElement>('[data-app-page="2"]')!.hidden).toBe(false);
  },20000);
});
