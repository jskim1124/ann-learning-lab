import { describe,it,expect } from 'vitest';
import { validEvent,validPayload,validProfile,validSurvey,DRAFT_INSTRUMENT,type RawEvent } from './schema';
export function event():RawEvent {return {schemaVersion:1,appBuild:'test-build',eventId:crypto.randomUUID(),sessionId:crypto.randomUUID(),sequence:1,occurredAt:new Date().toISOString(),elapsedMs:10,action:'training_batch',context:{condition:'experimental',task:'omr',page:'4',engine:'pixel-ann-196',workspaceId:crypto.randomUUID(),datasetVersion:1,modelVersion:1},payload:{loss:.5,accuracy:.6,epoch:10}};}
describe('research schema privacy boundary',()=>{
  it('accepts numerical raw model observations',()=>expect(validEvent(event())).toBe(true));
  it.each(['email','name','pixels','image','text','filename','credential','ip'])('rejects private/unlisted field %s',key=>expect(validPayload({[key]:'private'})).toBe(false));
  it('rejects nonfinite values, long arrays and unknown context fields',()=>{expect(validPayload({loss:NaN})).toBe(false);expect(validPayload({probabilities:Array(196).fill(0)})).toBe(false);expect(validEvent({...event(),context:{...event().context,email:'x@y.z'}})).toBe(false);});
  it('rejects survey defaults or missing required answers',()=>{expect(validSurvey({submissionId:crypto.randomUUID(),version:'draft-v1',answers:{}},DRAFT_INSTRUMENT)).toBe(false);expect(validSurvey({submissionId:crypto.randomUUID(),version:'draft-v1',answers:{demo1:4}},DRAFT_INSTRUMENT)).toBe(true);});
  it('rejects retired draft profile responses',()=>{expect(validProfile({version:'draft-v1',grade:'7',aiExperience:'skip'})).toBe(false);});
});
