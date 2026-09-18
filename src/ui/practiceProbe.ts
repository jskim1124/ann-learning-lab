/** Move only an inspection coordinate. This never changes the data behind the graph. */
export function bindPracticeProbe(canvas:HTMLCanvasElement,points:()=>readonly {x:number;y:number}[],current:()=>{x:number;y:number},select:(index:number|null,x:number,y:number)=>void):void {
  let dragging=false;
  const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
  const move=(event:PointerEvent)=>{
    if(!dragging)return;
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    let nearest:number|null=null,distance=12**2;
    points().forEach((p,i)=>{const d=((p.x+1)/2*r.width-event.clientX+r.left)**2+((1-p.y)/2*r.height-event.clientY+r.top)**2;if(d<distance){distance=d;nearest=i;}});
    const p=nearest===null?{x:clamp((event.clientX-r.left)/r.width*2-1),y:clamp(1-(event.clientY-r.top)/r.height*2)}:points()[nearest]!;
    select(nearest,p.x,p.y);
  };
  canvas.tabIndex=0;canvas.style.touchAction='none';
  canvas.addEventListener('pointerdown',event=>{dragging=true;canvas.setPointerCapture?.(event.pointerId);move(event);});
  canvas.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>dragging=false);
  canvas.addEventListener('keydown',event=>{const delta:Record<string,[number,number]>={ArrowLeft:[-.05,0],ArrowRight:[.05,0],ArrowUp:[0,.05],ArrowDown:[0,-.05]};const d=delta[event.key];if(!d)return;event.preventDefault();const p=current();select(null,clamp(p.x+d[0]),clamp(p.y+d[1]));});
}
