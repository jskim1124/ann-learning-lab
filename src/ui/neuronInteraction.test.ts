import { describe,it,expect } from 'vitest';
import { ManualLab } from '../core/manualLab';
import { neuronPointAt,scoreEvidence,lineDirection } from './neuronInteraction';
import { withParameter } from '../core/explorationLearning';
import { explorationOutputNetwork } from './explorationNetwork';
const model=()=>new ManualLab('data',{data:[{pixels:[.5,.5],label:0},{pixels:[-.5,-.5],label:1}],classes:['A','B'],axes:['x','y'],note:'test'}).model;
describe('direct line interaction and honest score feedback',()=>{
 it('clicking near a line snaps to a true zero, at laptop and tablet sizes',()=>{
  for(const [width,height] of [[700,350],[350,220],[900,510]]){
   const m=withParameter(model(),0,'bias',-.25),w=width!-64,h=height!-64;
   const p=neuronPointAt(m,0,50+1.25/2*w+2,13+.7/2*h,width!,height!)!;
   expect(p[0]).toBeCloseTo(.25,12);expect(p[1]).toBeCloseTo(.3,12);
   expect(neuronPointAt(m,0,10,10,width!,height!)).toBeNull();
  }
 });
 it('ordinary plane clicks retain their own coordinates and degenerate neurons do not invent a line',()=>{
   const m=withParameter(model(),0,'xWeight',0);expect(neuronPointAt(m,0,368,156,700,350)).toEqual([0,0]);
   const p=neuronPointAt(model(),0,622.4,70.2,700,350)!;expect(p[0]).toBeCloseTo(.8);expect(p[1]).toBeCloseTo(.6);
 });
 it('scores and improvement are from actual logits and cross entropy, not distance',()=>{
   const m=model(),a=withParameter(m,0,'bias',-.2),b=withParameter(m,0,'bias',.2);
   expect(scoreEvidence(m,a,[.5,.5],0).result).toBe('better');expect(scoreEvidence(m,b,[.5,.5],0).result).toBe('worse');
   const e=scoreEvidence(m,a,[.5,.5],0);expect(e.gap).toBeCloseTo(e.to.logits[0]!-e.to.logits[1]!);
   const move=lineDirection(m,[.5,.5],0,0,'bias')!;expect(move.end[0]).toBeGreaterThan(move.start[0]!);
   expect(lineDirection(m,[-.5,-.5],0,0,'bias')).toBeNull();
 });
 it('one neuron has a separate, mathematically correct connection for every class',()=>{
   const m=model();m.classCount=3;m.hiddenOutput=[[0],[.5],[-1]];m.outputBias=[0,.2,.3];
   const div=document.createElement('div');div.innerHTML=explorationOutputNetwork(m,[.8,.2],0,1,['A','B','C']);
   expect(div.querySelectorAll('[data-output-class]')).toHaveLength(3);
   expect(div.querySelector('[data-output-class="1"]')!.textContent).toContain('× (0.50) = 0.40');
   expect(div.querySelector('[data-output-class="2"]')!.textContent).toContain('점수 -0.50');
   expect(div.querySelectorAll('.parameter-active')).toHaveLength(1);
 });
});
