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
  const parameter=(value:string)=>{const select=root.querySelector<HTMLSelectElement>('[data-parameter]')!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
  const last=()=>vi.mocked(drawPixelLatentMap).mock.calls.at(-1)!;
  beforeEach(()=>{vi.useFakeTimers();document.body.innerHTML='<div id="root"></div>';root=document.getElementById('root')!;journey=new UnderstandingJourney(root,{source,context:()=>'',complete});});
  afterEach(()=>{journey.stop();vi.useRealTimers();vi.clearAllMocks();});
  it('모든 장면을 다시 오갈 수 있고 정해진 답을 요구하지 않는다',()=>{
    expect([...root.querySelectorAll('[data-explore-chapter]')].map(b=>b.textContent)).toEqual(['1 자료 비교','2 뉴런 직접 조절','3 오차 줄이기','4 뉴런 늘리기']);
    click('[data-explore-chapter="3"]');expect(root.dataset.chapter).toBe('3');click('[data-explore-chapter="0"]');expect(root.dataset.chapter).toBe('0');
    expect(root.querySelector('[data-journey-answer]')).toBeNull();click('[data-explore-chapter="3"]');click('[data-explore-next]');expect(complete).toHaveBeenCalled();
  });
  it('승부차기는 진하기가 아니라 방향을 데이터화하고 임시 사례만 바꾼다',()=>{
    const before=JSON.stringify(source().data);expect(root.textContent).toContain('두 방향을 숫자로');expect(root.querySelector('[data-journey-ink]')).toBeNull();
    input('[data-knob="kick"]','.5');expect(root.querySelector('.explore-point')!.textContent).toContain('(0.50, -0.50)');expect(root.querySelector('.explore-point')!.textContent).toContain('정답 골');
    expect(JSON.stringify(last()[2])).toBe(before);input('[data-knob="kick"]','0');expect(root.querySelector('.explore-point')!.textContent).toContain('가운데 방향은 판정하지 않아요');
  });
  it('분포는 실제 자료이며 한 축으로 접어 비교해도 원자료는 보존된다',()=>{
    journey.goTo(0);expect(last()[2]).toEqual(source().data);click('[data-dimension="1"]');expect(last()[2].every(r=>r.pixels[1]===0)).toBe(true);
    click('[data-dimension="2"]');expect(last()[2]).toEqual(source().data);
  });
  it('슬라이더는 실제 가중치를 고치고 식·뉴런 값·지도 모델이 일치한다',()=>{
    journey.goTo(1);parameter('xWeight');input('[data-knob="xWeight"]','-1');parameter('yWeight');input('[data-knob="yWeight"]','1');parameter('bias');const slider=root.querySelector('[data-knob="bias"]');input('[data-knob="bias"]','1');
    expect(root.querySelector('[data-knob="bias"]')).toBe(slider);
    expect(root.querySelectorAll('[data-knob]')).toHaveLength(1);
    const m=last()[1];expect(m.inputHidden[0]).toEqual([-1,1]);expect(m.hiddenBias[0]).toBe(1);
    expect(root.querySelector('.phase-sum')!.textContent).toContain('= 1.00');expect(forwardPixels(m,[-.5,-.5]).hidden[0]).toBe(1);
    expect(root.querySelector('.explore-network')!.textContent).toContain('1.00');
  });
  it('곱할 수와 더할 수를 선택하면 그 숫자 하나만 강조되고 실시간 값이 일치한다',()=>{
    journey.goTo(1);
    for(const id of ['xWeight','yWeight','bias']){
      parameter(id);const slider=root.querySelector<HTMLInputElement>(`[data-knob="${id}"]`)!;slider.focus();input(`[data-knob="${id}"]`,'1.23');
      const highlighted=root.querySelectorAll('.parameter-active');expect(highlighted).toHaveLength(1);
      expect(highlighted[0]!.getAttribute('data-network-parameter')).toBe(id);expect(highlighted[0]!.textContent).toBe('1.23');
      expect(root.querySelectorAll('.parameter-marker:not([visibility="hidden"])')).toHaveLength(1);
      expect(document.activeElement).toBe(slider);
    }
    journey.goTo(2);click('[data-guess="-1"]');input('[data-knob="bias"]','-.25');expect(root.querySelector('.parameter-active')!.textContent).toBe('-0.25');
  });
  it('출력 연결에서 고른 뉴런과 클래스에 해당하는 곱할 수만 강조한다',()=>{
    journey.goTo(3);click('[data-add-neuron]');input('[data-knob="connection"]','.73');
    let highlighted=root.querySelector('.parameter-active')!;expect(highlighted.getAttribute('data-network-parameter')).toBe('connection-1');expect(highlighted.textContent).toBe('0.73');
    click('[data-neuron="0"]');input('[data-knob="connection"]','-.41');highlighted=root.querySelector('.parameter-active')!;
    expect(highlighted.getAttribute('data-network-parameter')).toBe('connection-0');expect(highlighted.textContent).toBe('-0.41');
    const select=root.querySelector<HTMLSelectElement>('[data-output]')!;select.value='1';select.dispatchEvent(new Event('change',{bubbles:true}));input('[data-knob="connection"]','.92');
    expect(root.querySelectorAll('.parameter-active')).toHaveLength(1);expect(root.querySelector('.parameter-active')!.textContent).toBe('0.92');expect(last()[1].hiddenOutput[1]![0]).toBe(.92);
  });
  it('뉴런을 추가한 것만으로 답이 달라지지 않고 출력 수는 클래스 수다',()=>{
    journey.goTo(3);const before=last()[1];click('[data-add-neuron]');const after=last()[1];
    expect(after.hiddenUnits).toBe(2);for(const r of source().data)expect(forwardPixels(after,r.pixels).logits).toEqual(forwardPixels(before,r.pixels).logits);
    expect(root.querySelectorAll('.explore-output-nodes > div > span')).toHaveLength(2);
    click('[data-train]');expect(last()[1].hiddenOutput[1]![1]).not.toBe(0);
  });
  it('변화 재생 없이 계산 경로를 강조하고 이동하면 타이머를 취소한다',()=>{
    journey.goTo(1);expect(root.querySelector('[data-replay]')).toBeNull();input('[data-knob="bias"]','1');click('[data-play-math]');vi.advanceTimersByTime(700);
    expect(root.dataset.animationPhase).toBe('1');expect(last()[1].hiddenBias[0]).toBe(1);
    journey.goTo(3);expect(vi.getTimerCount()).toBe(0);click('[data-train]');expect(last()[1].epoch).toBe(1);
  });
  it('숫자 그림의 특징 변경이 실제 연습 저장소와 동일한 좌표로 이어진다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('omr');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});
    expect(root.querySelector('.explore-picture rect')).not.toBeNull();journey.goTo(0);
    const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value='lr';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(store.snapshot.xFeature).toBe('lr');expect(last()[2]).toEqual(imageExplorationSource(store.snapshot).data);expect(last()[5]!.axisLegend!.horizontal.title).toBe('오른쪽 − 왼쪽 (평균 0)');
  });
  it('잘못된 특징 조합을 선택해도 이전의 유효한 좌표로 돌아온다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('digits');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});journey.goTo(0);
    const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value='center';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(store.snapshot.xFeature).toBe('ink');expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.value).toBe('ink');
  });
  it('점의 정답·예상은 클릭한 점 팝업에서만 보이며 닫을 수 있다',()=>{
    journey.goTo(2);expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(true);
    root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:30,clientY:40}));
    expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(false);expect(root.querySelector('.explore-point')!.textContent).toContain('정답 골');
    click('[data-close-point]');expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(true);
  });
  it('학습 방향은 선택한 수 하나만 실제 계산값으로 갱신한다',()=>{
    journey.goTo(1);input('[data-knob="bias"]','.2');journey.goTo(2);const before=last()[1];click('[data-guess="1"]');input('[data-knob="bias"]','.4');click('[data-learn-one]');const after=last()[1];
    expect(after.inputHidden).toEqual(before.inputHidden);expect(after.hiddenOutput).toEqual(before.hiddenOutput);expect(after.hiddenBias).not.toEqual(before.hiddenBias);
    expect(root.textContent).toContain('점과 선의 거리가 아닙니다');
  });
  it('오차 변화율이 0이면 모델 비교에서도 가짜 이동을 만들지 않는다',()=>{
    journey.goTo(2);const before=last()[1];click('[data-guess="1"]');input('[data-knob="bias"]','.2');click('[data-learn-one]');
    expect(last()[1]).toEqual(before);expect(root.querySelector('.explore-trial-result')!.textContent).toContain('오차가 같아요');
  });
  it('예상 뒤 직접 조작하며 고정된 출발점과 비교하고, 반복 실험할 수 있다',()=>{
    journey.goTo(2);const initial=last()[1];
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-learn-one]')!.disabled).toBe(true);
    click('[data-guess="-1"]');expect(last()[1]).toEqual(initial);
    input('[data-knob="bias"]','-.25');input('[data-knob="bias"]','-.5');
    expect(last()[5]!.previousNeuronModel).toEqual(initial);
    expect(root.querySelector<HTMLButtonElement>('[data-learn-one]')!.disabled).toBe(false);
    expect(root.querySelector('.explore-trial-result')!.textContent).toContain('오차');
    const current=last()[1];click('[data-restart-trial]');
    expect(last()[5]!.previousNeuronModel).toEqual(current);expect(last()[1]).toEqual(current);
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(true);
    click('[data-guess="1"]');input('[data-knob="bias"]','.1');parameter('xWeight');
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(true);
  });
  it('새 뉴런의 출력 연결을 직접 바꾸며 기준선과 최종 답을 구분한다',()=>{
    journey.goTo(3);click('[data-add-neuron]');const before=last()[1];
    input('[data-knob="connection"]','1.5');const after=last()[1];
    expect(after.inputHidden).toEqual(before.inputHidden);expect(after.hiddenBias).toEqual(before.hiddenBias);
    expect(after.hiddenOutput[1]![1]).toBe(1.5);
    expect(forwardPixels(after,[-.5,.5]).logits).not.toEqual(forwardPixels(before,[-.5,.5]).logits);
    expect(root.querySelector('.explore-network')!.textContent).toContain('× (1.50)');
    expect(root.querySelectorAll('.explore-output-nodes > div > span')).toHaveLength(2);
    journey.goTo(1);expect(last()[1]).toEqual(after);journey.goTo(3);expect(last()[1]).toEqual(after);
  });
  it('자료와 특징은 같은 화면의 두 실제 그림에서 같은 칸의 계산을 비교한다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('omr');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete});
    expect(root.querySelectorAll('.explore-comparisons svg')).toHaveLength(2);
    root.querySelector('[data-source-example="0"] [data-pixel="57"]')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    for(const e of root.querySelectorAll('[data-source-example]'))expect(e.textContent).toContain('고른 칸');
  });
});
