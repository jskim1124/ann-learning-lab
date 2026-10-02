import {describe,it,expect} from 'vitest';
import {PROFILE_QUESTIONS,STUDY_INSTRUMENT} from './questionnaire';
import {PROFILE_VERSION,validProfile,validSurvey} from './schema';
const profile=()=>({version:PROFILE_VERSION,answers:Object.fromEntries(PROFILE_QUESTIONS.map(q=>[q.id,q.multiple?['없음']:q.options?.[0]??'TEST-01']))});
describe('researcher supplied raw questions',()=>{
 it('requires all 12 basic/experience questions and accepts six grades',()=>{
  expect(PROFILE_QUESTIONS.map(q=>q.id)).toEqual(['A1','A2','A3','A4','B1','B2','B3','B4','B5','B6','B7','B8']);
  expect(validProfile(profile())).toBe(true);for(const grade of ['중1','중2','중3','고1','고2','고3']){const p=profile();p.answers.A2=grade;expect(validProfile(p)).toBe(true);}
  for(const q of PROFILE_QUESTIONS){const p=profile();delete p.answers[q.id];expect(validProfile(p)).toBe(false);}
 });
 it('allows self described gender only with text, and none is exclusive',()=>{
   const p=profile();p.answers.A4='직접 입력';expect(validProfile(p)).toBe(false);p.answers.A4_text='테스트';expect(validProfile(p)).toBe(true);
   p.answers.B2=['없음','추천 서비스'];expect(validProfile(p)).toBe(false);p.answers.B2=['추천 서비스','코딩 지원 AI'];expect(validProfile(p)).toBe(true);
   p.answers.email='private';expect(validProfile(p)).toBe(false);
 });
 it('contains exactly 17 ordered items, all required, six confidence anchors',()=>{
   const i=STUDY_INSTRUMENT;expect(i.items.map(q=>q.id)).toEqual(Array.from({length:17},(_,i)=>String(i+1)));expect(i.anchors).toHaveLength(6);expect(i.anchors[0]).toBe('전혀 확신하지 않는다');expect(i.anchors[5]).toBe('매우 확신한다');
   const s={submissionId:crypto.randomUUID(),version:i.version,answers:Object.fromEntries(i.items.map(q=>[q.id,6]))};expect(validSurvey(s,i)).toBe(true);s.answers['17']=7;expect(validSurvey(s,i)).toBe(false);delete s.answers['17'];expect(validSurvey(s,i)).toBe(false);
 });
});
