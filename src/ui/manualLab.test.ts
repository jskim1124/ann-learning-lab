import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest';
import { ManualLabWorkspace } from './manualLab';

describe('직접 고치는 연습 화면',()=>{
  let workspace:ManualLabWorkspace;
  beforeEach(()=>{
    document.body.innerHTML='';
    const ctx=new Proxy({measureText:()=>({width:40})},{get:(t,k)=>k in t?t[k as keyof typeof t]:vi.fn(),set:(t,k,v)=>{Reflect.set(t,k,v);return true;}});
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
    workspace=new ManualLabWorkspace(()=>({data:[{pixels:[-.5,0],label:0},{pixels:[.5,0],label:1}],classes:['A','B'],axes:['가로','세로'],note:'원본 유지'}));workspace.open();
  });
  afterEach(()=>vi.restoreAllMocks());
  const click=(s:string)=>document.querySelector<HTMLButtonElement>(s)!.click();
  it('슬라이더를 계속 움직여도 DOM과 초점을 유지하고 실제 경계 모델을 고친다',()=>{
    const slider=document.querySelector<HTMLInputElement>('[data-parameter="bias"]')!;slider.focus();slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));
    expect(document.querySelector('[data-parameter="bias"]')).toBe(slider);expect(document.activeElement).toBe(slider);
    expect(workspace.lab.model.hiddenBias[0]).toBe(0);expect(document.getElementById('manualScore')!.textContent).toContain('6 / 6');
    slider.value='.25';slider.dispatchEvent(new Event('input',{bubbles:true}));expect(workspace.lab.model.hiddenBias[0]).toBe(.25);
    click('[data-manual="undo"]');expect(workspace.lab.model.hiddenBias[0]).toBe(0);
  });
  it('두 번째 뉴런을 연결하고 잠깐 끄며 최종 경계를 비교한다',()=>{
    click('[data-mission="bend"]');click('[data-manual="add"]');
    expect(workspace.lab.model.hiddenUnits).toBe(2);expect(workspace.lab.score).toBe(4);
    const connection=document.querySelector<HTMLInputElement>('[data-parameter="connection"]')!;connection.value='1';connection.dispatchEvent(new Event('input',{bubbles:true}));
    expect(workspace.lab.score).toBe(6);const checkbox=document.getElementById('manualMute') as HTMLInputElement;checkbox.checked=true;checkbox.dispatchEvent(new Event('change',{bubbles:true}));expect(workspace.lab.score).toBe(4);
  });
  it('오답은 모델을 고치지 않으며 계산 정답을 반복 눌러 점수를 올릴 수 없다',()=>{
    click('[data-tab="quiz"]');const wrong=document.querySelector<HTMLButtonElement>('[data-answer="0.5"]')!;wrong.click();expect(document.getElementById('manualFeedback')!.className).toBe('wrong');
    click('[data-answer="0"]');expect(workspace.lab.calculations).toBe(1);click('[data-answer="0"]');expect(workspace.lab.calculations).toBe(1);
    click('[data-tab="line"]');click('[data-manual="predict"]');const old=JSON.stringify(workspace.lab.model);click('[data-guess="down"]');expect(JSON.stringify(workspace.lab.model)).toBe(old);expect(document.getElementById('manualFeedback')!.className).toBe('wrong');
    click('[data-guess="up"]');expect(workspace.lab.model.hiddenBias[0]).toBe(-.25);expect(document.getElementById('manualFeedback')!.className).toBe('correct');
  });
  it('자료 과제를 바꾸어도 저장한 실험은 남고 닫아도 원래 화면을 이동하지 않는다',()=>{
    const initial=workspace.lab;click('[data-mission="data"]');expect(workspace.lab.source.note).toBe('원본 유지');click('[data-mission="move"]');expect(workspace.lab).toBe(initial);
    click('[data-manual="close"]');expect(workspace.dialog.open).toBe(false);workspace.open();expect(workspace.lab).toBe(initial);
  });
  it('두 뉴런의 출력 합도 계산하고 클래스 색을 지도와 맞춘다',()=>{
    click('[data-mission="bend"]');click('[data-manual="add"]');
    const connection=document.querySelector<HTMLInputElement>('[data-parameter="connection"]')!;connection.value='1';connection.dispatchEvent(new Event('input',{bubbles:true}));
    click('[data-tab="quiz"]');click('[data-quiz-kind="output"]');click('[data-answer="0.5"]');
    expect(workspace.lab.calculations).toBe(1);expect(document.getElementById('manualFeedback')!.textContent).toContain('가장 큰 점수');
    const a=document.querySelector<HTMLElement>('#manualNetwork [data-network-output="0"]')!;
    expect(a.style.getPropertyValue('--class-color')).toBe('#f17605');
  });
});
