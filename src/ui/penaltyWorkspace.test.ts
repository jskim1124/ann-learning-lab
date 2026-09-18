import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {PenaltyCollection} from './penaltyCollection';
import {PenaltyLesson} from './penaltyLesson';
import {LabStore} from '../state/labStore';
import {drawPixelLatentMap} from '../visualization/pixelLatentMap';
vi.mock('../visualization/pixelLatentMap',()=>({drawPixelLatentMap:vi.fn()}));
vi.mock('../visualization/graphCallout',()=>({drawGraphCallout:vi.fn()}));
const click=(s:string)=>document.querySelector<HTMLButtonElement>(s)!.click();
describe('승부차기 공통 수집·이해 UI',()=>{
  beforeEach(()=>{document.body.innerHTML=readFileSync('index.html','utf8');localStorage.clear();});
  afterEach(()=>vi.useRealTimers());
  it('역할별 사진 선택을 저장하고 결과 지도 클릭은 데이터를 추가하지 않는다',()=>{
    const store=new LabStore();store.setPreset('xor');const c=new PenaltyCollection(store,vi.fn());c.show(true);store.subscribe(()=>c.render());
    const size=store.snapshot.data.length;const photo=document.getElementById('penaltyPhoto')!;
    vi.spyOn(photo,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1000,height:1000} as DOMRect);
    photo.dispatchEvent(new MouseEvent('click',{clientX:280,clientY:440}));
    expect(document.querySelector('[data-penalty-role=keeper]')!.getAttribute('aria-pressed')).toBe('true');
    expect((document.getElementById('penaltyAdd') as HTMLButtonElement).disabled).toBe(true);
    photo.dispatchEvent(new MouseEvent('click',{clientX:720,clientY:440}));click('#penaltyAdd');
    expect(store.snapshot.data).toHaveLength(size+1);expect(store.snapshot.data.at(-1)).toMatchObject({x:-.5,y:.5,label:1});
    click('#penaltyMap');expect(store.snapshot.data).toHaveLength(size+1);
    click('#penaltyClear');click('[data-penalty-role=keeper]');click('[data-penalty-side=left]');click('[data-penalty-role=kicker]');click('[data-penalty-side=left]');click('#penaltyAdd');
    expect(store.snapshot.data.at(-1)!.label).toBe(0);
  });
  it('계산과 예측을 풀어야 진행하며 재생만 눌러서는 연습으로 갈 수 없다',()=>{
    vi.useFakeTimers();const next=vi.fn(),lesson=new PenaltyLesson(next);lesson.show(true);
    click('[data-pl-step="3"]');click('#plPlay');vi.runAllTimers();expect(document.getElementById('plCalculation')!.textContent).toContain('1 − 2 − 0 = -1');
    click('[data-pl-predict="1"]');expect(document.querySelector('#plPredict .correct')).toBeNull();
    click('[data-pl-predict="0"]');click('#plPlay');vi.runAllTimers();click('[data-pl-choice="1"]');click('#plNext');expect(next).not.toHaveBeenCalled();
    for(const [step,answer] of [[0,1],[1,2],[2,0]]){click(`[data-pl-step="${step}"]`);click('#plPlay');vi.runAllTimers();
      click(`[data-pl-choice="${(answer!+1)%3}"]`);expect(document.querySelector('#plChoices .correct')).toBeNull();
      click(`[data-pl-choice="${answer}"]`);
    }
    click('[data-pl-step="3"]');click('#plNext');expect(next).toHaveBeenCalledOnce();lesson.stop();
  });
  it('실제 방향키로 고르고 클래스를 명시적으로 바꿔 저장할 수 있다',()=>{
    const store=new LabStore();store.setPreset('xor');const c=new PenaltyCollection(store,vi.fn());c.show(true);
    const photo=document.getElementById('penaltyPhoto')!;
    photo.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
    photo.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    expect(document.getElementById('penaltyCoordinates')!.textContent).toContain('왼쪽 -0.5');
    expect(document.getElementById('penaltyCoordinates')!.textContent).not.toContain('× 2');
    const select=document.getElementById('penaltyClass') as HTMLSelectElement;select.value='0';select.dispatchEvent(new Event('change'));
    expect(document.getElementById('penaltyClassNote')!.textContent).toContain('규칙과 다른 이름표');
    click('#penaltyAdd');expect(store.snapshot.data.at(-1)).toMatchObject({x:-.5,y:.5,label:0});
  });
  it('학습에서는 대표 뉴런 선만 표시하고 배경·최종 경계와 함께 비교한다',()=>{
    const lesson=new PenaltyLesson(vi.fn());lesson.show(true);click('[data-pl-step="3"]');click('[data-pl-predict="0"]');click('#plAdvance');click('#plAdvance');
    const options=vi.mocked(drawPixelLatentMap).mock.calls.at(-1)![5];expect(options).toMatchObject({onlyNeuron:0,showDecisionBoundary:true});expect(options?.previousNeuronModel).toBeTruthy();lesson.stop();
  });
});
