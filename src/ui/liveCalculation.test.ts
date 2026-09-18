import { describe,it,expect } from 'vitest';
import { networkArithmetic,renderSignalNetwork,signalNetwork } from './liveCalculation';
import { forwardPixels,initializePixelModel } from '../core/pixelNetwork';
import { neuronLessonModel } from '../core/neuronLesson';

describe('연결지도에 놓인 실제 곱셈·덧셈·확률',()=>{
  it('OMR 다섯 클래스와 승부차기 출력 색이 각각 그래프와 일치한다',()=>{
    const panel=document.createElement('div');
    panel.innerHTML=signalNetwork(initializePixelModel(2,1,5),[0,0],['①','②','③','④','⑤']);
    expect(panel.querySelector<HTMLElement>('[data-network-output="4"]')!.style.getPropertyValue('--class-color')).toBe('#1558b7');
    const binary=initializePixelModel(2,1,2);binary.hiddenOutput[0]=[0];binary.outputBias[0]=0;
    panel.innerHTML=signalNetwork(binary,[0,0],['막힘','골']);
    expect(panel.querySelector<HTMLElement>('[data-network-output="0"]')!.style.getPropertyValue('--class-color')).toBe('#1f6bd6');
    expect(panel.querySelector<HTMLElement>('[data-network-output="1"]')!.style.getPropertyValue('--class-color')).toBe('#f17605');
  });
  it('작은 예제의 모든 항과 퍼센트가 실제 추론과 같다',()=>{
    const model=neuronLessonModel(),r=networkArithmetic(model,[.2,.2],0,0);
    expect(r.products).toEqual([.2,.1]);expect(r.sum).toBeCloseTo(.3);
    expect(r.outputProducts[0]).toBeCloseTo(-.3);expect(r.logits[0]).toBeCloseTo(.7);
    r.positive.forEach((v,i)=>expect(v/r.total).toBeCloseTo(r.probabilities[i]!,14));
    expect(r.probabilities[0]).not.toBeCloseTo(.7);
  });
  it('196칸 모두의 곱을 합하며 큰 출력 점수에도 확률 계산이 넘치지 않는다',()=>{
    const m=initializePixelModel(196,4,3),input=Array.from({length:196},(_,i)=>i/196);
    m.outputBias=[1000,1001,999];
    const r=networkArithmetic(m,input,2,1),actual=forwardPixels(m,input);
    expect(r.products).toHaveLength(196);expect(r.hidden).toEqual(actual.hidden);
    expect(r.outputProducts.reduce((a,b)=>a+b,m.outputBias[1]!)).toBeCloseTo(actual.logits[1]!,12);
    expect(r.total).toBeGreaterThan(0);expect(Number.isFinite(r.total)).toBe(true);
    expect(r.positive[1]!/r.total).toBeCloseTo(actual.probabilities[1]!,14);
    expect(signalNetwork(m,input,['가위','바위','보'])).toContain('나머지 194칸');
  });
  it('노드를 선택하고 점을 옮겨도 선택 경로를 유지하며 뉴런 삭제 후 안전하게 맞춘다',()=>{
    const panel=document.createElement('div');document.body.append(panel);
    const m=initializePixelModel(2,4,3);
    renderSignalNetwork(panel,m,[.2,.2],['A','B','C']);
    panel.querySelector<HTMLButtonElement>('[data-network-neuron="3"]')!.click();
    panel.querySelector<HTMLButtonElement>('[data-network-output="2"]')!.click();
    expect(panel.querySelector('.path-hidden strong')!.textContent).toBe('뉴런 4로 들어가는 길');
    expect(panel.querySelector('.path-output')!.textContent).toContain('뉴런 4'); // Selected hidden signal is on the visible output path, not lost in “others”.
    const before=panel.textContent;
    renderSignalNetwork(panel,m,[-.5,.6],['A','B','C']);
    expect(panel.textContent).not.toBe(before);expect(panel.dataset.neuron).toBe('3');expect(panel.dataset.output).toBe('2');
    renderSignalNetwork(panel,neuronLessonModel(),[.2,.2],['A','B']);
    expect(panel.dataset.neuron).toBe('0');expect(panel.dataset.output).toBe('1');
    expect(panel.textContent).not.toContain('NaN');expect(panel.textContent).not.toContain('계산 따라가기');panel.remove();
  });
  it('아직 고른 자료가 없으면 임의의 계산을 학생의 결과처럼 표시하지 않는다',()=>{
    const html=signalNetwork(neuronLessonModel(),[.2,.2],['A','B'],false);
    expect(html).not.toContain('network-path');expect(html).toContain('자료의 점을 눌러');
  });
});
