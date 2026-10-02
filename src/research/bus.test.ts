import { describe,expect,it } from 'vitest';
import { observeResearch,recordResearch } from './bus';
import type { Payload } from './schema';
describe('collection quality diagnostics',()=>{
  it('records a safe gap diagnostic instead of silently ignoring a rejected payload',()=>{
    const events:{action:string;payload:Payload}[]=[],stop=observeResearch((action,payload)=>events.push({action,payload}));
    try{recordResearch('prediction',{email:'PRIVATE_EMAIL'});expect(events).toEqual([{action:'collection_error',payload:{operation:'prediction',reason:'payload-schema'}}]);expect(JSON.stringify(events)).not.toContain('PRIVATE_EMAIL');}finally{stop();}
  });
});
