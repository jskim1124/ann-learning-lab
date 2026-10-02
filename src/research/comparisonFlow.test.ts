import {describe,it,expect} from 'vitest';
import {ImageLabStore} from '../state/imageLabStore';
import {projectionFromFeatures} from '../core/pixelProjection';
import {forwardPixels} from '../core/pixelNetwork';
import {comparisonRows} from './comparisonFlow';
describe('Teachable live read-only projection',()=>{
  it('keeps positions fixed while displaying exact full-image hidden values and predictions',()=>{
    const store=new ImageLabStore('digits');store.setMode('pixels');store.setHiddenUnits(16);
    const state=store.snapshot,p=projectionFromFeatures(state.data,state.features.find(f=>f.id==='auto1')!.weights,state.features.find(f=>f.id==='auto2')!.weights);
    const before=comparisonRows(state,p);store.train(10);const after=comparisonRows(store.snapshot,p);
    after.forEach((row,i)=>{expect([row.x,row.y]).toEqual([before[i]!.x,before[i]!.y]);const actual=forwardPixels(store.snapshot.model,store.snapshot.data[i]!.pixels);expect(row.hidden).toEqual(actual.hidden);expect(row.probabilities).toEqual(actual.probabilities);});
    expect(after.some((r,i)=>r.hidden.some((h,j)=>h!==before[i]!.hidden[j]))).toBe(true);
  });
  it('never replaces the full 196 inputs with the displayed two coordinates',()=>{
    const store=new ImageLabStore('omr'),s=store.snapshot;
    const p=projectionFromFeatures(s.data,s.features.find(f=>f.id==='auto1')!.weights,s.features.find(f=>f.id==='auto2')!.weights),copy=JSON.stringify(s.model);
    comparisonRows(s,p);expect(JSON.stringify(s.model)).toBe(copy);expect(s.model.inputSize).toBe(196);
  });
});
