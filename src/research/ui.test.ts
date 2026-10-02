import { beforeEach,afterEach,describe,it,expect,vi } from 'vitest';
import { ResearchUI } from './ui';
import { DRAFT_INSTRUMENT,PROFILE_VERSION } from './schema';
import { STUDY_INSTRUMENT,PROFILE_QUESTIONS } from './questionnaire';
const mocks=vi.hoisted(()=>({enable:vi.fn().mockResolvedValue(undefined),pause:vi.fn(),survey:vi.fn().mockResolvedValue(undefined),logout:vi.fn().mockResolvedValue(undefined)}));
vi.mock('./collector',()=>({ResearchCollector:class{enable=mocks.enable;pause=mocks.pause;survey=mocks.survey;logout=mocks.logout;}}));
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
let settings:any;
beforeEach(()=>{
  settings={enabled:true,mode:'local',study:'test',csrf:'csrf',participantId:'p_test',consented:true,instrument:DRAFT_INSTRUMENT,surveyAvailable:true};
  sessionStorage.clear();document.body.innerHTML='<button id="help">도움말</button>';vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({...settings})})));
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('research UI never scores or silently reuses a participant answer',()=>{
  it('opens basics immediately for a newly signed-in participant and submits all twelve raw answers',async()=>{
    settings.consented=false;settings.profileVersion=PROFILE_VERSION;settings.consentVersion='consent-test';
    new ResearchUI(document.querySelector('#help')!);await settle();
    expect(document.querySelector('dialog')!.open).toBe(true);expect(document.querySelector('dialog')!.textContent).toContain('A1');expect(mocks.enable).not.toHaveBeenCalled();
    const submit=()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    for(let page=0;page<4;page++){
      for(const q of PROFILE_QUESTIONS){
        const el=document.querySelector<HTMLInputElement|HTMLSelectElement>(`[name="${q.id}"]`);if(!el)continue;
        if(q.multiple){const none=document.querySelector<HTMLInputElement>(`[name="${q.id}"][value="없음"]`)!;none.checked=true;none.dispatchEvent(new Event('change'));}
        else {el.value=q.options?.[0]??'TEST-01';el.dispatchEvent(new Event('change'));}
      }
      submit();
    }
    const consent=document.querySelector<HTMLInputElement>('[name=consent]')!;consent.checked=true;submit();await settle();
    const request=vi.mocked(fetch).mock.calls.find(c=>String(c[0]).endsWith('/profile'))!;
    const body=JSON.parse(String(request[1]!.body));expect(body.profile.version).toBe(PROFILE_VERSION);expect(Object.keys(body.profile.answers)).toHaveLength(12);expect(body.profile.answers.B2).toEqual(['없음']);
    expect(body.profile.answers.A1).toBe('TEST-01');expect(body.consent).toBe(true);
  });
  it('keeps none exclusive and direct gender text conditional',async()=>{
    settings.consented=false;settings.profileVersion=PROFILE_VERSION;new ResearchUI(document.querySelector('#help')!);await settle();
    const gender=document.querySelector<HTMLSelectElement>('[name=A4]')!;gender.value='직접 입력';gender.dispatchEvent(new Event('change'));expect(document.querySelector<HTMLInputElement>('[name=A4_text]')!.required).toBe(true);
    gender.value='응답하지 않음';gender.dispatchEvent(new Event('change'));expect(document.querySelector<HTMLElement>('[data-gender-detail]')!.hidden).toBe(true);
    for(const id of ['A1','A3'])document.querySelector<HTMLInputElement>(`[name=${id}]`)!.value='TEST';document.querySelector<HTMLSelectElement>('[name=A2]')!.value='중1';
    document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const none=document.querySelector<HTMLInputElement>('[name=B2][value="없음"]')!,other=document.querySelector<HTMLInputElement>('[name=B2][value="추천 서비스"]')!;
    none.checked=true;none.dispatchEvent(new Event('change'));other.checked=true;other.dispatchEvent(new Event('change'));expect(none.checked).toBe(false);none.checked=true;none.dispatchEvent(new Event('change'));expect(other.checked).toBe(false);
  });
  it('uses all 17 six-point items and preserves answers when going back',async()=>{
    settings.instrument=STUDY_INSTRUMENT;new ResearchUI(document.querySelector('#help')!);await settle();document.querySelector<HTMLButtonElement>('[data-research-survey]')!.click();
    for(let i=0;i<17;i++){
      expect(document.querySelectorAll('input[name=likert]')).toHaveLength(6);expect(document.querySelector('input:checked')).toBeNull();
      const input=document.querySelector<HTMLInputElement>('input[value="6"]')!;input.checked=true;input.dispatchEvent(new Event('change'));
      document.querySelector<HTMLButtonElement>('[data-survey-next]')!.click();
    }
    await settle();expect(mocks.survey).toHaveBeenCalledTimes(1);const data=mocks.survey.mock.calls[0]![0];expect(data.version).toBe(STUDY_INSTRUMENT.version);expect(data.answers).toEqual(Object.fromEntries(STUDY_INSTRUMENT.items.map(q=>[q.id,6])));
  });
  it('does not load Google or enable collection when unconfigured',async()=>{settings={enabled:false};new ResearchUI(document.querySelector('#help')!);await settle();expect(mocks.enable).not.toHaveBeenCalled();expect(document.querySelector('script[src*="accounts.google"]')).toBeNull();document.querySelector<HTMLButtonElement>('[data-research-survey]')!.click();expect(document.querySelector('dialog')!.textContent).toContain('문항을 준비 중');});
  it('has no preselected Likert response and blocks submission until answered',async()=>{
    new ResearchUI(document.querySelector('#help')!);await settle();document.querySelector<HTMLButtonElement>('[data-research-survey]')!.click();expect(document.querySelector('input:checked')).toBeNull();document.querySelector<HTMLButtonElement>('[data-survey-next]')!.click();expect(mocks.survey).not.toHaveBeenCalled();expect(document.querySelector('.research-message')!.textContent).toContain('골라');
    const input=document.querySelector<HTMLInputElement>('input[value="4"]')!;input.checked=true;input.dispatchEvent(new Event('change'));document.querySelector<HTMLButtonElement>('[data-survey-next]')!.click();await settle();expect(mocks.survey.mock.calls[0]![0]).toMatchObject({version:'draft-v1',answers:{demo1:4}});expect(document.querySelector('dialog')!.textContent).toContain('점수나 피드백을 제공하지 않습니다');
  });
  it('does not auto-resume after a local logout pause',async()=>{sessionStorage.setItem('neural-lab-research-paused','1');new ResearchUI(document.querySelector('#help')!);await settle();expect(mocks.enable).not.toHaveBeenCalled();});
  it('clears answers on account change',async()=>{
    new ResearchUI(document.querySelector('#help')!);await settle();document.querySelector<HTMLButtonElement>('[data-research-survey]')!.click();const input=document.querySelector<HTMLInputElement>('input[value="3"]')!;input.checked=true;input.dispatchEvent(new Event('change'));document.querySelector<HTMLDialogElement>('dialog')!.close();settings.participantId='p_other';document.querySelector<HTMLButtonElement>('[data-research-login]')!.click();await settle();document.querySelector<HTMLDialogElement>('dialog')!.close();document.querySelector<HTMLButtonElement>('[data-research-survey]')!.click();expect(document.querySelector('input:checked')).toBeNull();
  });
});
