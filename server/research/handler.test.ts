// @vitest-environment node
import { describe,it,expect,vi } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { createDecipheriv,randomBytes } from 'node:crypto';
import { createResearchHandler } from './handler';
import { researchConfig } from './config';
import { PROFILE_VERSION } from '../../src/research/schema';
import { PROFILE_QUESTIONS, STUDY_INSTRUMENT } from '../../src/research/questionnaire';
const profileFixture=()=>({version:PROFILE_VERSION,answers:Object.fromEntries(PROFILE_QUESTIONS.map(q=>[q.id,q.multiple?['없음']:q.options?.[0]??'TEST-01']))});
const surveyFixture=(value=3)=>({submissionId:crypto.randomUUID(),version:STUDY_INSTRUMENT.version,answers:Object.fromEntries(STUDY_INSTRUMENT.items.map(q=>[q.id,value]))});
import { MemorySink } from './sink';
import { encryptSubject,pseudonym,unseal } from './crypto';

const config=()=>researchConfig({RESEARCH_MODE:'local',RESEARCH_ORIGIN:'http://localhost:4173'});
function client(handler:ReturnType<typeof createResearchHandler>) {
  const jar:Record<string,string>={};let csrf='';
  const request=async(route:string,data?:object,extra:Record<string,string>={})=>{
    const headers:Record<string,any>={};let status=0,text='';
    const req=Readable.from(data?[JSON.stringify(data)]:[]) as unknown as IncomingMessage;
    Object.assign(req,{url:`/api/research/${route}`,method:data?'POST':'GET',headers:{host:'localhost:4173',origin:'http://localhost:4173','content-type':'application/json','x-research-csrf':csrf,cookie:Object.entries(jar).map(([k,v])=>`${k}=${v}`).join('; '),...extra},socket:{remoteAddress:'127.0.0.1'}});
    const res={setHeader:(k:string,v:any)=>headers[k.toLowerCase()]=v,writeHead:(s:number,h:object)=>{status=s;Object.assign(headers,h);},end:(s:string)=>text=s} as unknown as ServerResponse;
    await handler(req,res);for(const cookie of [headers['set-cookie']??[]].flat()){const [name,value]=String(cookie).split(';')[0]!.split('=');jar[name!]=value!;}
    const body=JSON.parse(text);if(body.csrf)csrf=body.csrf;return {status,body,headers};
  };return {request,jar};
}
describe('research auth and storage',()=>{
  it('requests the new questionnaire from a returning draft-profile participant before accepting more logs',async()=>{
    const settings=config(),sink=new MemorySink(),c=client(createResearchHandler(settings,sink));await c.request('config');await c.request('login',{});const id=(await c.request('config')).body.participantId;
    sink.participants.set(id,{participantId:id,profile:{version:'draft-v1',grade:'7',aiExperience:'some'},consentVersion:settings.consentVersion,joinedAt:'old',identityCiphertext:'old'});
    expect((await c.request('config')).body.consented).toBe(false);expect((await c.request('events',{events:[]})).status).toBe(403);
    expect((await c.request('profile',{profile:profileFixture(),consent:true,consentVersion:settings.consentVersion})).status).toBe(200);
    expect((await c.request('config')).body.consented).toBe(true);expect(sink.participants.get(id)!.profile).toEqual(profileFixture());
  });
  it('fails closed by default and forbids development mode in production',()=>{expect(researchConfig({}).mode).toBe('off');expect(()=>researchConfig({RESEARCH_MODE:'local',NODE_ENV:'production'})).toThrow();expect(()=>researchConfig({RESEARCH_MODE:'google'})).toThrow();});
  it('uses study-scoped stable pseudonyms and randomized authenticated encryption',()=>{
    expect(pseudonym('key','study','123')).toBe(pseudonym('key','study','123'));expect(pseudonym('key','other','123')).not.toBe(pseudonym('key','study','123'));
    const key=randomBytes(32).toString('base64'),encrypted=encryptSubject(key,'123','study');expect(encrypted).not.toBe(encryptSubject(key,'123','study'));const [,iv,tag,cipher]=encrypted.split('.');const d=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),Buffer.from(iv!,'base64url'));d.setAAD(Buffer.from('study'));d.setAuthTag(Buffer.from(tag!,'base64url'));expect(JSON.parse(Buffer.concat([d.update(Buffer.from(cipher!,'base64url')),d.final()]).toString()).sub).toBe('123');
  });
  it('does not collect before consent, does not duplicate events, rejects private payloads and cross-origin writes',async()=>{
    const sink=new MemorySink(),c=client(createResearchHandler(config(),sink));
    await c.request('config');expect((await c.request('login',{})).status).toBe(200);const info=await c.request('config');expect(info.body.consented).toBe(false);expect(sink.participants.size).toBe(0);
    expect((await c.request('events',{events:[]})).status).toBe(403);
    await c.request('profile',{profile:profileFixture(),consent:true,consentVersion:'draft-v1'});
    const raw={schemaVersion:1,appBuild:'test-build',eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),sequence:1,occurredAt:new Date().toISOString(),elapsedMs:1,action:'training_batch',context:{condition:'comparison',task:'digits',page:'comparison',engine:'pixel-ann-196',workspaceId:crypto.randomUUID(),datasetVersion:1,modelVersion:1},payload:{epoch:1,accuracy:.8}};
    expect((await c.request('events',{events:[raw]},{origin:'https://evil.example'})).status).toBe(403);
    expect((await c.request('events',{events:[{...raw,payload:{email:'x@y.z'}}]})).status).toBe(400);
    expect((await c.request('events',{events:[raw]})).body.accepted).toEqual([raw.eventId]);await c.request('events',{events:[raw]});expect(sink.rows.RawEvents.size).toBe(1);
    expect([...sink.rows.RawEvents.values()][0]!.participantId).toBe(info.body.participantId);expect(JSON.stringify([...sink.rows.RawEvents.values()])).not.toContain('identityCiphertext');
    const submission=surveyFixture();await c.request('survey',submission);await c.request('survey',submission);expect(sink.rows.SurveyResponses.size).toBe(1);
    await c.request('logout',{});expect((await c.request('config')).body.participantId).toBeNull();
  });
  it('checks Google nonce with official-verifier dependency and never stores emails',async()=>{
    const settings={...config(),mode:'google' as const,googleClientId:'expected-audience'};const verify=vi.fn().mockResolvedValue({sub:'subject-123',nonce:'wrong'});const sink=new MemorySink(),c=client(createResearchHandler(settings,sink,verify));
    const initial=await c.request('config');expect((await c.request('login',{credential:'opaque-token'})).status).toBe(401);verify.mockResolvedValue({sub:'subject-123',nonce:initial.body.nonce});expect((await c.request('login',{credential:'opaque-token'})).status).toBe(200);expect(verify).toHaveBeenCalledWith('opaque-token','expected-audience');
    const session=unseal<any>(settings.sessionKey,c.jar.nl_session)!;expect(JSON.stringify(session)).not.toContain('subject-123');expect(session.participantId).toMatch(/^p_/);expect(sink.participants.size).toBe(0);
    c.jar.nl_session+='tamper';expect((await c.request('config')).body.participantId).toBeNull();
  });
  it('recreates the same pseudonym after logout and on a different browser/server with fixed keys',async()=>{
    const settings={...config(),mode:'google' as const,googleClientId:'test-client'},sink=new MemorySink();
    const verify=vi.fn(),first=client(createResearchHandler(settings,sink,verify));
    const login=async(c:ReturnType<typeof client>)=>{const start=await c.request('config');verify.mockResolvedValue({sub:'same-google-subject',nonce:start.body.nonce});expect((await c.request('login',{credential:'test-token'})).status).toBe(200);return(await c.request('config')).body;};
    const initial=await login(first);expect((await first.request('profile',{profile:profileFixture(),consent:true,consentVersion:'draft-v1',enrollmentCode:settings.enrollmentCode})).status).toBe(200);
    await first.request('logout',{});const returning=await login(first);
    const second=client(createResearchHandler({...settings},sink,verify)),otherDevice=await login(second);
    expect(returning.participantId).toBe(initial.participantId);expect(otherDevice.participantId).toBe(initial.participantId);expect(otherDevice.consented).toBe(true);expect(sink.participants.size).toBe(1);
  });
  it('retains 30 participants, 18000 raw events and 30 surveys through concurrent requests and lost acknowledgements (local simulation)',async()=>{
    class InterruptedSink extends MemorySink {
      lost=new Set<string>();active=0;peak=0;
      override async append(sheet:'RawEvents'|'SurveyResponses',rows:Parameters<MemorySink['append']>[1]) {
        this.peak=Math.max(this.peak,++this.active);
        try {
          await new Promise<void>(resolve=>setImmediate(resolve));
          const accepted=await super.append(sheet,rows),key=`${sheet}:${rows[0]!.participantId}`;
          if(!this.lost.has(key)){this.lost.add(key);throw new Error('Response lost after durable write');}
          return accepted;
        }finally{this.active--;}
      }
    }
    const settings={...config(),mode:'google' as const,googleClientId:'test-client',instrument:{...config().instrument,draft:false}},sink=new InterruptedSink();
    // Only the identity-provider verification is faked; cookies, CSRF, pseudonyms,
    // schemas, ownership, serialization and acknowledgement paths are real.
    const handler=createResearchHandler(settings,sink,async credential=>JSON.parse(credential));
    const students=await Promise.all(Array.from({length:30},async(_,i)=>{
      const c=client(handler),initial=await c.request('config');
      expect((await c.request('login',{credential:JSON.stringify({sub:`student-${i}`,nonce:initial.body.nonce})})).status).toBe(200);
      const info=await c.request('config');
      const profile={...profileFixture(),answers:{...profileFixture().answers,A1:`TEST-${i}`,A2:['중1','중2','중3'][i%3]}};
      expect((await c.request('profile',{profile,consent:true,consentVersion:settings.consentVersion,enrollmentCode:settings.enrollmentCode})).status).toBe(200);
      return{c,id:info.body.participantId as string,index:i};
    }));
    expect(new Set(students.map(s=>s.id)).size).toBe(30);
    const expected=new Map<string,{participant:string;value:number}>();
    await Promise.all(students.map(async({c,id,index})=>{
      const sessionId=crypto.randomUUID(),workspaceId=crypto.randomUUID();
      for(let batch=0;batch<3;batch++){
        const events=Array.from({length:200},(_,i)=>{
          const eventId=crypto.randomUUID(),value=index*1000+batch*200+i+.123456789;
          expected.set(eventId,{participant:id,value});
          return{schemaVersion:1,appBuild:'concurrency-test',eventId,sessionId,sequence:batch*200+i+1,occurredAt:new Date().toISOString(),elapsedMs:batch*200+i,action:'ui_input',context:{condition:'experimental',task:'custom',page:'3',engine:'feature-ann-2',workspaceId,datasetVersion:1,modelVersion:1},payload:{elementId:'weight',value,previous:value-1}};
        });
        let response=await c.request('events',{events});if(response.status===503)response=await c.request('events',{events});
        expect(response.status).toBe(200);expect(response.body.accepted).toEqual(events.map(e=>e.eventId));
        expect((await c.request('events',{events})).body.accepted).toEqual(events.map(e=>e.eventId));
      }
      const submission=surveyFixture(index%6+1);
      expect((await c.request('survey',submission)).status).toBe(503);expect((await c.request('survey',submission)).status).toBe(200);expect((await c.request('survey',submission)).status).toBe(200);
    }));
    expect(sink.peak).toBe(30);expect(sink.participants.size).toBe(30);expect(sink.rows.RawEvents.size).toBe(18000);expect(sink.rows.SurveyResponses.size).toBe(30);
    for(const row of sink.rows.RawEvents.values()){
      const raw=expected.get(row.id)!;expect(row.participantId).toBe(raw.participant);expect(JSON.parse(row.values[19] as string).value).toBe(raw.value);
    }
    for(const student of students){
      expect(sink.participants.get(student.id)!.profile).toMatchObject({answers:{A1:`TEST-${student.index}`,A2:['중1','중2','중3'][student.index%3]}});
      const response=[...sink.rows.SurveyResponses.values()].find(r=>r.participantId===student.id)!;
      expect(JSON.parse(response.values[5] as string)).toEqual(surveyFixture(student.index%6+1).answers);
    }
  });
});
