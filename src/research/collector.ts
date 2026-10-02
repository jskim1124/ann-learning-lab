import { observeResearch, recordResearch } from './bus';
import { MAX_EVENT_BATCH, MAX_EVENT_BATCH_BYTES, SCHEMA_VERSION, validEvent, type RawEvent, type SurveySubmission } from './schema';
import { IndexedOutbox, type Outbox, type Pending } from './outbox';
declare const __RESEARCH_BUILD_ID__:string;
export type ResearchRequest = (route:string, body:object)=>Promise<any>;
export class ResearchCollector {
  private stopObserving?:()=>void; private owner=''; private sequence=0; private sessionId=''; private start=0;
  private writing=Promise.resolve(); private inFlight:Promise<void>|null=null; private retryAt=0; private failures=0; private pendingCount=0; private timer=0;
  private writeError:Error|null=null;
  private drainTimer=0;
  private pageVisibleAt=performance.now(); private change=()=> { const visible=document.visibilityState==='visible';recordResearch('visibility_change',{visible,visibleMs:visible?0:Math.max(0,performance.now()-this.pageVisibleAt)});if(visible)this.pageVisibleAt=performance.now();void this.flush(); };
  private online=()=>{this.retryAt=0;void this.flush();};
  private leave=()=>{void this.flush();};
  constructor(private request:ResearchRequest,private notify:(message:string)=>void,private outbox:Outbox=new IndexedOutbox()){}
  async enable(owner:string):Promise<void> {
    if(this.owner===owner&&this.stopObserving)return;
    this.pause();await this.inFlight;await this.writing;this.owner=owner;this.sessionId=crypto.randomUUID();this.sequence=0;this.start=performance.now();this.pageVisibleAt=this.start;this.writeError=null;this.retryAt=0;this.failures=0;
    this.pendingCount=(await this.outbox.all(owner)).length;
    this.stopObserving=observeResearch((action,payload,context)=> {
      const event:RawEvent={schemaVersion:SCHEMA_VERSION,appBuild:typeof __RESEARCH_BUILD_ID__==='string'?__RESEARCH_BUILD_ID__:'development',eventId:crypto.randomUUID(),sessionId:this.sessionId,sequence:++this.sequence,occurredAt:new Date().toISOString(),elapsedMs:performance.now()-this.start,action,context,payload};
      if(validEvent(event))this.enqueue({key:event.eventId,owner:this.owner,kind:'event',body:event});
    });
    recordResearch('session_start',{width:innerWidth,height:innerHeight});
    document.addEventListener('visibilitychange',this.change);window.addEventListener('online',this.online);window.addEventListener('pagehide',this.leave);
    // Transport timer only: an idle app creates NO periodic research rows.
    // Stagger devices so a whole class does not retry against Sheets in lockstep.
    this.timer=window.setInterval(()=>{void this.flush();},5000+Math.random()*2000);
    void this.flush();
  }
  pause():void { this.stopObserving?.();this.stopObserving=undefined;window.clearInterval(this.timer);window.clearTimeout(this.drainTimer);document.removeEventListener('visibilitychange',this.change);window.removeEventListener('online',this.online);window.removeEventListener('pagehide',this.leave);this.owner=''; }
  private enqueue(row:Pending):void {
    if(this.pendingCount>=50000){this.pause();this.notify('기기 대기함이 가득 차 수집을 중지했습니다. 연구 담당자에게 알려 주세요.');return;}
    this.pendingCount++;
    this.writing=this.writing.then(()=>this.outbox.put(row)).catch(()=>{this.writeError=new Error('기기에 저장하지 못했습니다. 저장 공간을 확인해 주세요.');this.pause();this.notify('로그를 저장하지 못해 수집을 중지했습니다. 저장 공간을 확인해 주세요.');});
  }
  async survey(body:SurveySubmission):Promise<void> {
    if(!this.owner)throw new Error('연구 로그인과 참여 확인이 필요합니다.');
    this.enqueue({key:body.submissionId,owner:this.owner,kind:'survey',body});await this.writing;if(this.writeError)throw this.writeError;if(!this.owner)throw new Error('수집이 중지되어 저장하지 못했습니다.');await this.flush();
  }
  flush():Promise<void> {
    if(this.inFlight)return this.inFlight;
    if(!this.owner||Date.now()<this.retryAt)return Promise.resolve();
    this.inFlight=this.send().finally(()=>{this.inFlight=null;});return this.inFlight;
  }
  private async send():Promise<void> {
    const owner=this.owner;
    try {
      await this.writing;const rows=await this.outbox.all(owner);
      // Recheck after async storage: never send A's pending events as B.
      if(owner!==this.owner)return;
      const survey=rows.find(r=>r.kind==='survey');
      const candidates=survey?[]:rows.filter(r=>r.kind==='event').sort((a,b)=>{const x=a.body as RawEvent,y=b.body as RawEvent;return x.sessionId===y.sessionId?x.sequence-y.sequence:Date.parse(x.occurredAt)-Date.parse(y.occurredAt);}).slice(0,MAX_EVENT_BATCH);
      const events:Pending[]=[];let bytes=16;
      for(const row of candidates){const size=new TextEncoder().encode(JSON.stringify(row.body)).length+1;if(bytes+size>MAX_EVENT_BATCH_BYTES)break;bytes+=size;events.push(row);}
      const batch=survey?[survey]:events;
      if(!batch.length){this.notify('수집 중 · 전송 완료');return;}
      const result=await this.request(events.length?'events':'survey',events.length?{events:events.map(r=>r.body)}:survey!.body);
      if(!Array.isArray(result.accepted)||!result.accepted.length||result.accepted.some((id:unknown)=>typeof id!=='string'||!batch.some(r=>r.key===id)))throw new Error('ack');
      await this.outbox.remove(result.accepted);if(owner!==this.owner)return;this.pendingCount=Math.max(0,this.pendingCount-result.accepted.length);this.failures=0;this.retryAt=0;
      this.notify(this.pendingCount?`수집 중 · 전송 대기 ${this.pendingCount}건`:'수집 중 · 전송 완료');
    } catch { if(owner===this.owner){this.retryAt=Date.now()+Math.min(60000,1000*2**Math.min(++this.failures,6)*(.75+Math.random()*.5));this.notify('전송 대기 · 기기에 저장했으며 다시 연결되면 전송합니다.');} }
    finally { if(owner===this.owner&&this.pendingCount>0&&!this.failures){window.clearTimeout(this.drainTimer);this.drainTimer=window.setTimeout(()=>{void this.flush();},1000+Math.random()*500);} }
  }
  /** Unacknowledged rows survive logout. Only this study/participant can resume sending them. */
  async logout():Promise<void> {recordResearch('session_end',{reason:'logout'});this.stopObserving?.();this.stopObserving=undefined;await this.writing;await this.flush();this.pause();this.pendingCount=0;}
}
