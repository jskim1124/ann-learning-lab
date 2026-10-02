import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnderstandingJourney } from './understandingJourney';
import { penaltyExplorationSource, imageExplorationSource } from '../core/explorationSource';
import { ImageLabStore } from '../state/imageLabStore';
import { drawPixelLatentMap } from '../visualization/pixelLatentMap';
import { forwardPixels } from '../core/pixelNetwork';
import { observeResearch } from '../research/bus';
import {exploreAllParameters} from './journeyTestActions';

vi.mock('../visualization/pixelLatentMap',()=>({drawPixelLatentMap:vi.fn(),pixelMapExampleAt:vi.fn(()=>1),MAP_MARGIN:{left:50,right:14,top:13,bottom:39}}));
const source=()=>penaltyExplorationSource([{x:-.5,y:-.5,label:0},{x:-.5,y:.5,label:1},{x:.5,y:-.5,label:1},{x:.5,y:.5,label:0}],['막힘','골']);
describe('실제 자료로 탐구하는 이해 단계',()=>{
  let root:HTMLElement,journey:UnderstandingJourney;const complete=vi.fn();
  const click=(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
  const output=()=>{const el=root.querySelector<HTMLSelectElement>('[data-output]')!;el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));};
  const input=(s:string,v:string)=>{if(!root.querySelector(s)){const id=s.match(/data-knob="([^"]+)/)?.[1];if(id==='connection')output();else if(id)parameter(id);}const el=root.querySelector<HTMLInputElement>(s)!;el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));};
  const parameter=(value:string)=>click(`[data-parameter-choice="${value}"]`);
  const last=()=>vi.mocked(drawPixelLatentMap).mock.calls.at(-1)!;
  beforeEach(()=>{vi.useFakeTimers();document.body.innerHTML='<div id="root"></div>';root=document.getElementById('root')!;journey=new UnderstandingJourney(root,{source,context:()=>'',complete});});
  afterEach(()=>{journey.stop();vi.useRealTimers();vi.clearAllMocks();});
  it('모든 장면을 다시 오갈 수 있고 정해진 답을 요구하지 않는다',()=>{
    expect([...root.querySelectorAll('[data-explore-chapter]')].map(b=>b.textContent)).toEqual(['1 자료 비교','2 뉴런 직접 조절','3 예상 개선하기','4 뉴런 늘리기']);
    click('[data-explore-chapter="3"]');expect(root.dataset.chapter).toBe('0');exploreAllParameters(root);click('[data-explore-chapter="3"]');expect(root.dataset.chapter).toBe('3');click('[data-explore-chapter="0"]');expect(root.dataset.chapter).toBe('0');
    expect(root.querySelector('[data-journey-answer]')).toBeNull();click('[data-explore-chapter="3"]');click('[data-explore-next]');expect(complete).toHaveBeenCalled();
  });
  it('승부차기는 진하기가 아니라 방향을 데이터화하고 임시 사례만 바꾼다',()=>{
    const before=JSON.stringify(source().data);expect(root.textContent).toContain('두 방향을 숫자로');expect(root.querySelector('[data-journey-ink]')).toBeNull();
    input('[data-knob="kick"]','.5');expect(root.querySelector('.explore-point')!.textContent).toContain('(0.50, -0.50)');expect(root.querySelector('.explore-point')!.textContent).toContain('정답 골');
    expect(JSON.stringify(last()[2])).toBe(before);input('[data-knob="kick"]','0');expect(root.querySelector('.explore-point')!.textContent).toContain('가운데 방향은 판정하지 않아요');
  });
  it('세 수를 모두 실제로 바꾸기 전에는 다음 장면이 열리지 않는다',()=>{
    journey.goTo(1);const next=()=>root.querySelector<HTMLButtonElement>('[data-explore-next]')!;
    expect(next().disabled).toBe(true);
    parameter('xWeight');const old=root.querySelector<HTMLInputElement>('[data-knob="xWeight"]')!.value;
    input('[data-knob="xWeight"]',old);expect(next().textContent).toContain('0/3');
    input('[data-knob="xWeight"]','1.34');expect(next().disabled).toBe(true);
    parameter('yWeight');input('[data-knob="yWeight"]','1.34');expect(next().disabled).toBe(true);
    parameter('bias');input('[data-knob="bias"]','1.34');expect(next().disabled).toBe(false);
    click('[data-explore-next]');expect(root.dataset.chapter).toBe('2');expect(next().disabled).toBe(true);
    click('[data-explore-back]');expect(root.dataset.chapter).toBe('1');expect(next().disabled).toBe(false);
  });
  it('분포는 실제 자료이며 한 축으로 접어 비교해도 원자료는 보존된다',()=>{
    journey.goTo(0);expect(last()[2]).toEqual(source().data);click('[data-dimension="1"]');vi.advanceTimersByTime(1600);expect(last()[2].every(r=>r.pixels[1]===0)).toBe(true);
    click('[data-dimension="2"]');vi.advanceTimersByTime(1600);expect(last()[2]).toEqual(source().data);
  });
  it('슬라이더는 실제 가중치를 고치고 식·뉴런 값·지도 모델이 일치한다',()=>{
    journey.goTo(1);parameter('xWeight');input('[data-knob="xWeight"]','-1');parameter('yWeight');input('[data-knob="yWeight"]','1');parameter('bias');const slider=root.querySelector('[data-knob="bias"]');input('[data-knob="bias"]','1');
    expect(root.querySelector('[data-knob="bias"]')).toBe(slider);
    expect(root.querySelectorAll('[data-knob]')).toHaveLength(1);
    const m=last()[1];expect(m.inputHidden[0]).toEqual([-1,1]);expect(m.hiddenBias[0]).toBe(1);
    expect(root.querySelector('.phase-sum')!.textContent).toContain('= 1.00');expect(forwardPixels(m,[-.5,-.5]).hidden[0]).toBe(1);
    expect(root.querySelector('.explore-network')!.textContent).toContain('1.00');
  });
  it('선 클릭은 가까운 자료 점보다 우선하며 선택 좌표는 슬라이더를 고쳐도 고정된다',()=>{
    journey.goTo(1);const canvas=root.querySelector('canvas')!;
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:700,height:350,right:700,bottom:350,x:0,y:0,toJSON:()=>({})});
    canvas.dispatchEvent(new MouseEvent('pointerdown',{clientX:368,clientY:170,bubbles:true}));
    expect(root.querySelector('[data-zero]')).toBeNull();expect(root.querySelector('.explore-point')!.textContent).toContain('뉴런의 합 0.00');expect(root.querySelector('.explore-point')!.textContent).not.toContain('정답 골');
    const p=[...last()[3]];input('[data-knob="bias"]','.25');expect(last()[3]).toEqual(p);expect(root.querySelector('.explore-point')!.textContent).toContain('뉴런의 합 0.25');
    journey.goTo(2);parameter('bias');expect(root.querySelector('.explore-direction-arrow')!.hasAttribute('hidden')).toBe(false);
  });
  it('곱할 수와 더할 수를 선택하면 그 숫자 하나만 강조되고 실시간 값이 일치한다',()=>{
    journey.goTo(1);
    for(const id of ['xWeight','yWeight','bias']){
      parameter(id);const slider=root.querySelector<HTMLInputElement>(`[data-knob="${id}"]`)!;slider.focus();input(`[data-knob="${id}"]`,'1.23');
      const highlighted=root.querySelectorAll('.parameter-active');expect(highlighted).toHaveLength(1);
      expect(highlighted[0]!.getAttribute('data-network-parameter')).toBe(id);expect(highlighted[0]!.textContent).toBe('1.23');
      expect(root.querySelectorAll('.parameter-marker')).toHaveLength(0);
      expect(document.activeElement).toBe(slider);
    }
    journey.goTo(2);input('[data-knob="bias"]','-.25');expect(root.querySelector('.parameter-active')!.textContent).toBe('-0.25');
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
    output();expect(root.querySelector('.explore-output-nodes')!.textContent).toContain('출력은 클래스 수인 2개');
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
    vi.advanceTimersByTime(5600);expect(store.snapshot.xFeature).toBe('lr');expect(last()[2]).toEqual(imageExplorationSource(store.snapshot).data);expect(last()[5]!.axisLegend!.horizontal.title).toBe('오른쪽 − 왼쪽 (평균 0)');
  });
  it('잘못된 특징 조합을 선택해도 이전의 유효한 좌표로 돌아온다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('digits');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});journey.goTo(0);
    const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value='center';select.dispatchEvent(new Event('change',{bubbles:true}));
    expect(store.snapshot.xFeature).toBe('ink');expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.value).toBe('');
  });
  it('점의 정답·예상은 클릭한 점 팝업에서만 보이며 닫을 수 있다',()=>{
    journey.goTo(2);expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(true);
    root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:30,clientY:40}));
    expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(false);expect(root.querySelector('.explore-point')!.textContent).toContain('정답 골');
    click('[data-close-point]');expect(root.querySelector<HTMLElement>('.explore-point')!.hidden).toBe(true);
  });
  it('학습 방향은 선택한 수 하나만 실제 계산값으로 갱신한다',()=>{
    journey.goTo(1);input('[data-knob="bias"]','.2');journey.goTo(2);const before=last()[1];input('[data-knob="bias"]','.4');click('[data-learn-one]');const after=last()[1];
    expect(after.inputHidden).toEqual(before.inputHidden);expect(after.hiddenOutput).toEqual(before.hiddenOutput);expect(after.hiddenBias).not.toEqual(before.hiddenBias);
    expect(root.textContent).toContain('선까지의 거리가 아니에요');
  });
  it('고른 자료의 뉴런이 비활성이라 변화율이 0이면 가짜 이동을 만들지 않는다',()=>{
    journey.goTo(1);input('[data-knob="bias"]','-1');journey.goTo(2);root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));
    const before=last()[1];input('[data-knob="bias"]','.2');click('[data-learn-one]');
    expect(last()[1]).toEqual(before);expect(root.querySelector('.training-evidence')!.getAttribute('data-result')).toBe('same');
  });
  it('예상 뒤 직접 조작하며 고정된 출발점과 비교하고, 반복 실험할 수 있다',()=>{
    journey.goTo(2);parameter('bias');const initial=last()[1];
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-learn-one]')!.disabled).toBe(true);
    expect(last()[1]).toEqual(initial);
    input('[data-knob="bias"]','-.25');input('[data-knob="bias"]','-.5');
    expect(last()[5]!.previousNeuronModel).toBeUndefined();
    expect(root.querySelector<HTMLButtonElement>('[data-learn-one]')!.disabled).toBe(false);
    expect(root.querySelector('.explore-impact')!.textContent).toContain('틀린 자료');
    expect(root.querySelector('.correct-share strong')!.textContent).toContain('→');
    const current=last()[1];click('[data-restart-trial]');
    expect(last()[5]!.previousNeuronModel).toBeUndefined();expect(last()[1]).toEqual(current);
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(false);
    input('[data-knob="bias"]','.1');parameter('xWeight');
    expect(root.querySelector<HTMLInputElement>('[data-knob]')!.disabled).toBe(false);
  });
  it('새 뉴런의 출력 연결을 직접 바꾸며 기준선과 최종 답을 구분한다',()=>{
    journey.goTo(3);const out=root.querySelector<HTMLSelectElement>('[data-output]')!;out.value='1';out.dispatchEvent(new Event('change',{bubbles:true}));click('[data-add-neuron]');const before=last()[1];
    input('[data-knob="connection"]','1.5');const after=last()[1];
    expect(after.inputHidden).toEqual(before.inputHidden);expect(after.hiddenBias).toEqual(before.hiddenBias);
    expect(after.hiddenOutput[1]![1]).toBe(1.5);
    expect(forwardPixels(after,[-.5,.5]).logits).not.toEqual(forwardPixels(before,[-.5,.5]).logits);
    expect(root.querySelector('.explore-network')!.textContent).toContain('× (1.50)');
    expect(root.querySelector('.explore-output-nodes')!.textContent).toContain('출력은 클래스 수인 2개');
    journey.goTo(1);expect(last()[1]).toEqual(after);journey.goTo(3);expect(last()[1]).toEqual(after);
  });
  it('한 사례의 가로와 세로 계산이 각각 정확한 좌표로 이어진다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('omr'),get=()=>imageExplorationSource(store.snapshot);journey=new UnderstandingJourney(root,{source:get,context:()=>'',complete});
    expect(root.querySelectorAll('[data-source-example]')).toHaveLength(1);expect(root.querySelector('[data-compare]')).toBeNull();
    for(const axis of [0,1]){const el=root.querySelector<HTMLSelectElement>(`[data-feature="${axis}"]`)!;el.value=get().featureIds![axis]!;el.dispatchEvent(new Event('change',{bubbles:true}));root.querySelector<HTMLButtonElement>('[data-projection-skip]')!.click();}
    expect(root.querySelectorAll('.projection-stack svg')).toHaveLength(1);
    for(const axis of [0,1] as const){const c=get().axisCalculation!(0,axis);expect(root.querySelector('[data-feature-trace="'+axis+'"]')!.textContent).toContain(c.coordinate.toFixed(2));expect(c.coordinate).toBeCloseTo(get().data[0]!.pixels[axis]!,12);}
  });
  it('대표 자료 한 개의 계산과 이동을 재생하고 원자료·모델은 보존한다',()=>{
    const original=JSON.stringify(source().data),model=JSON.stringify(last()[1]),events=vi.fn(),off=observeResearch(events);
    try {
      click('[data-projection-play]');expect(last()[2]).toHaveLength(0);
      vi.advanceTimersByTime(2200);expect(last()[2]).toHaveLength(0);
      click('[data-projection-play]');vi.advanceTimersByTime(5000);expect(last()[2]).toHaveLength(0);
      expect(root.querySelector('[data-projection-play]')!.textContent).toBe('계속 보기');click('[data-projection-play]');
      vi.advanceTimersByTime(2800);expect(last()[2]).toHaveLength(1);vi.advanceTimersByTime(700);
      expect(last()[2]).toEqual(source().data);
      expect(JSON.stringify(source().data)).toBe(original);expect(JSON.stringify(last()[1])).toBe(model);
      expect(events.mock.calls.filter(c=>c[1].operation==='projection-example')).toHaveLength(1);
      expect(events.mock.calls.length).toBe(5);
    } finally {off();}
  });
  it('특징을 고르면 즉시 재생하고 끝날 때까지 다른 특징 선택을 잠근다',()=>{
    journey.stop();root.replaceWith(root=root.cloneNode(false) as HTMLElement);const store=new ImageLabStore('omr');journey=new UnderstandingJourney(root,{source:()=>imageExplorationSource(store.snapshot),context:()=>'',complete,setAxes:(x,y)=>store.setAxes(x,y)});
    const before=imageExplorationSource(store.snapshot).data;
    const changeFeature=(value:string)=>{const select=root.querySelector<HTMLSelectElement>('[data-feature="0"]')!;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};
    changeFeature('lr');vi.advanceTimersByTime(1700);
    expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.disabled).toBe(true);
    last()[2].forEach((r,i)=>expect(r.pixels[1]).toBe(before[i]!.pixels[1]));
    changeFeature('tb');expect(store.snapshot.xFeature).toBe('lr');
    expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.value).toBe('lr');
    vi.advanceTimersByTime(4000);expect(last()[2]).toEqual(imageExplorationSource(store.snapshot).data);
    expect(root.querySelector<HTMLSelectElement>('[data-feature="0"]')!.disabled).toBe(false);
    changeFeature('tb');journey.goTo(1);expect(vi.getTimerCount()).toBe(0);
    expect(root.querySelector<HTMLElement>('.explore-projection')!.hidden).toBe(true);expect(last()[2]).toEqual(imageExplorationSource(store.snapshot).data);
  });
  it('결과 바로 보기와 움직임 줄이기는 기다리지 않고 정확한 최종 좌표에 도착한다',()=>{
    click('[data-projection-play]');vi.advanceTimersByTime(1100);click('[data-projection-skip]');expect(vi.getTimerCount()).toBe(0);expect(last()[2]).toEqual(source().data);
    vi.stubGlobal('matchMedia',()=>({matches:true}));
    try {click('[data-dimension="1"]');click('[data-dimension="2"]');expect(last()[2]).toEqual(source().data);expect(vi.getTimerCount()).toBe(0);}finally{vi.unstubAllGlobals();}
  });
  it('출력 연결은 이진 사용 선택 없이 연속적인 가중치로 고친다',()=>{
    journey.goTo(3);expect(root.querySelector('[data-connection-example]')).toBeNull();expect(root.querySelector('[data-knob="connection"]')).toBeNull();output();const before=last()[1];input('[data-knob="connection"]','.53');const after=last()[1];
    expect(after.hiddenOutput[1]![0]).toBe(.53);expect(after.inputHidden).toEqual(before.inputHidden);expect(root.querySelectorAll('[data-output-wire]')).toHaveLength(2);expect(root.textContent).toContain('연결을 켜고 끄는 선택은 없어요');
  });
  it('직접 조절에서 팝업은 확률이 아니라 실제 뉴런 합과 보낼 값을 즉시 보여 준다',()=>{
    journey.goTo(1);root.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));
    const popup=root.querySelector('.explore-point')!;expect(popup.textContent).not.toContain('%');expect(popup.textContent).toContain('뉴런의 합');
    input('[data-knob="bias"]','1');
    expect(popup.textContent).toContain('0.50');expect(root.querySelector('.explore-impact')!.textContent).toContain('0.50');
    expect(last()[5]!.focusLabel).toBe('합 0.50');
  });
  it('실제 학습 방향과 그래프에서 셀 수 있는 오답 및 정답 몫을 함께 표시한다',()=>{
    journey.goTo(2);expect(root.querySelector('[data-knob]')).toBeNull();expect(last()[2]).toHaveLength(4);parameter('bias');
    expect(last()[5]!.showDecisionBoundary).toBe(true);expect(last()[5]!.showMisclassifications).toBe(true);expect(last()[5]!.onlyNeuron).toBe(0);
    input('[data-knob="bias"]','-.1');expect(root.querySelector('[data-parameter-choice="bias"]')!.getAttribute('data-completed')).toBe('true');
    expect(root.querySelector('.training-evidence')!.textContent).toContain('선까지의 거리가 아니');expect(root.querySelector('.prediction-comparison')).not.toBeNull();expect(root.querySelector('.score-gap')).toBeNull();
    expect(root.querySelector('.explore-key')!.textContent).toContain('× = 틀린 자료');
    expect(root.querySelector<HTMLDetailsElement>('.training-evidence details')!.open).toBe(false);
    root.querySelector<HTMLDetailsElement>('.training-evidence details')!.open=true;
    input('[data-knob="bias"]','-.2');expect(root.querySelector<HTMLDetailsElement>('.training-evidence details')!.open).toBe(true);
  });
  it('처음에는 특징과 조절값을 고르지 않고 선택해야 할 부분을 강조한다',()=>{
    journey.goTo(1);expect(root.querySelector('[data-knob]')).toBeNull();expect(root.querySelector('[data-parameter] [aria-pressed="true"]')).toBeNull();expect(root.querySelector('.parameter-choices.needs-choice')).not.toBeNull();
    parameter('xWeight');expect(root.querySelector('[data-knob="xWeight"]')).not.toBeNull();
  });
});
