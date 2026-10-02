import {it,expect} from 'vitest';
import {ImageLabStore} from '../state/imageLabStore';
import {reconstructProjectedPixels} from '../core/pixelProjection';
import {forwardPixels} from '../core/pixelNetwork';
import {sliceModel,sliceHeatmap} from './modelSlice';
it('모든 단면 위치에서 실제 전체 신경망의 계산과 일치한다',()=>{
  const store=new ImageLabStore('digits');store.setMode('pixels');store.setHiddenUnits(4);store.train(5);const s=store.snapshot,copy=JSON.stringify(s.model),slice=sliceModel(s.model,s.projection);
  for(const [x,y]of [[0,0],[-.5,.3],[.9,-.8]]){
    const actual=forwardPixels(s.model,reconstructProjectedPixels(s.projection,x!,y!)),shown=forwardPixels(slice,[x!,y!]);
    shown.hidden.forEach((v,i)=>expect(v).toBeCloseTo(actual.hidden[i]!,9));shown.probabilities.forEach((v,i)=>expect(v).toBeCloseTo(actual.probabilities[i]!,9));
  }
  const before=sliceHeatmap(slice,0,8);store.train(10);expect(sliceHeatmap(sliceModel(store.snapshot.model,s.projection),0,8)).not.toBe(before);expect(JSON.stringify(s.model)).toBe(copy);
});
