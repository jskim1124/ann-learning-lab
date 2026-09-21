import {describe,it,expect} from 'vitest';
import {fitSurfaceCanvas} from './canvasUtils';

describe('responsive graph bitmap',()=>{
  it('matches the displayed size instead of stretching a square bitmap',()=>{
    const canvas=document.createElement('canvas');canvas.width=700;canvas.height=700;
    canvas.getBoundingClientRect=()=>({width:650,height:240} as DOMRect);
    fitSurfaceCanvas(canvas);
    expect([canvas.width,canvas.height]).toEqual([650,240]);
    fitSurfaceCanvas(canvas);expect([canvas.width,canvas.height]).toEqual([650,240]);
  });
  it('does not reset a hidden graph to an empty bitmap',()=>{
    const canvas=document.createElement('canvas');canvas.width=650;canvas.height=240;
    fitSurfaceCanvas(canvas);expect([canvas.width,canvas.height]).toEqual([650,240]);
  });
});
