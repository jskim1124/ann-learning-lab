import { afterEach, describe, expect, it } from 'vitest';
import { createNumericDatasetRecorder } from './numericDataset';
import { createCustomExample } from '../data/customDataset';
import { observeResearch } from './bus';
import type { Payload } from './schema';

let stop=()=>{};afterEach(()=>stop());
describe('original numeric dataset observations',()=>{
  it('retains numeric rows/imports, changed values and deletions, not private names',()=>{
    const record=createNumericDatasetRecorder(),store={},draft=createCustomExample();
    draft.rows[0]!.name='PRIVATE_NAME';draft.features[0]='PRIVATE_COLUMN';draft.rows[0]!.values[0]=2.123456789;
    const events:{action:string,payload:Payload}[]=[];stop=observeResearch((action,payload)=>events.push({action,payload}));
    record(store,draft);expect(events.filter(e=>e.action==='data_value')).toHaveLength(8);expect(events[0]!.payload.values).toEqual([2.123456789,7,3]);
    const count=events.length;record(store,draft);expect(events).toHaveLength(count);
    draft.rows[0]!.values[0]=9.87654321;record(store,draft);expect(events.at(-1)!.payload).toMatchObject({operation:'update',sampleId:1,values:[9.87654321,7,3]});
    draft.rows.shift();record(store,draft);expect(events.at(-1)!.payload).toEqual({operation:'remove',sampleId:1});
    expect(JSON.stringify(events)).not.toContain('PRIVATE');
  });
  it('does not collect before consent and re-baselines when the participant changes',()=>{
    const record=createNumericDatasetRecorder(),draft=createCustomExample(),events:Payload[]=[];record({},draft);
    stop=observeResearch((a,p)=>{if(a==='data_value')events.push(p);});record({},draft);expect(events).toHaveLength(8);stop();
    stop=observeResearch((a,p)=>{if(a==='data_value')events.push(p);});record({},draft);expect(events).toHaveLength(16);expect(events.every(p=>p.operation==='snapshot')).toBe(true);
  });
});
