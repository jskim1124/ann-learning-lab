import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { instrumentInteractions } from './interactions';
import { observeResearch,researchContext } from './bus';
import type { Payload } from './schema';
let stop:()=>void,unobserve:()=>void;let logs:{action:string;payload:Payload;page:string}[];
const pointer=(type:string,x:number,y:number)=>{const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y});Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'mouse'}});return e;};
beforeEach(()=>{document.body.innerHTML='<section data-app-page="3"><button id="next">Next</button><input id="weight" type="range" min="-2" max="2" step=".1" value=".5"><canvas id="imageDraw"></canvas><canvas id="modelCanvas"></canvas><input id="studentText" value="private student name"><div class="research-dialog"><input type="password" value="secret"></div></section>';logs=[];researchContext({page:'3'});stop=instrumentInteractions();unobserve=observeResearch((action,payload,context)=>logs.push({action,payload,page:context.page}));});
afterEach(()=>{stop();unobserve();vi.restoreAllMocks();});
describe('raw UI traces',()=>{
  it('captures the source page and structural element, not a learning judgement',()=>{document.querySelector('button')!.addEventListener('click',()=>researchContext({page:'4'}));document.querySelector('button')!.click();expect(logs).toEqual([{action:'ui_click',page:'3',payload:{traceVersion:'ui-v1',elementId:'next',control:'button'}}]);});
  it('links slider start, input values and end and preserves before/after numbers',()=>{const el=document.querySelector<HTMLInputElement>('#weight')!;el.dispatchEvent(pointer('pointerdown',10,10));el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(pointer('pointerup',30,10));expect(logs.map(l=>l.action)).toEqual(['ui_pointer_start','ui_input','ui_pointer_end']);expect(logs[1]!.payload).toMatchObject({previous:.5,value:1});expect(new Set(logs.map(l=>l.payload.gestureId)).size).toBe(1);});
  it('omits drawing coordinates and all text/password contents',()=>{const c=document.querySelector('#imageDraw')!;c.dispatchEvent(pointer('pointerdown',21,42));c.dispatchEvent(pointer('pointerup',30,90));document.querySelector('#studentText')!.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[type=password]')!.dispatchEvent(new Event('input',{bubbles:true}));expect(logs).toHaveLength(3);expect(logs[0]!.payload.coordinatesOmitted).toBe(true);expect(JSON.stringify(logs)).not.toMatch(/private student|secret|positionX|positionY/);});
  it('retains rapidly changed graph coordinates without a time throttle, omitting identical repeats',()=>{const el=document.querySelector('#modelCanvas')!;vi.spyOn(el,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:100,height:100} as DOMRect);vi.spyOn(performance,'now').mockReturnValue(0);el.dispatchEvent(pointer('pointerdown',10,20));el.dispatchEvent(pointer('pointermove',20,30));el.dispatchEvent(pointer('pointermove',20,30));el.dispatchEvent(pointer('pointermove',30,40));el.dispatchEvent(pointer('pointerup',40,50));expect(logs.map(l=>l.action)).toEqual(['ui_pointer_start','ui_pointer_move','ui_pointer_move','ui_pointer_end']);expect(logs[1]!.payload).toMatchObject({positionX:.2,positionY:.3,coordinateSpace:'element-fraction'});expect(logs[2]!.payload.positionX).toBe(.3);});
  it('records original numeric input values and distinguishes clearing from zero',()=>{
    const input=document.createElement('input');input.id='numberColumn';input.type='number';input.value='12.3456789';document.body.append(input);
    input.dispatchEvent(new Event('focusin',{bubbles:true}));input.value='-2.56789';input.dispatchEvent(new Event('input',{bubbles:true}));input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));
    expect(logs[0]!.payload).toMatchObject({previous:12.3456789,value:-2.56789,empty:false,valid:true});
    expect(logs[1]!.payload).toMatchObject({previous:-2.56789,empty:true,valid:false});expect(logs[1]!.payload).not.toHaveProperty('value');
  });
  it('keeps every rapid slider value including the final change event',()=>{
    const input=document.querySelector<HTMLInputElement>('#weight')!;input.dispatchEvent(new Event('focusin',{bubbles:true}));
    for(const value of ['.6','.7','.8','.9','1']){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(logs.map(l=>l.payload.value)).toEqual([.6,.7,.8,.9,1,1]);expect(logs.map(l=>l.payload.previous)).toEqual([.5,.6,.7,.8,.9,1]);
  });
  it('records nothing before consent or after logging stops',()=>{unobserve();document.querySelector('button')!.click();document.querySelector('#weight')!.dispatchEvent(pointer('pointerdown',10,10));expect(logs).toHaveLength(0);});
  it('does not attach an old account gesture to a new logging session',()=>{const el=document.querySelector('#weight')!;el.dispatchEvent(pointer('pointerdown',10,10));unobserve();logs=[];unobserve=observeResearch((action,payload,context)=>logs.push({action,payload,page:context.page}));el.dispatchEvent(pointer('pointerup',20,10));expect(logs).toHaveLength(0);});
});
