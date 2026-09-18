import { vi } from 'vitest';
/** Real pointer events through the public canvas UI, not lesson-state mutation. */
export function crossLessonLine(root:HTMLElement,ys:number[]):void {
  const map=root.querySelector<HTMLCanvasElement>('#flMap')!;
  vi.spyOn(map,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:720,height:460} as DOMRect);
  for(const y of ys){
    const emit=(type:string,x:number)=>map.dispatchEvent(new MouseEvent(type,{clientX:50+(x+1)*328,clientY:13+(1-y)*204,bubbles:true}));
    emit('pointerdown',-1);emit('pointermove',1);emit('pointerup',1);
  }
}
export const SEVEN_HEIGHTS=[-.9,-.6,-.3,0,.3,.6,.9];
