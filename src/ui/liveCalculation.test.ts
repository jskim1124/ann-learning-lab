import { describe,it,expect } from 'vitest';
import { installSignalNetwork,networkArithmetic,renderSignalNetwork,signalNetwork } from './liveCalculation';
import { forwardPixels,initializePixelModel,trainPixelModel } from '../core/pixelNetwork';
import { networkOverview,responseInk } from './networkOverview';
import { neuronLessonModel } from '../core/neuronLesson';

describe('연결지도에 놓인 실제 곱셈·덧셈·확률',()=>{
  it('답 하나만 살펴봐도 확률의 분모는 전체 클래스로 계산한다',()=>{
    const m=initializePixelModel(2,2,5),p=[.5,.5],panel=document.createElement('div');
    panel.innerHTML=networkOverview(m,p,['A','B','C','D','E'],true,0,4,{onlyOutput:4});
    expect(panel.querySelectorAll('[data-network-output]')).toHaveLength(1);
    expect(panel.querySelector('[data-network-output="4"]')).not.toBeNull();
    expect(parseFloat(panel.querySelector<HTMLElement>('.answer-track>i')!.style.width)).toBeCloseTo(forwardPixels(m,p).probabilities[4]!*100);
  });
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
  it('기본 화면에는 소수점과 계산식 없이 실제 예상 비율을 막대로 보여 준다',()=>{
    const panel=document.createElement('div'),model=neuronLessonModel(),input=[.2,.2];
    renderSignalNetwork(panel,model,input,['A','B']);
    const overview=panel.querySelector('.network-overview')!;
    expect(overview.textContent).not.toMatch(/\d\.\d|%|×|÷/);
    expect(panel.querySelector<HTMLDetailsElement>('.network-calculations')!.open).toBe(false);
    const probabilities=forwardPixels(model,input).probabilities;
    overview.querySelectorAll<HTMLElement>('.answer-track>i').forEach((bar,i)=>expect(parseFloat(bar.style.width)).toBeCloseTo(probabilities[i]!*100,10));
    expect(overview.querySelector('.network-verdict')!.textContent).toContain('A');
    expect(panel.querySelector('.network-path')!.closest('details')!.className).toBe('network-calculations');
  });
  it('자세히 보기는 선택과 실시간 갱신 후에도 열림 상태를 유지한다',()=>{
    const panel=document.createElement('div'),model=initializePixelModel(2,4,3);
    renderSignalNetwork(panel,model,[.1,.2],['A','B','C']);
    panel.querySelector<HTMLButtonElement>('[data-network-neuron="3"]')!.click();
    expect(panel.querySelector<HTMLDetailsElement>('.network-calculations')!.open).toBe(false);
    panel.querySelector<HTMLDetailsElement>('.network-calculations')!.open=true;
    renderSignalNetwork(panel,model,[.8,.2],['A','B','C']);
    expect(panel.querySelector<HTMLDetailsElement>('.network-calculations')!.open).toBe(true);
  });
  it('입력만 움직일 때 학습했다고 표시하지 않고 실제 갱신된 연결만 강조한다',()=>{
    const panel=document.createElement('div'),model=initializePixelModel(2,3,2);
    renderSignalNetwork(panel,model,[.1,.2],['A','B']);
    renderSignalNetwork(panel,model,[.8,.2],['A','B']);
    expect(panel.querySelectorAll('.is-changed')).toHaveLength(0);
    expect(panel.querySelectorAll('.is-reacting').length).toBeGreaterThan(0);
    const trained=trainPixelModel(model,[{pixels:[.8,.2],label:1}],1,.1);
    renderSignalNetwork(panel,trained,[.8,.2],['A','B']);
    expect(panel.querySelectorAll('path.is-changed').length).toBeGreaterThan(0);
    expect(panel.querySelector('.network-change')!.textContent).toContain('학습');
    renderSignalNetwork(panel,trained,[.8,.2],['A','B']);
    expect(panel.querySelectorAll('.is-changed,.is-reacting')).toHaveLength(0);
  });
  it('16개 뉴런과 모든 출력이 남고 음수 반응과 같은 예상도 구분한다',()=>{
    const panel=document.createElement('div'),model=initializePixelModel(196,16,6);
    model.hiddenBias[0]=-1;model.hiddenOutput=model.hiddenOutput.map(row=>row.map(()=>0));
    renderSignalNetwork(panel,model,Array(196).fill(0),['A','B','C','D','E','F']);
    expect(panel.querySelectorAll('[data-network-neuron]')).toHaveLength(16);
    expect(panel.querySelectorAll('[data-network-output]')).toHaveLength(6);
    expect(panel.querySelector('[data-network-neuron="0"] small')!.textContent).toBe('−');
    expect(panel.querySelector('.network-verdict')!.textContent).toContain('같아요');
    expect(responseInk(-.5,'tanh')).toBe(responseInk(.5,'tanh'));
    expect(responseInk(0,'relu')).toBe(0);expect(responseInk(100,'relu')).toBeLessThan(1);
  });
  it('전체 연결선은 상세 보기 안에 보관하고 입력을 바꿔도 SVG와 열림 상태를 보존한다',()=>{
    const host=document.createElement('div');host.innerHTML='<svg id="testWires"></svg>';
    const svg=host.querySelector('svg')!;installSignalNetwork(svg,'testOverview');
    const panel=host.querySelector<HTMLElement>('#testOverview')!,model=neuronLessonModel();
    renderSignalNetwork(panel,model,[0,0],['A','B'],false);
    expect(svg.closest('.network-calculations')).not.toBeNull();
    const wires=svg.closest('details')!;wires.open=true;
    renderSignalNetwork(panel,model,[.1,.2],['A','B']);
    expect(host.querySelector('#testWires')).toBe(svg);expect(wires.open).toBe(true);
    expect(host.querySelector<HTMLDetailsElement>('.network-calculations')!.open).toBe(false);
  });
  it('더할 값만 바뀌면 노드를 강조하며 그대로인 연결선은 바뀌었다고 표시하지 않는다',()=>{
    const panel=document.createElement('div'),model=initializePixelModel(2,2,2);
    renderSignalNetwork(panel,model,[.1,.2],['A','B']);
    model.hiddenBias[1]=.1;model.outputBias[0]=.2;model.epoch++;
    renderSignalNetwork(panel,model,[.1,.2],['A','B']);
    expect(panel.querySelectorAll('path.is-changed')).toHaveLength(0);
    expect(panel.querySelector('[data-network-neuron="1"].is-changed')).not.toBeNull();
    expect(panel.querySelector('[data-network-output="0"].is-changed')).not.toBeNull();
  });
});
