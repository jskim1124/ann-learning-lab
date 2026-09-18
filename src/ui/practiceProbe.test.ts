import {describe,it,expect,vi} from 'vitest';
import {bindPracticeProbe} from './practiceProbe';
describe('학습 지도 확인점',()=>{
  it('드래그와 방향키는 자료를 옮기지 않고 확인 좌표만 바꾸며 기존 점에 붙는다',()=>{
    const canvas=document.createElement('canvas'),points=[{x:-.5,y:.5}],copy=JSON.stringify(points),selected=vi.fn();
    vi.spyOn(canvas,'getBoundingClientRect').mockReturnValue({left:10,top:20,width:200,height:200} as DOMRect);
    bindPracticeProbe(canvas,()=>points,()=>({x:0,y:0}),selected);
    canvas.dispatchEvent(new MouseEvent('pointerdown',{clientX:60,clientY:70}));expect(selected).toHaveBeenLastCalledWith(0,-.5,.5);
    canvas.dispatchEvent(new MouseEvent('pointermove',{clientX:160,clientY:170}));expect(selected).toHaveBeenLastCalledWith(null,.5,-.5);
    canvas.dispatchEvent(new Event('pointerup'));
    canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));expect(selected).toHaveBeenLastCalledWith(null,.05,0);
    expect(JSON.stringify(points)).toBe(copy);
  });
});
