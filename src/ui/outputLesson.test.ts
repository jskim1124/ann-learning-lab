import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageFeatureLesson } from "./imageFeatureLesson";
import { ImageLabStore } from "../state/imageLabStore";
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { lessonTruth, NEURON_EXAMPLES, neuronCalculation, neuronLessonModel } from "../core/neuronLesson";
import { outputTeachingModel } from "../core/lessonArithmetic";
import { forwardPixels } from "../core/pixelNetwork";
import { outputPractice, renderOutputScene } from "./outputLesson";
const predicted=(r:ReturnType<typeof forwardPixels>)=>r.probabilities.indexOf(Math.max(...r.probabilities));

vi.mock("../visualization/pixelLatentMap",async original=>({...await original<typeof import("../visualization/pixelLatentMap")>(),drawPixelLatentMap:vi.fn()}));
vi.mock("../core/imageInput",async original=>({...await original<typeof import("../core/imageInput")>(),drawImagePixels:vi.fn()}));

function setup(){
  document.body.innerHTML='<div id="lesson"></div>';
  const root=document.getElementById('lesson')!,lesson=new ImageFeatureLesson(root,new ImageLabStore('digits'),vi.fn(),vi.fn());lesson.render();
  return {root,lesson,click:(s:string)=>root.querySelector<HTMLButtonElement>(s)!.click()};
}
describe('연결값·정답·출력의 의미',()=>{
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
  it('연결값의 출처와 반영하는 크기를 설명한다',()=>{
    const {root,lesson,click}=setup();
    expect(root.querySelector('#flText')!.textContent).toContain('정답 번호나 뉴런 연결값이 아닙니다');
    expect(root.querySelector('#flCalculation')!.textContent).toContain('(0 + 1) ÷ 2 = 0.5');
    click('[data-fl-step="3"]');
    expect(root.querySelector('#flText')!.textContent).toContain('예제를 만든 사람');
    expect(root.querySelector('#flCalculation')!.textContent).toContain('0.2 × 0.5 = 0.1');
    expect(root.querySelector('#flCalculation')!.textContent).toContain('1이 항상 더 좋은 값');
    const m=neuronLessonModel(),base=neuronCalculation(m,[.2,.2]);
    expect(neuronCalculation(m,[.4,.2]).sum-base.sum).toBeCloseTo(.2);
    expect(neuronCalculation(m,[.2,.4]).sum-base.sum).toBeCloseTo(.1);
    lesson.stop();
  });
  it('숨겨진 선은 배경·화살표로도 공개하지 않으며, 확인 버튼으로만 보인다',()=>{
    const {root,lesson,click}=setup();click('[data-fl-step="3"]');
    for(let i=0;i<5;i++)click('#flAction');click('[data-neuron-answer="0"]');click('#flAction');
    const options=()=>vi.mocked(drawPixelLatentMap).mock.calls.at(-1)![5]!;
    expect(options()).toMatchObject({neutralBackground:true,showNeuronBoundaries:false,showDecisionBoundary:false,showDataLabels:true});
    expect(root.querySelector('.point-truth')!.textContent).toContain('정답 B');
    click('#flShowLines');expect(options().showNeuronBoundaries).toBe(true);
    click('#flShowLines');expect(options().showNeuronBoundaries).toBe(false);
    click('#flAction');click('#flAction');
    expect(options()).toMatchObject({neutralBackground:true,showNeuronBoundaries:false,showDecisionBoundary:false});
    expect(root.querySelector('.point-truth')!.textContent).toContain('정답 B · 모델 예상 A');
    click('#flShowLines');expect(options()).toMatchObject({neutralBackground:false,showNeuronBoundaries:true,showDecisionBoundary:true});
    lesson.stop();
  });
  it('정답은 모델 예상과 독립적이며 새 좌표의 정답을 만들어 내지 않는다',()=>{
    const point=[.2,.2],m=neuronLessonModel(),labels=JSON.stringify(NEURON_EXAMPLES);
    expect(lessonTruth(point)).toBe(1);expect(predicted(forwardPixels(m,point))).toBe(0);
    const corrected={...m,hiddenBias:[.5]};expect(predicted(forwardPixels(corrected,point))).toBe(1);
    expect(lessonTruth(point)).toBe(1);expect(lessonTruth([.37,-.23])).toBeNull();
    expect(JSON.stringify(NEURON_EXAMPLES)).toBe(labels);
  });
  it('A 곱하기·더하기·B 계산을 따로 보여 주고 재생은 출력 계산 문제에서 멈춘다',()=>{
    vi.useFakeTimers();const {root,lesson,click}=setup();click('[data-fl-step="4"]');
    expect(root.querySelectorAll('.output-route')).toHaveLength(2);
    expect(root.querySelector('.output-route strong')!.textContent).toBe('A ?');
    click('#flAction');expect(root.querySelector('.output-equation')!.textContent).toContain('−0.3');
    expect(root.querySelector('.output-route strong')!.textContent).toBe('A ?');
    click('#flAction');expect(root.querySelector('.output-route strong')!.textContent).toBe('A 0.7');
    click('#flPlay');vi.advanceTimersByTime(15000);
    expect(root.querySelector('#flPlay')!.textContent).toContain('재생');
    expect(root.querySelector<HTMLButtonElement>('#flAction')!.disabled).toBe(true);
    click('[data-output-answer="2"]');
    expect(root.querySelector('.arithmetic-check button.correct')).toBeNull();
    expect(root.querySelector('.arithmetic-check [role=status]')!.textContent).not.toContain('0.6');
    click('[data-output-answer="0"]');click('#flAction');click('#flAction');
    expect(root.querySelectorAll('.output-route')).toHaveLength(3);
    expect(root.querySelector('#flCalculation')!.textContent).toContain('0.15 + 0.3 = 0.45');
    click('#flAction');click('[data-output-neurons="2"]');
    expect(root.querySelectorAll('.output-signals > span')).toHaveLength(2);
    expect(root.querySelectorAll('.output-route')).toHaveLength(3);
    expect(root.querySelector('#flPercent')!.textContent).toContain('100장 중 80장');
    lesson.stop();
  });
  it('연습 정답은 실제 계산과 같고, C가 높으면 A·B 동점은 최종 경계가 아니다',()=>{
    const p=outputPractice();expect(p.signal).toBeCloseTo(.4);expect(p.answer).toBeCloseTo(.6);
    expect(p.choices.filter(v=>Math.abs(v-p.answer)<1e-9)).toHaveLength(1);
    const m=outputTeachingModel(1),r=forwardPixels(m,[.5,0]);
    expect(r.logits[0]).toBe(.5);expect(r.logits[1]).toBe(.5);expect(r.logits[2]).toBe(.55);
    expect(predicted(r)).toBe(2);
  });
  it('탐색 좌표와 표시된 점수로 같은 계산을 재현할 수 있다',()=>{
    const {root,lesson}=setup();
    renderOutputScene(root,[.36001,.26998],4,1);
    expect(root.querySelector('#flCalculation')!.textContent).toContain('신호 0.495');
    expect(root.querySelector('.output-route strong')!.textContent).toBe('A 0.505');
    expect(root.querySelector('.point-truth')!.textContent).toContain('모델 예상 A');
    renderOutputScene(root,[.36,.28],4,1);
    expect(root.querySelector('.point-truth')!.textContent).toContain('A·B 동점');
    lesson.stop();
  });
});
