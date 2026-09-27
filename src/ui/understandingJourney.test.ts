import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {UnderstandingJourney} from './understandingJourney';
describe('예측 → 조작 → 확인의 짧은 공통 이해 장면',()=>{
  let root:HTMLElement,lesson:UnderstandingJourney,next:ReturnType<typeof vi.fn>;
  const click=(selector:string)=>root.querySelector<HTMLButtonElement>(selector)!.click();
  const answer=(i:number)=>click(`[data-journey-answer="${i}"]`);
  const advance=()=>click('[data-journey-next]');
  const play=()=>{click('[data-journey-play]');vi.advanceTimersByTime(2000);};
  const ink=()=>{const range=root.querySelector<HTMLInputElement>('[data-journey-ink]')!;range.value='1';range.dispatchEvent(new Event('input',{bubbles:true}));};
  const enterMovement=()=>{
    ink();answer(2);advance();play();answer(1);advance();play();answer(1);advance();
    const stage=root.querySelector('.journey-stage')!;
    for(const key of ['ArrowRight','ArrowRight','ArrowRight','ArrowUp'])stage.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
    advance();click('[data-journey-feature="1"]');vi.advanceTimersByTime(1200);answer(1);advance();play();answer(1);advance();
  };
  const move=(value:number,position:number,direction:number)=>{click(`[data-journey-threshold="${value}"]`);answer(position);answer(direction);click('[data-journey-run]');vi.advanceTimersByTime(2000);};
  beforeEach(()=>{vi.useFakeTimers();document.body.innerHTML='<main></main>';root=document.querySelector('main')!;next=vi.fn();lesson=new UnderstandingJourney(root,{context:()=> '숫자',complete:next});});
  afterEach(()=>{lesson.stop();vi.useRealTimers();vi.restoreAllMocks();});
  it('한 개념씩 보여주며 조작과 답 없이 다음 장면을 열지 않는다',()=>{
    advance();expect(root.dataset.scene).toBe('0');expect(root.querySelector('.journey-network')!.hasAttribute('hidden')).toBe(true);
    ink();answer(0);expect(root.querySelectorAll('.is-wrong')).toHaveLength(1);expect(root.querySelector('.journey-summary')).toBeNull();
    answer(2);advance();click('[data-journey-play]');vi.advanceTimersByTime(700);expect(root.dataset.scene).toBe('1');expect(root.querySelector<HTMLButtonElement>('[data-journey-answer="1"]')!.disabled).toBe(true);
    vi.advanceTimersByTime(1500);expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);answer(1);expect(root.querySelector('.journey-summary')!.textContent).toContain('0.75');
  });
  it('위치 계산과 방향 예상 전에는 선을 바꾸지 않고 반대 방향도 확인한다',()=>{
    enterMovement();expect(root.dataset.scene).toBe('6');expect(root.textContent).toContain('현재 선: 가로 − 세로 = 0.50');
    click('[data-journey-threshold="0.25"]');expect(root.textContent).toContain('현재 선: 가로 − 세로 = 0.50');
    answer(0);expect(root.querySelector('[data-journey-run]')).toBeNull();answer(1);answer(1);expect(root.querySelector('[data-journey-run]')).toBeNull();
    answer(0);click('[data-journey-run]');vi.advanceTimersByTime(800);expect(root.textContent).not.toContain('현재 선: 가로 − 세로 = 0.50');expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);
    vi.advanceTimersByTime(1200);expect(root.textContent).toContain('현재 선: 가로 − 세로 = 0.25');expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);
    move(.5,2,1);expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(false);
  });
  it('화면 이탈은 중간 파라미터를 되돌리고 애니메이션을 종료한다',()=>{
    enterMovement();answer(1);answer(0);click('[data-journey-run]');vi.advanceTimersByTime(600);lesson.show(false);vi.advanceTimersByTime(3000);lesson.show(true);
    expect(root.textContent).toContain('현재 선: 가로 − 세로 = 0.50');expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);
  });
  it('계산부터 두 출력까지 마친 뒤에만 실제 연습으로 간다',()=>{
    enterMovement();move(.25,1,0);move(.5,2,1);advance();play();answer(1);advance();
    expect(root.textContent).toContain('5 / 7장');answer(1);vi.advanceTimersByTime(2000);expect(root.textContent).toContain('7 / 7장');advance();answer(0);
    click('[data-journey-step="0"]');expect(root.dataset.scene).toBe('0');click('[data-journey-step="3"]');expect(root.dataset.scene).toBe('7');advance();advance();advance();expect(next).toHaveBeenCalledOnce();
    lesson.reset();lesson.render();expect(root.querySelector<HTMLButtonElement>('[data-journey-step="3"]')!.disabled).toBe(true);
  });
  it('같은 네 장면 묶음을 모든 안내 문제에 적용한다',()=>{
    for(const context of ['숫자','OMR','웹캠','승부차기']){lesson.stop();lesson=new UnderstandingJourney(root,{context:()=>context,complete:next});expect([...root.querySelectorAll('.journey-nav button')].map(b=>b.textContent)).toEqual(['1 특징 계산','2 분포·선택','3 뉴런·선','4 뉴런·출력']);expect(root.querySelector('.journey-context p')!.textContent).toContain(context);}
  });
  it('움직임 줄이기 설정에서도 계산을 생략하거나 답을 대신 선택하지 않는다',()=>{
    vi.stubGlobal('matchMedia',()=>({matches:true}));ink();answer(2);advance();click('[data-journey-play]');expect(root.querySelector<HTMLButtonElement>('[data-journey-next]')!.disabled).toBe(true);expect(root.querySelector<HTMLButtonElement>('[data-journey-answer="1"]')!.disabled).toBe(false);vi.unstubAllGlobals();
  });
});
