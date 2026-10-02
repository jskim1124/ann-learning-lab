// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createContext,runInContext } from 'node:vm';
import { createHmac } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { mac } from './crypto';
class Sheet {
  rows:any[][]=[];getLastRow(){return this.rows.length;}getLastColumn(){return this.rows[0]?.length??0;}
  appendRow(r:any[]){this.rows.push(r);}setFrozenRows(){}
  getRange(row:number,column:number,height:number,width:number){return{getValues:()=>this.rows.slice(row-1,row-1+height).map(r=>r.slice(column-1,column-1+width)),setValues:(values:any[][])=>values.forEach((r,i)=>this.rows[row-1+i]=r)};}
}
function gateway() {
  const sheets=new Map<string,Sheet>(),secret='x'.repeat(32);let locked=false;
  let contention=false;
  const context=createContext({JSON,Date,Array,Object,Error,PropertiesService:{getScriptProperties:()=>({getProperty:(k:string)=>({GATEWAY_SECRET:secret,SHEET_ID:'test-only',STUDY_ID:'study'}[k])})},Utilities:{computeHmacSha256Signature:(v:string,k:string)=>createHmac('sha256',k).update(v).digest(),base64EncodeWebSafe:(v:Buffer)=>v.toString('base64url')},ContentService:{MimeType:{JSON:'json'},createTextOutput:(text:string)=>({setMimeType:()=>text})},LockService:{getScriptLock:()=>({waitLock:()=>{if(contention)throw Error("busy");locked=true;},tryLock:()=>contention?false:locked=true,hasLock:()=>locked,releaseLock:()=>locked=false})},SpreadsheetApp:{openById:()=>({getSheetByName:(n:string)=>sheets.get(n),insertSheet:(n:string)=>{const s=new Sheet();sheets.set(n,s);return s;}}),flush:()=>{}}});
  runInContext(readFileSync('integrations/google-apps-script/Code.gs','utf8'),context);
  const call=(data:object,signature?:string)=>{const timestamp=Date.now(),body=JSON.stringify({study:'study',...data});const envelope={timestamp,body,signature:signature??mac(secret,`${timestamp}.${body}`)};return JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}));};
  return{call,sheets,setup:()=>context.setupResearchSheets(),locked:()=>locked,contend:(value:boolean)=>contention=value};
}
describe('Apps Script receiver contract, with no network',()=>{
  it('initial setup creates only headers and preserves existing rows on a repeat run',()=>{
    const g=gateway();g.setup();expect([...g.sheets.keys()]).toEqual(['Participants','RawEvents','SurveyResponses']);
    expect([...g.sheets.values()].map(s=>s.rows.length)).toEqual([1,1,1]);
    g.sheets.get('Participants')!.rows.push(['p_test','v1','date','{}','cipher']);
    g.setup();expect(g.sheets.get('Participants')!.rows).toHaveLength(2);expect(g.locked()).toBe(false);
  });
  it('rejects unsigned calls before opening a spreadsheet',()=>{const g=gateway();expect(g.call({operation:'participant',participantId:'x'},'wrong').ok).toBe(false);expect(g.sheets.size).toBe(0);});
  it('appends once under lock, acknowledges retries and neutralizes formulas',()=>{
    const g=gateway(),id=crypto.randomUUID(),pid='p_'+'a'.repeat(43),values=[id,'study',pid,'date','v1','=IMPORTXML("https://example.invalid")'];
    const request={operation:'append',sheet:'SurveyResponses',rows:[{id,participantId:pid,values}]};expect(g.call(request)).toEqual({ok:true,data:[id]});expect(g.call(request).ok).toBe(true);const rows=g.sheets.get('SurveyResponses')!.rows;expect(rows).toHaveLength(2);expect(rows[1]![5]).toMatch(/^'=/);expect(g.locked()).toBe(false);
  });
  it('does not send encrypted identity back in profile lookup',()=>{const g=gateway(),pid='p_'+'b'.repeat(43);g.call({operation:'join',participant:{participantId:pid,consentVersion:'v1',joinedAt:'date',profile:{grade:'7'},identityCiphertext:'private-cipher'}});const result=g.call({operation:'participant',participantId:pid});expect(JSON.stringify(result)).not.toContain('private-cipher');expect(g.sheets.get('Participants')!.rows).toHaveLength(2);});
  it('does not acknowledge or mutate rows on lock contention, and accepts a later retry',()=>{
    const g=gateway(),pid='p_'+'c'.repeat(43),id=crypto.randomUUID(),request={operation:'append',sheet:'SurveyResponses',rows:[{id,participantId:pid,values:[id,'study',pid,'date','v1','{"demo1":2}']}]};
    g.contend(true);expect(g.call(request).ok).toBe(false);expect(g.sheets.size).toBe(0);g.contend(false);expect(g.call(request)).toEqual({ok:true,data:[id]});
  });
  it('accepts a bounded 200-row burst and preserves numeric sheet cells',()=>{
    const g=gateway(),pid='p_'+'d'.repeat(43),rows=Array.from({length:200},(_,i)=>{const id=crypto.randomUUID();return{id,participantId:pid,values:[id,'study',pid,'session',i+1,'date','date',12.345,1,'build','experimental','custom','3','engine','workspace',1,1,'ui_input','interaction',JSON.stringify({value:i/100})]};});
    const request={operation:'append',sheet:'RawEvents',rows};expect(g.call(request).data).toHaveLength(200);expect(g.call(request).data).toHaveLength(200);
    const data=g.sheets.get('RawEvents')!.rows;expect(data).toHaveLength(201);expect(data[1]![7]).toBe(12.345);expect(data[200]![4]).toBe(200);
  });
});
