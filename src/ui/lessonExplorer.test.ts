import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { LessonExplorer } from './lessonExplorer';
import { ImageFeatureLesson } from './imageFeatureLesson';
import { ImageLabStore } from '../state/imageLabStore';
import { stabilizeMap } from './stableMap';

vi.mock('../visualization/pixelLatentMap',async original=>({...await original<typeof import('../visualization/pixelLatentMap')>(),drawPixelLatentMap:vi.fn()}));
vi.mock('../core/imageInput',async original=>({...await original<typeof import('../core/imageInput')>(),drawImagePixels:vi.fn()}));

describe('이해 단계 안의 직접 조작',()=>{
  beforeEach(()=>{document.body.innerHTML='<div id="root"><section id="normal"><nav class="image-lesson-tabs">목차</nav></section></div>';});
  afterEach(()=>vi.restoreAllMocks());
  const click=(root:HTMLElement,s:string)=>root.querySelector<HTMLButtonElement>(s)!.click();
  const slide=(root:HTMLElement,parameter:string,value:string)=>{const input=root.querySelector<HTMLInputElement>(`[data-parameter="${parameter}"]`)!;input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
  it('설명과 조작을 오가며 모델을 보존하고, 계산·예측·수정을 해야 다음으로 간다',()=>{
    const root=document.getElementById('root')!,normal=document.getElementById('normal')!,done=vi.fn();
    const explorer=new LessonExplorer(root,[normal],normal.querySelector('nav')!,'test-',()=>explorer.show('move','다음'),done);
    explorer.show('move','다음');expect(normal.hidden).toBe(true);
    const next=root.querySelector<HTMLButtonElement>('[data-explorer-next]')!;
    expect(next.disabled).toBe(true);next.click();expect(done).not.toHaveBeenCalled();
    slide(root,'bias','0');expect(explorer.workspace.lab.score).toBe(6);expect(next.disabled).toBe(true);
    click(root,'[data-lesson-view="explain"]');expect(normal.hidden).toBe(false);
    click(root,'[data-lesson-view="explore"]');expect(explorer.workspace.lab.model.hiddenBias[0]).toBe(0);
    click(root,'[data-tab="quiz"]');click(root,'[data-answer="0.5"]');
    click(root,'[data-tab="line"]');click(root,'[data-manual="predict"]');click(root,'[data-guess="down"]');expect(next.disabled).toBe(true);
    click(root,'[data-guess="up"]');expect(next.disabled).toBe(false);next.click();expect(done).toHaveBeenCalledOnce();
    expect(root.querySelector('dialog')!.hasAttribute('open')).toBe(true);expect(root.querySelector('dialog')!.getAttribute('role')).toBe('region');
  });
  it('뉴런 추가만으로 통과하지 않으며 끄고 비교한 뒤 출력 합을 계산한다',()=>{
    const root=document.getElementById('root')!,normal=document.getElementById('normal')!;
    const explorer=new LessonExplorer(root,[normal],normal.querySelector('nav')!,'test-',()=>{},vi.fn());explorer.show('bend','다음');
    const next=root.querySelector<HTMLButtonElement>('[data-explorer-next]')!;
    click(root,'[data-manual="add"]');slide(root,'connection','1');expect(next.disabled).toBe(true);
    const mute=root.querySelector<HTMLInputElement>('#test-manualMute')!;
    mute.checked=true;mute.dispatchEvent(new Event('change',{bubbles:true}));expect(explorer.workspace.lab.score).toBe(4);
    mute.checked=false;mute.dispatchEvent(new Event('change',{bubbles:true}));
    click(root,'[data-tab="quiz"]');click(root,'[data-quiz-kind="output"]');click(root,'[data-answer="0.5"]');expect(next.disabled).toBe(false);
    explorer.show('bend','다음',false);expect(next.disabled).toBe(true);
    explorer.show('bend','다음',true);click(root,'[data-manual="reset"]');expect(next.disabled).toBe(true);expect(explorer.workspace.lab.compared).toBe(false);
  });
  it.each(['digits','omr','webcam'] as const)('%s는 같은 이해 목차에서 직접 조작하고 앞 단계로 돌아갈 수 있다',task=>{
    const root=document.getElementById('root')!,store=new ImageLabStore(task);
    if(task==='webcam'){store.setInput(Array(196).fill(.5));store.addInput();}
    const initial=JSON.stringify(store.snapshot),next=vi.fn(),lesson=new ImageFeatureLesson(root,store,next,vi.fn());lesson.render();
    click(root,'[data-fl-step="3"]');expect(root.classList.contains('is-exploring')).toBe(true);
    expect(root.querySelector('#fl-manualMap')).not.toBeNull();expect(root.querySelectorAll('.lesson-explorer-bar [data-fl-step]')).toHaveLength(4);
    slide(root,'bias','0');click(root,'[data-fl-step="1"]');expect(root.classList.contains('is-exploring')).toBe(false);
    click(root,'[data-fl-step="3"]');expect(root.querySelector<HTMLInputElement>('[data-parameter="bias"]')!.value).toBe('0');
    click(root,'[data-fl-step="4"]');expect(root.querySelector<HTMLButtonElement>('[data-explorer-next]')!.disabled).toBe(true);
    expect(JSON.stringify(store.snapshot)).toBe(initial);expect(next).not.toHaveBeenCalled();
    const ids=[...root.querySelectorAll('[id]')].map(el=>el.id);expect(new Set(ids).size).toBe(ids.length);lesson.stop();
  });
  it('캔버스 해상도를 바꾸어도 고정된 외부 틀을 재생성하지 않는다',()=>{
    const canvas=document.createElement('canvas');document.body.append(canvas);
    const slot=stabilizeMap(canvas);canvas.width=1400;canvas.height=920;
    expect(stabilizeMap(canvas)).toBe(slot);expect(slot.parentElement).toBe(document.body);expect(slot.children).toHaveLength(1);
  });
});
