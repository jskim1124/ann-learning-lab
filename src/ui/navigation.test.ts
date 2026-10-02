import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {exploreAllParameters} from "./journeyTestActions";

// Full learner journeys include six parameter changes and two axis confirmations.
// Allow slower Windows/jsdom DOM layout without weakening the interaction assertions.
// Navigation tests exercise the real stores and controls, not raster rendering.
vi.mock('../visualization/pixelLatentMap',async original=>({...await original<typeof import('../visualization/pixelLatentMap')>(),drawPixelLatentMap:vi.fn()}));
vi.mock('../visualization/featureSurface',async original=>({...await original<typeof import('../visualization/featureSurface')>(),drawFeatureSurface:vi.fn()}));
vi.mock('../visualization/decisionSurface',async original=>({...await original<typeof import('../visualization/decisionSurface')>(),drawDecisionSurface:vi.fn()}));

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
  },30000);
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
  const click=(selector:string)=>document.querySelector<HTMLButtonElement>(selector)!.click();
  it('티처블 머신도 같은 문제 카드에서 시작하고 공통 상단 메뉴로 이동한다',()=>{
    expect(document.querySelectorAll('.scenario-card')).toHaveLength(6);
    expect(document.querySelector('.comparison-entry')).toBeNull();
    click('[data-teachable]');expect(document.querySelector('#scenarioName')!.textContent).toBe('티처블 머신');click('#scenarioNext');
    const root=document.querySelector<HTMLElement>('.comparison-workspace')!;
    expect(root.hidden).toBe(false);expect(document.querySelector<HTMLElement>('[data-app-page="1"]')!.hidden).toBe(true);
    expect(document.querySelector('.topbar [data-research-survey]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('.lesson-progress [data-go-step="3"]')!.disabled).toBe(true);
    click('.lesson-progress [data-go-step="4"]');expect(root.dataset.pane).toBe('1');
    click('.lesson-progress [data-go-step="5"]');expect(root.dataset.pane).toBe('2');
    click('.lesson-progress [data-go-step="1"]');expect(root.hidden).toBe(true);
    click('[data-preset="digits"]');click('#scenarioNext');expect(document.querySelector<HTMLElement>('[data-app-page="2"]')!.hidden).toBe(false);
  },60000);
  it("직접 고치기는 이해에 통합되고 상단 단계로 돌아와도 고친 값이 유지된다",()=>{
    click('[data-preset="xor"]');click('#scenarioNext');click('#dataNext');
    const root=document.getElementById('penaltyUnderstanding')!;
    expect(root.textContent).toContain('두 방향을 숫자로 기록');
    expect(root.querySelector('[data-journey-ink]')).toBeNull();
    exploreAllParameters(root);click('#penaltyUnderstanding [data-explore-chapter="2"]');click('#penaltyUnderstanding [data-parameter-choice="bias"]');
    const bias=root.querySelector<HTMLInputElement>('[data-knob="bias"]')!;bias.value='.5';bias.dispatchEvent(new Event('input',{bubbles:true}));
    click('#penaltyUnderstanding [data-explore-chapter="3"]');click('#penaltyUnderstanding [data-explore-next]');
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.querySelector('.manual-launch')).toBeNull();
    expect(document.querySelector('.training-motion')).toBeNull();
    click('.lesson-progress [data-go-step="3"]');click('#penaltyUnderstanding [data-explore-chapter="1"]');click('#penaltyUnderstanding [data-parameter-choice="bias"]');expect(root.hidden).toBe(false);
    expect(root.querySelector<HTMLInputElement>('[data-knob="bias"]')!.value).toBe('0.50');
  },60000);
  it("자율 숫자는 이해를 거쳐 연습하며 두 단계에서 고른 특징을 공유한다",()=>{
    click('[data-preset="custom"]');click("#scenarioNext");click("#customLoadExample");click("#dataNext");
    expect(document.querySelector<HTMLElement>('[data-app-page="3"]')!.hidden).toBe(false);
    expect(document.getElementById("stepThreeLabel")!.textContent).toBe("이해");
    expect(document.querySelector<HTMLButtonElement>('.lesson-progress [data-go-step="3"]')!.disabled).toBe(false);
    const root=document.getElementById('customFeatureView')!;
    expect(root.querySelectorAll('[data-explore-chapter]')).toHaveLength(4);
    expect(root.querySelector('.explore-goal')).toBeNull();
    const first=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;expect(first.value).toBe('');first.value='0';first.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector<HTMLButtonElement>('[data-projection-skip]')!.click();expect(root.querySelector('[data-feature-trace="0"]')!.textContent).toContain('가로 · 길이');expect(root.querySelector('[data-feature-trace="0"]')!.textContent).toContain('이 자료의 값 2.00');
    const feature=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;feature.value='2';feature.dispatchEvent(new Event('change',{bubbles:true}));
    exploreAllParameters(root);click('#customFeatureView [data-explore-chapter="3"]');click('#customFeatureView [data-explore-next]');
    expect(document.getElementById("featureTrainAxisX")!.textContent).toBe("밝기");
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.getElementById("featureNetworkSvg")!.hasAttribute("hidden")).toBe(false);
    const x=document.getElementById("featurePracticeX") as HTMLSelectElement;x.value="0";x.dispatchEvent(new Event("change",{bubbles:true}));
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    click('#featureTrainOne');expect(document.getElementById('featureEpoch')!.textContent).toBe('10');
    expect(document.querySelector('.training-motion')).toBeNull();
    click('[data-app-page="4"] [data-back]');expect(document.querySelector<HTMLElement>('[data-app-page="3"]')!.hidden).toBe(false);
    click('#customFeatureView [data-explore-chapter="0"]');expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.value).toBe('0');
    click('.lesson-progress [data-go-step="4"]');expect(document.getElementById('featureEpoch')!.textContent).toBe('10');
    expect(document.getElementById("customRowName")).toBeNull();
    click('.lesson-progress [data-go-step="1"]');click('[data-preset="omr"]');click('#scenarioNext');
    expect(document.querySelector<HTMLButtonElement>('.lesson-progress [data-go-step="4"]')!.disabled).toBe(true);
    click('.lesson-progress [data-go-step="4"]');
    expect(document.querySelector<HTMLElement>('[data-app-page="2"]')!.hidden).toBe(false);
  },60000);
  it('자율 텍스트는 실제 문장과 특징을 비교한 뒤 같은 뉴런 탐구로 이어진다',()=>{
    click('[data-preset="custom"]');click('#scenarioNext');click('[data-custom-input="text"]');
    for(const [label,text] of [[0,'안녕 친구'],[0,'우리 반 2'],[1,'123 456 789'],[1,'1234 5678']] as const){
      (document.getElementById('customTextClass') as HTMLSelectElement).value=String(label);
      (document.getElementById('customTextValue') as HTMLTextAreaElement).value=text;click('#customTextAdd');
    }
    click('#dataNext');const root=document.getElementById('customFeatureView')!;
    expect(root.hidden).toBe(false);const first=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;first.value='0';first.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector<HTMLButtonElement>('[data-projection-skip]')!.click();expect(root.querySelector('.explore-record')!.textContent).toBe('1234 5678');
    expect(root.textContent).toContain('문장의 뜻을 이해하지는');expect(root.querySelector('[data-feature-trace="0"]')!.textContent).toContain('글자 수');expect(root.querySelector('[data-feature-trace="0"]')!.textContent).toContain('이 자료의 값 8.00');
    exploreAllParameters(root);click('#customFeatureView [data-explore-chapter="1"]');click('#customFeatureView [data-parameter-choice="bias"]');expect(root.querySelector('.parameter-active')).not.toBeNull();
    click('#customFeatureView [data-explore-chapter="3"]');click('#customFeatureView [data-explore-next]');
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    expect(document.querySelector('.training-motion')).toBeNull();
  },60000);
  it.each(['drawing','webcam'])('자율 %s도 공통 이해로 이동하고 연습에서 되돌아올 수 있다',async kind=>{
    // Coverage itself is tested in ImageLabStore. Isolate routing without a camera permission request.
    const { ImageLabStore }=await import('../state/imageLabStore');
    vi.spyOn(ImageLabStore.prototype,'coverageError').mockReturnValue(null);
    click('[data-preset="custom"]');click('#scenarioNext');click(`[data-custom-input="${kind}"]`);click('#dataNext');
    expect(document.querySelector<HTMLElement>('[data-app-page="3"]')!.hidden).toBe(false);
    const root=document.querySelector<HTMLElement>('.understanding-journey:not([hidden])')!;
    expect(root.id).not.toBe('customFeatureView');expect(root.querySelectorAll('[data-explore-chapter]')).toHaveLength(4);
    exploreAllParameters(root);root.querySelector<HTMLButtonElement>('[data-explore-chapter="3"]')!.click();root.querySelector<HTMLButtonElement>('[data-explore-next]')!.click();
    expect(document.querySelector<HTMLElement>('[data-app-page="4"]')!.hidden).toBe(false);
    click('.lesson-progress [data-go-step="3"]');expect(root.hidden).toBe(false);
  },60000);
});
