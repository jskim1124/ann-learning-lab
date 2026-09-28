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
  it("직접 고치기는 이해에 통합되고 상단 단계로 돌아와도 고친 값이 유지된다",()=>{
    click('[data-preset="xor"]');click('#scenarioNext');click('#dataNext');
    const root=document.getElementById('penaltyUnderstanding')!;
    expect(root.textContent).toContain('두 방향을 숫자로 기록');
    expect(root.querySelector('[data-journey-ink]')).toBeNull();
    click('#penaltyUnderstanding [data-explore-chapter="2"]');
    click('#penaltyUnderstanding [data-guess="1"]');
    const bias=root.querySelector<HTMLInputElement>('[data-knob="bias"]')!;bias.value='.5';bias.dispatchEvent(new Event('input',{bubbles:true}));
    click('#penaltyUnderstanding [data-explore-chapter="3"]');click('#penaltyUnderstanding [data-explore-next]');
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.querySelector('.manual-launch')).toBeNull();
    click('.lesson-progress [data-go-step="3"]');click('#penaltyUnderstanding [data-explore-chapter="1"]');expect(root.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>('[data-knob="bias"]')!.value).toBe('0.50');
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
