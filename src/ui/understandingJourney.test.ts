import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {UnderstandingJourney} from './understandingJourney';
describe('설명·조작·확인이 하나인 이해 UI',()=>{
  let root:HTMLElement,lesson:UnderstandingJourney,next:ReturnType<typeof vi.fn>;
  const click=(selector:string)=>root.querySelector<HTMLButtonElement>(selector)!.click();
  const change=(selector:string,value:string,type='change')=>{const el=root.querySelector<HTMLInputElement>(selector)!;el.value=value;el.dispatchEvent(new Event(type,{bubbles:true}));};
  const answer=(index:number)=>click(`[data-journey-answer="${index}"]`);
  const advance=()=>click('[data-journey-next]');
  const first=()=>{click('[data-journey-cell="0"]');click('[data-journey-cell="1"]');answer(1);click('[data-journey-cell="2"]');click('[data-journey-cell="3"]');answer(1);advance();};
  const second=()=>{change('[data-journey-axis="x"]','top');change('[data-journey-axis="y"]','bottom');answer(0);advance();};
  beforeEach(()=>{document.body.innerHTML='<main></main>';root=document.querySelector('main')!;next=vi.fn();lesson=new UnderstandingJourney(root,{context:()=> '숫자',complete:next});});
  afterEach(()=>{lesson.stop();vi.useRealTimers();});
  it('재생은 두 칸의 계산만 보여주고 문제를 대신 풀거나 다음 단계로 가지 않는다',()=>{
    vi.useFakeTimers();click('[data-journey-play]');vi.advanceTimersByTime(700);expect(root.querySelectorAll('.is-picked')).toHaveLength(1);vi.advanceTimersByTime(700);expect(root.querySelectorAll('.is-picked')).toHaveLength(2);
    expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);expect(next).not.toHaveBeenCalled();
    answer(0);expect(root.querySelectorAll('.is-wrong')).toHaveLength(1);expect(root.querySelector('.journey-summary')!.hasAttribute('hidden')).toBe(true);
    answer(1);expect(root.querySelector('.journey-question')!.textContent).toContain('아랫줄');click('[data-journey-cell="2"]');click('[data-journey-cell="3"]');answer(1);expect(root.querySelector('.journey-summary')!.textContent).toContain('0.75');expect(root.textContent).not.toContain('원리 설명');expect(root.textContent).not.toContain('직접 고치기');
  });
  it('각 단계의 조작과 퀴즈를 통과하고 앞 장면으로 돌아가도 모델이 보존된다',()=>{
    first();expect(root.textContent).toContain('같은 자리: A 1장 · B 4장');second();
    click('[data-journey-predict="0"]');expect(root.querySelector<HTMLInputElement>('[data-journey-bias]')!.disabled).toBe(true);
    click('[data-journey-predict="1"]');change('[data-journey-bias]','0','input');expect(root.textContent).toContain('5 / 7');answer(2);advance();
    click('[data-journey-add]');expect(root.textContent).toContain('5 / 7');change('[data-journey-connection]','1','input');expect(root.textContent).toContain('7 / 7');
    expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);
    click('[data-journey-compare]');expect(root.textContent).toContain('5 / 7');click('[data-journey-compare]');answer(2);answer(0);
    click('[data-journey-step="1"]');expect(root.querySelector<HTMLSelectElement>('[data-journey-axis="x"]')!.value).toBe('top');click('[data-journey-step="3"]');expect(root.textContent).toContain('7 / 7');advance();expect(next).toHaveBeenCalledOnce();
    lesson.reset();lesson.render();expect(root.querySelector<HTMLButtonElement>('[data-journey-step="3"]')!.disabled).toBe(true);
  });
  it('슬라이더 DOM은 드래그 중 유지되며 계산 문제는 지금 선택한 점과 일치한다',()=>{
    first();second();click('[data-journey-predict="1"]');const range=root.querySelector('[data-journey-bias]');change('[data-journey-bias]','0','input');expect(root.querySelector('[data-journey-bias]')).toBe(range);
    click('.journey-sample-row [data-journey-point="1"]');expect(root.querySelector('.journey-question')!.textContent).toContain('0.25 × 1.00 + 0.75');expect(root.querySelector('[data-journey-answer="2"]')!.textContent).toBe('0.00');
  });
  it('그래프에서 직접 옮긴 좌표가 계산 문제에도 즉시 반영된다',()=>{
    first();second();click('[data-journey-predict="1"]');change('[data-journey-bias]','0','input');
    const plot=root.querySelector<HTMLElement>('.journey-plot')!,svg=plot.querySelector('svg')!;
    svg.getBoundingClientRect=()=>({left:0,top:0,width:600,height:390} as DOMRect);
    plot.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:182.5,clientY:98.75}));
    expect(root.querySelector('.journey-question')!.textContent).toContain('0.25 × 1.00 + 0.75');
    expect(root.querySelector('[data-journey-answer="2"]')!.textContent).toBe('0.00');
  });
  it.each(['숫자','OMR','웹캠','승부차기'])('%s에서도 네 단계와 계산·상호작용이 같다',context=>{
    lesson=new UnderstandingJourney(root,{context:()=>context,complete:next});
    expect([...root.querySelectorAll('.journey-nav button')].map(b=>b.textContent)).toEqual(['1 특징 계산','2 분포·선택','3 뉴런·선','4 뉴런·출력']);
    expect(root.querySelector('[data-journey-cell="0"]')!.textContent).toBe('1.00');first();second();expect(root.querySelectorAll('[data-journey-bias]')).toHaveLength(1);
  });
});
