import { afterEach,describe,it,expect,vi } from 'vitest';
import { ResearchCollector } from './collector';
import { MemoryOutbox } from './outbox';
import { recordResearch } from './bus';
import { MAX_EVENT_BATCH, type RawEvent } from './schema';
let collector:ResearchCollector|undefined;
afterEach(()=>{collector?.pause();vi.useRealTimers();});
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
describe('consent gated durable outbox',()=>{
  it('records no events before activation, orders sequences and only deletes acknowledged IDs',async()=>{
    const outbox=new MemoryOutbox(),send=vi.fn(async(_route:string,body:any)=>({accepted:[body.events[0].eventId]}));collector=new ResearchCollector(send,()=>{},outbox);
    recordResearch('parameter_change',{value:1});expect(outbox.rows.size).toBe(0);
    await collector.enable('study:p_a');await settle();recordResearch('parameter_change',{value:1});recordResearch('parameter_change',{value:2});await settle();await collector.flush();await settle();
    const last=send.mock.calls.at(-1)![1].events as RawEvent[];expect(last.map(e=>e.sequence)).toEqual([...last.map(e=>e.sequence)].sort((a,b)=>a-b));expect(outbox.rows.size).toBeGreaterThanOrEqual(1);
    collector.pause();const count=outbox.rows.size;recordResearch('parameter_change',{value:3});await settle();expect(outbox.rows.size).toBe(count);
  });
  it('persists failed batches and never sends another participant queue',async()=>{
    const outbox=new MemoryOutbox(),send=vi.fn().mockRejectedValue(new Error('offline'));collector=new ResearchCollector(send,()=>{},outbox);await collector.enable('study:p_a');await settle();recordResearch('config_change',{value:1});await settle();await collector.flush();expect((await outbox.all('study:p_a')).length).toBeGreaterThan(0);
    collector.pause();await collector.enable('study:p_b');await settle();send.mockResolvedValue({accepted:[]});window.dispatchEvent(new Event('online'));await settle();const batch=send.mock.calls.at(-1)![1].events as RawEvent[];expect(batch.every(e=>e.action==='session_start')).toBe(true);
    expect((await outbox.all('study:p_a')).length).toBeGreaterThan(0);
  });
  it('rejects survey success if durable storage fails',async()=>{
    collector=new ResearchCollector(async()=>({accepted:[]}),()=>{}, {all:async()=>[],put:async()=>{throw new Error('quota');},remove:async()=>{}});
    await collector.enable('study:p_a');await settle();await expect(collector.survey({submissionId:crypto.randomUUID(),version:'draft-v1',answers:{demo1:2}})).rejects.toThrow();
  });
  it('drains a burst of raw actions in acknowledged batches without waiting five seconds each',async()=>{
    vi.useFakeTimers();const outbox=new MemoryOutbox(),send=vi.fn(async(_route:string,body:any)=>({accepted:body.events.map((e:RawEvent)=>e.eventId)}));
    collector=new ResearchCollector(send,()=>{},outbox);await collector.enable('study:p_a');await settle();
    for(let i=0;i<450;i++)recordResearch('ui_input',{elementId:'weight',value:i});
    for(let i=0;i<2200;i++)await Promise.resolve();await collector.flush();
    expect(outbox.rows.size).toBeGreaterThan(0);await vi.advanceTimersByTimeAsync(10000);expect(outbox.rows.size).toBe(0);
    expect(send.mock.calls.every(call=>call[1].events.length<=MAX_EVENT_BATCH)).toBe(true);
    expect(send.mock.calls.flatMap(call=>call[1].events).filter((e:RawEvent)=>e.action==='ui_input').map((e:RawEvent)=>e.payload.value)).toEqual(Array.from({length:450},(_,i)=>i));
  });
  it('creates no interval/heartbeat rows or empty requests while the app is idle',async()=>{
    vi.useFakeTimers();const outbox=new MemoryOutbox(),send=vi.fn(async(_route:string,body:any)=>({accepted:body.events.map((e:RawEvent)=>e.eventId)}));
    collector=new ResearchCollector(send,()=>{},outbox);await collector.enable('study:p_a');await settle();
    await vi.advanceTimersByTimeAsync(120000);
    expect(send.mock.calls).toHaveLength(1);expect(send.mock.calls[0]![1].events.map((e:RawEvent)=>e.action)).toEqual(['session_start']);expect(outbox.rows.size).toBe(0);
  });
  it('keeps unacknowledged events AND survey after logout, then resumes only for the same participant',async()=>{
    const outbox=new MemoryOutbox(),send=vi.fn().mockRejectedValue(new Error('offline'));collector=new ResearchCollector(send,()=>{},outbox);
    await collector.enable('study:p_a');await settle();recordResearch('parameter_change',{value:.123456});
    const submission={submissionId:crypto.randomUUID(),version:'draft-v1',answers:{demo1:4}};await collector.survey(submission);await collector.logout();
    const old=await outbox.all('study:p_a');expect(old.some(r=>r.kind==='survey')).toBe(true);expect(old.some(r=>(r.body as RawEvent).action==='session_end')).toBe(true);
    send.mockImplementation(async(_route:string,body:any)=>({accepted:body.events?body.events.map((e:RawEvent)=>e.eventId):[body.submissionId]}));
    await collector.enable('study:p_b');await settle();await collector.flush();expect(await outbox.all('study:p_a')).toHaveLength(old.length);
    await collector.enable('study:p_a');await settle();await collector.flush();await collector.flush();expect(await outbox.all('study:p_a')).toHaveLength(0);
  });
  it('waits for an in-flight acknowledgement before logout returns',async()=>{
    const outbox=new MemoryOutbox();let complete:(result:any)=>void=()=>{};
    collector=new ResearchCollector((_route,body:any)=>new Promise(resolve=>{complete=()=>resolve({accepted:body.events.map((e:RawEvent)=>e.eventId)});}),()=>{},outbox);
    await collector.enable('study:p_a');await settle();let done=false;const exiting=collector.logout().then(()=>done=true);await settle();expect(done).toBe(false);complete({});await exiting;expect(done).toBe(true);
    // Logout may create a last row after the in-flight batch: it remains durable, not discarded.
    expect((await outbox.all('study:p_a')).every(r=>(r.body as RawEvent).action==='session_end')).toBe(true);
  });
});
