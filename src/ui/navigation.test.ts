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
    for(let i=0;i<3;i++)click('#plAdvance');
    const question=document.getElementById('plQuestion')!.textContent;
    expect(question).toBeTruthy();
    const choices=[...document.querySelectorAll<HTMLButtonElement>('#plChoices button')];
    const wrong=choices.find(b=>b.textContent==='−0.5')!;
    wrong.click();
    expect(document.querySelectorAll('#plChoices .wrong')).toHaveLength(1);
    expect(document.querySelector('#plChoices .correct')).toBeNull();
    expect(document.getElementById('plFeedback')!.textContent).toBe('오답입니다. 위 계산을 다시 확인해 보세요.');
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
  },20000);
});
