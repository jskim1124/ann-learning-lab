import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderstandingJourney } from './understandingJourney';
import { penaltyExplorationSource, imageExplorationSource } from '../core/explorationSource';
import { ImageLabStore } from '../state/imageLabStore';
import { drawPixelLatentMap } from '../visualization/pixelLatentMap';
import { forwardPixels } from '../core/pixelNetwork';

vi.mock('../visualization/pixelLatentMap',()=>({drawPixelLatentMap:vi.fn(),pixelMapExampleAt:vi.fn(()=>1)}));
const source=()=>penaltyExplorationSource([{x:-.5,y:-.5,label:0},{x:-.5,y:.5,label:1},{x:.5,y:-.5,label:1},{x:.5,y:.5,label:0}],['막힘','골']);
describe('실제 자료로 탐구하는 이해 단계',()=>{
  let root:HTMLElement,journey:UnderstandingJourney;const complete=vi.fn();
  const click=(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
  const input=(s:string,v:string)=>{const el=root.querySelector<HTMLInputElement>(s)!;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
  const last=()=>vi.mocked(drawPixelLatentMap).mock.calls.at(-1)!;
  beforeEach(()=>{vi.useFakeTimers();document.body.innerHTML='<div id="root"></div>';root=document.getElementById('root')!;journey=new UnderstandingJourney(root,{source,context:()=>'',complete});});
  afterEach(()=>{journey.stop();vi.useRealTimers();vi.clearAllMocks();});
  it('모든 장면을 다시 오갈 수 있고 정해진 답을 요구하지 않는다',()=>{
    expect([...root.querySelectorAll('[data-explore-chapter]')].map(b=>b.textContent)).toEqual(['1 자료를 숫자로','2 분포 살피기','3 뉴런 고치기','4 답 합치기']);
    click('[data-explore-chapter="3"]');expect(root.dataset.chapter).toBe('3');click('[data-explore-chapter="0"]');expect(root.dataset.chapter).toBe('0');
    expect(root.querySelector('[data-journey-answer]')).toBeNull();click('[data-explore-chapter="3"]');click('[data-explore-next]');expect(complete).toHaveBeenCalled();
  });
  it('승부차기는 진하기가 아니라 방향을 데이터화하고 임시 사례만 바꾼다',()=>{
    const before=JSON.stringify(source().data);expect(root.textContent).toContain('두 방향을 숫자로');expect(root.querySelector('[data-journey-ink]')).toBeNull();
    input('[data-knob="kick"]','.5');expect(root.querySelector('.explore-point')!.textContent).toContain('(0.50, -0.50)');expect(root.querySelector('.explore-point')!.textContent).toContain('정답 골');
    expect(JSON.stringify(last()[2])).toBe(before);input('[data-knob="kick"]','0');expect(root.querySelector('.explore-point')!.textContent).toContain('가운데 방향은 판정하지 않아요');
  });
  it('분포는 실제 자료이며 한 축으로 접어 비교해도 원자료는 보존된다',()=>{
    journey.goTo(1);expect(last()[2]).toEqual(source().data);click('[data-dimension="1"]');expect(last()[2].every(r=>r.pixels[1]===0)).toBe(true);
    click('[data-dimension="2"]');expect(last()[2]).toEqual(source().data);click('[data-filter="1"]');expect(last()[5]?.emphasizeClass).toBe(1);
  });
  it('슬라이더는 실제 가중치를 고치고 식·뉴런 값·지도 모델이 일치한다',()=>{
    journey.goTo(2);const slider=root.querySelector('[data-knob="bias"]');input('[data-knob="xWeight"]','-1');input('[data-knob="yWeight"]','1');input('[data-knob="bias"]','1');
    expect(root.querySelector('[data-knob="bias"]')).toBe(slider);
    const m=last()[1];expect(m.inputHidden[0]).toEqual([-1,1]);expect(m.hiddenBias[0]).toBe(1);
    expect(root.querySelector('[data-calculation]')!.textContent).toContain('더하면 1.00');expect(forwardPixels(m,[-.5,-.5]).hidden[0]).toBe(1);
    expect(root.querySelector('.explore-network')!.textContent).toContain('1.00');
  });
  it('뉴런을 추가한 것만으로 답이 달라지지 않고 출력 수는 클래스 수다',()=>{
    journey.goTo(3);const before=last()[1];click('[data-add-neuron]');const after=last()[1];
    expect(after.hiddenUnits).toBe(2);for(const r of source().data)expect(forwardPixels(after,r.pixels).logits).toEqual(forwardPixels(before,r.pixels).logits);
    expect(root.querySelectorAll('.explore-output-nodes > div > span')).toHaveLength(2);
    input('[data-knob="connection"]','1');expect(last()[1].hiddenOutput[1]![1]).toBe(1);
  });
  it('재생은 중간 계산과 선을 함께 바꾸고 화면 이동 시 타이머를 취소한다',()=>{
    journey.goTo(2);click('[data-anchor]');input('[data-knob="bias"]','1');click('[data-replay]');vi.advanceTimersByTime(720);
    expect(last()[1].hiddenBias[0]).toBeGreaterThan(0);expect(last()[1].hiddenBias[0]).toBeLessThan(1);
    journey.goTo(3);expect(vi.getTimerCount()).toBe(0);expect(last()[1].hiddenBias[0]).toBe(1);
    click('[data-train]');vi.advanceTimersByTime(1600);expect(last()[1].epoch).toBe(1);
  });
  it('숫자 그림의 특징 변경이 실제 연습 저장소와 동일한 좌표로 이어진다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('omr');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});
    expect(root.querySelector('.explore-picture rect')).not.toBeNull();journey.goTo(1);
    const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value='lr';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(store.snapshot.xFeature).toBe('lr');expect(last()[2]).toEqual(imageExplorationSource(store.snapshot).data);expect(last()[5]!.axisLegend!.horizontal.title).toBe('오른쪽 − 왼쪽 (평균 0)');
  });
  it('잘못된 특징 조합을 선택해도 이전의 유효한 좌표로 돌아온다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('digits');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});journey.goTo(1);
    const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value='center';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(store.snapshot.xFeature).toBe('ink');expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.value).toBe('ink');
  });
});
