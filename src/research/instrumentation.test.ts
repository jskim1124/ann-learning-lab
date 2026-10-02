import { afterEach,describe,it,expect } from 'vitest';
import { ImageLabStore } from '../state/imageLabStore';
import { observeResearch,researchContext } from './bus';
import { instrumentImageStore } from './instrumentation';
import { trainPixelModel,initializePixelModel,evaluatePixelModel } from '../core/pixelNetwork';
import { createPixelDataset } from '../data/pixelDatasets';
import type { Payload,EventContext } from './schema';
let stop=()=>{};afterEach(()=>stop());
describe('shared semantic collection and comparison model',()=>{
  it('logs actual accepted state, excludes raw data and captures version/condition',()=>{
    const store=new ImageLabStore('digits');instrumentImageStore(store,'comparison');researchContext({condition:'comparison',page:'comparison'});
    const events:Array<{action:string,payload:Payload,context:EventContext}>=[];stop=observeResearch((action,payload,context)=>events.push({action,payload,context}));
    store.setMode('pixels');store.setHiddenUnits(16);store.setInput(Array(196).fill(.7),'data:image/jpeg;base64,PRIVATE');store.selectClass(1);store.addInput();store.train(2);store.selectSample(store.snapshot.data[0]!.id);
    const added=events.find(e=>e.action==='dataset_change')!;expect(added.payload).toMatchObject({operation:'addInput',label:1,count:73});expect(added.context.condition).toBe('comparison');
    const trained=events.find(e=>e.action==='training_batch')!;expect(trained.context.modelVersion).toBeGreaterThan(added.context.modelVersion);expect(trained.payload.epoch).toBe(2);expect(trained.payload.accuracy).toBe(store.metrics().accuracy);
    expect(JSON.stringify(events)).not.toContain('PRIVATE');expect(events.every(e=>!Object.hasOwn(e.payload,'pixels')&&!Object.hasOwn(e.payload,'image'))).toBe(true);
  });
  it('records rejection without a successful training batch for empty classes',()=>{
    const store=new ImageLabStore('custom');instrumentImageStore(store);const actions:string[]=[];stop=observeResearch(a=>actions.push(a));store.train(10);expect(actions).toEqual(['action_rejected']);
  });
  it('keeps each changed image prediction before and after training without time sampling',()=>{
    const store=new ImageLabStore('digits');instrumentImageStore(store);const values:Payload[]=[];stop=observeResearch((a,p)=>{if(a==='prediction')values.push(p);});
    for(let i=1;i<=20;i++)store.setInput(Array(196).fill(i/100));
    store.setInput(Array(196).fill(.2)); // Unchanged input is not a numerical change.
    expect(values).toHaveLength(20);expect(values[0]!.trained).toBe(false);expect(values.every(p=>Array.isArray(p.probabilities)&&Array.isArray(p.hidden))).toBe(true);
    store.train(1);store.setInput(Array(196).fill(.21));expect(values).toHaveLength(21);expect(values[20]!.trained).toBe(true);
  });
  it('records the learner-created feature calculation mask, not its private name or source image',()=>{
    const store=new ImageLabStore('digits');instrumentImageStore(store);const values:Payload[]=[];stop=observeResearch((a,p)=>{if(a==='feature_edit')values.push(p);});
    const mask=Array.from({length:196},(_,i)=>i%3-1);store.addFeature('PRIVATE_FEATURE_NAME',mask);
    expect(values).toHaveLength(14);expect(values.flatMap(p=>p.values as number[])).toEqual(mask);expect(values.map(p=>p.rowIndex)).toEqual(Array.from({length:14},(_,i)=>i));expect(JSON.stringify(values)).not.toContain('PRIVATE_FEATURE_NAME');
  });
  it.each(['digits','omr'] as const)('comparison %s performs on held-out synthetic examples, not just training rows',task=>{
    const data=createPixelDataset(task),training=data.filter((_,i)=>i%4!==0),held=data.filter((_,i)=>i%4===0),count=Math.max(...data.map(r=>r.label))+1;
    const model=trainPixelModel(initializePixelModel(196,16,count,31),training,300,.12);
    expect(evaluatePixelModel(model,training).accuracy).toBeGreaterThan(.9);
    expect(evaluatePixelModel(model,held).accuracy).toBeGreaterThan(.85);
  },30000);
});
