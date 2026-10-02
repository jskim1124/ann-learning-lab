import { ResearchCollector } from './collector';
import { recordResearch } from './bus';
import { type Instrument, type ResearchProfile, type SurveySubmission } from './schema';
import { PROFILE_QUESTIONS, STUDY_INSTRUMENT } from './questionnaire';
import './research.css';
interface PublicConfig { enabled:boolean; mode?:'local'|'google'; study?:string; csrf?:string; nonce?:string; googleClientId?:string; participantId?:string|null; consented?:boolean; consentVersion?:string; profileVersion?:string; profileDraft?:boolean; instrument?:Instrument; surveyAvailable?:boolean; }
const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
interface GoogleApi { accounts:{ id:{ initialize(options:object):void; renderButton(element:HTMLElement,options:object):void; disableAutoSelect():void; } }; }
let googleLoading:Promise<GoogleApi>|undefined;
function google():Promise<GoogleApi> {
  return googleLoading??=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=()=>resolve((window as unknown as {google:GoogleApi}).google);script.onerror=()=>{googleLoading=undefined;reject(new Error('Google 로그인 화면을 불러오지 못했습니다.'));};document.head.append(script);});
}
export class ResearchUI {
  private config:PublicConfig={enabled:false}; private dialog:HTMLDialogElement; private status:HTMLElement;
  private collector:ResearchCollector; private answers:Record<string,number>={}; private surveyId=crypto.randomUUID();private submitted=false;private submitting=false;
  private isPaused():boolean {try{return sessionStorage.getItem('neural-lab-research-paused')==='1';}catch{return false;}}
  private setPaused(paused:boolean):void {try{sessionStorage.setItem('neural-lab-research-paused',paused?'1':'0');}catch{/* A denied storage permission is handled by the outbox gate. */}}
  constructor(help:HTMLElement) {
    const header=document.createElement('div');header.className='research-header';
    header.innerHTML='<button type="button" data-research-login>연구 로그인</button><button type="button" data-research-survey>검사</button><span class="research-indicator" aria-live="polite">수집 꺼짐</span>';
    help.before(header);header.append(help);this.status=header.querySelector('.research-indicator')!;
    this.dialog=document.createElement('dialog');this.dialog.className='research-dialog';document.body.append(this.dialog);
    this.collector=new ResearchCollector((r,b)=>this.post(r,b),s=>this.status.textContent=this.config.mode==='local'?`개발용 · ${s}`:s);
    header.querySelector('[data-research-login]')!.addEventListener('click',()=>{void this.account();});
    header.querySelector('[data-research-survey]')!.addEventListener('click',()=>this.survey());
    this.dialog.addEventListener('click',e=>{if((e.target as Element).closest('[data-research-close]'))this.dialog.close();});
    void this.refresh().then(()=>{if(this.config.participantId&&!this.config.consented)void this.account();});
  }
  private async post(route:string,body:object):Promise<any> {
    const serialized=JSON.stringify(body);
    const response=await fetch(`/api/research/${route}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Research-CSRF':this.config.csrf??''},body:serialized,keepalive:serialized.length<45000});
    if(!response.ok)throw new Error(response.status===401||response.status===403?'다시 로그인해 주세요.':'저장하지 못했습니다. 연결과 설정을 확인한 뒤 다시 시도해 주세요.');
    return response.json();
  }
  private async refresh():Promise<void> {
    try {
      const response=await fetch('/api/research/config',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error('config');const previousOwner=this.config.participantId,previousInstrument=this.config.instrument?.version;this.config=await response.json() as PublicConfig;
      document.querySelector('[data-research-login]')!.textContent=this.config.mode==='local'?'개발용 로그인':this.config.mode==='google'?'Google 로그인':'연구 로그인';
      if(previousOwner!==this.config.participantId||previousInstrument!==this.config.instrument?.version){this.answers={};this.surveyId=crypto.randomUUID();this.submitted=false;}
      if(this.config.enabled&&this.config.consented&&this.config.participantId&&!this.isPaused())await this.collector.enable(`${this.config.study}:${this.config.participantId}`);
      else {this.collector.pause();this.status.textContent=this.config.enabled?(this.config.mode==='local'?'개발용 · 수집 전':'로그인·참여 확인 전'): '수집 꺼짐';}
    } catch {this.collector.pause();this.status.textContent='수집 꺼짐 · 설정 확인';}
  }
  private show(title:string,body:string):void {
    this.dialog.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" data-research-close aria-label="닫기">×</button></header><div class="research-dialog-body">${body}</div><p class="research-message" role="status"></p>`;
    if(!this.dialog.open)this.dialog.showModal();
  }
  private message(error:unknown):void {this.dialog.querySelector('.research-message')!.textContent=error instanceof Error?error.message:'처리하지 못했습니다.';}
  private async account():Promise<void> {
    await this.refresh();
    if(!this.config.enabled){this.show('연구 수집은 꺼져 있어요','<p>아직 연구용 로그를 전송하지 않습니다. 연구 로그인·시트 연결 설정 후 사용할 수 있어요.</p><p>일반 학습 기능은 그대로 이용할 수 있습니다.</p>');return;}
    if(!this.config.participantId){
      this.show('연구 로그인',`<p>로그인과 연구 참여 확인을 마친 뒤부터 행동을 기록합니다.</p><p>이메일과 이름은 저장하지 않으며, 연구별 가명 코드를 사용합니다.</p>${this.config.mode==='local'?'<p class="research-warning">개발 확인용입니다. 실제 Google 계정이나 시트를 사용하지 않습니다.</p><button class="button primary" data-local-login>개발용 계정으로 확인</button>':'<div data-google-button></div>'}`);
      const done=async(credential?:string)=>{try{await this.post('login',{credential});this.setPaused(false);await this.refresh();await this.account();}catch(e){this.message(e);}};
      if(this.config.mode==='local')this.dialog.querySelector('[data-local-login]')!.addEventListener('click',()=>{void done();});
      else try{const api=await google();api.accounts.id.initialize({client_id:this.config.googleClientId,nonce:this.config.nonce,auto_select:false,callback:(r:{credential:string})=>void done(r.credential)});const host=this.dialog.querySelector<HTMLElement>('[data-google-button]');if(host)api.accounts.id.renderButton(host,{type:'standard',theme:'outline',size:'large',text:'signin_with'});}catch(e){this.message(e);}
      return;
    }
    if(!this.config.consented){this.profile();return;}
    this.show('연구 참여 상태',`<p>${this.isPaused()?'수집을 중지했습니다. 다시 시작하기 전에는 수집하지 않습니다.':this.config.mode==='local'?'개발용 임시 저장소입니다. 서버를 끄면 기록이 사라집니다.':'가명 코드로 기록 중입니다.'}</p><p>로그아웃하면 새 기록 수집을 멈춥니다. 아직 전송되지 않은 기록은 이 기기에 남고, 같은 연구 계정으로 다시 로그인하면 이어서 전송합니다. 다른 계정으로는 보내지 않습니다. 삭제가 필요하면 연구 담당자에게 문의해 주세요.</p>${this.isPaused()?'<button data-resume class="button primary">수집 다시 시작</button>':''}<button data-logout class="button secondary">로그아웃 · 수집 중지</button>`);
    this.dialog.querySelector('[data-resume]')?.addEventListener('click',()=>{this.setPaused(false);void this.refresh().then(()=>this.dialog.close());});
    this.dialog.querySelector('[data-logout]')!.addEventListener('click',()=>{this.setPaused(true);void (async()=>{try{await this.collector.logout();this.status.textContent='수집 중지';await this.post('logout',{});(window as unknown as {google?:GoogleApi}).google?.accounts.id.disableAutoSelect();await this.refresh();this.dialog.close();}catch(e){this.message(e);}})();});
  }

  private profile():void {
    // Profile free text stays in this dialog and profile endpoint, never in action logs.
    const answers:ResearchProfile['answers']={};let page=0;
    const pages=[PROFILE_QUESTIONS.slice(0,4),PROFILE_QUESTIONS.slice(4,6),PROFILE_QUESTIONS.slice(6,9),PROFILE_QUESTIONS.slice(9,12)];
    const render=()=>{
      const last=page===pages.length,questions=pages[page]??[];
      this.show(last?'연구 참여 확인':'기본 정보와 경험',`<p>${page+1} / ${pages.length+1} · ${last?'수집 안내':'정답이 없는 질문입니다. 자신의 경험대로 답해 주세요.'}</p><form data-profile>
      ${questions.map(q=>`<fieldset class="research-profile-item"><legend>${q.id} · ${esc(q.text)}</legend>${q.multiple?`<div class="research-multiple">${q.options!.map(o=>`<label><input type="checkbox" name="${q.id}" value="${esc(o)}" ${(answers[q.id] as string[]|undefined)?.includes(o)?'checked':''}>${esc(o)}</label>`).join('')}</div>`:q.options?`<select name="${q.id}" aria-label="${esc(q.text)}" required><option value="">선택해 주세요</option>${q.options.map(o=>`<option value="${esc(o)}" ${answers[q.id]===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`:`<input name="${q.id}" aria-label="${esc(q.text)}" maxlength="40" autocomplete="off" required value="${esc(String(answers[q.id]??''))}">`}${q.id==='A4'?`<label data-gender-detail ${answers.A4==='직접 입력'?'':'hidden'}>직접 입력<input name="A4_text" maxlength="40" value="${esc(String(answers.A4_text??''))}"></label>`:''}</fieldset>`).join('')}
      ${last?`${this.config.mode==='google'?'<label>연구 담당자에게 받은 참여 코드<input name="enrollmentCode" type="password" autocomplete="off" required></label>':''}
      <p>기본 정보·경험, 검사 응답, 화면·요소별 클릭, 숫자 입력, 슬라이더 변경값, 자료 변경·학습·예측을 연구용으로 기록합니다. 행동 로그에 이름·이메일·원본 그림·웹캠 영상·입력 문장은 보내지 않습니다. 로그인 고유 번호는 암호화하여 별도로 보관합니다.</p>
      <p>참여자 번호에는 연구자가 준 번호만 입력하고, 이름·전화번호는 쓰지 마세요. 이 확인은 보호자 동의 등 필요한 연구 참여 절차를 대신하지 않습니다.</p>
      <label class="research-consent"><input name="consent" type="checkbox" required> 연구 안내와 필요한 참여 절차를 확인했고, 수집 시작에 동의합니다.</label>`:''}
      <footer><button type="button" data-profile-back ${page===0?'disabled':''}>← 이전</button><button class="button primary" type="submit">${last?'입력 완료 · 수집 시작':'다음 →'}</button></footer></form>`);
      const form=this.dialog.querySelector('form')!;
      const save=()=>{const values=new FormData(form);for(const q of questions)answers[q.id]=q.multiple?values.getAll(q.id).map(String):String(values.get(q.id)??'').trim();if(questions.some(q=>q.id==='A4')){if(answers.A4==='직접 입력')answers.A4_text=String(values.get('A4_text')??'').trim();else delete answers.A4_text;}};
      const gender=form.querySelector<HTMLSelectElement>('[name=A4]'),detail=form.querySelector<HTMLElement>('[data-gender-detail]');
      const syncGender=()=>{if(detail&&gender){detail.hidden=gender.value!=='직접 입력';detail.querySelector('input')!.required=!detail.hidden;}};gender?.addEventListener('change',syncGender);syncGender();
      form.querySelectorAll<HTMLInputElement>('[type=checkbox]').forEach(input=>input.addEventListener('change',()=>{
        if(input.name==='consent'||!input.checked)return;
        form.querySelectorAll<HTMLInputElement>(`input[name="${input.name}"]`).forEach(other=>{if(other!==input&&(input.value==='없음'||other.value==='없음'))other.checked=false;});
      }));
      form.querySelector('[data-profile-back]')!.addEventListener('click',()=>{save();page--;render();});
      form.addEventListener('submit',e=>{
        e.preventDefault();if(!form.reportValidity())return;save();
        if(questions.some(q=>q.multiple&&!(answers[q.id] as string[]).length)){this.message(new Error('각 질문에 한 가지 이상 골라 주세요. 경험이 없으면 없음으로 답해 주세요.'));return;}
        if(!last){page++;render();return;}
        const values=new FormData(form),button=form.querySelector<HTMLButtonElement>('[type=submit]')!;button.disabled=true;
        void this.post('profile',{profile:{version:this.config.profileVersion,answers},consent:true,consentVersion:this.config.consentVersion,enrollmentCode:values.get('enrollmentCode')??''})
          .then(async()=>{await this.refresh();this.dialog.close();}).catch(error=>{this.message(error);button.disabled=false;});
      });
    };render();
  }

  private survey():void {
    const i=this.config.instrument??STUDY_INSTRUMENT;
    if(!this.config.consented||!this.config.surveyAvailable||this.isPaused()){this.show('검사',`<p>${!this.config.surveyAvailable?'검사 문항을 준비 중입니다. 아직 제출할 수 없어요.':'연구 로그인과 기본 정보 입력을 마치고 수집을 시작해 주세요.'}</p>`);return;}
    recordResearch('survey_open',{instrumentVersion:i.version});
    if(this.submitted){this.show('검사 제출', '<p>응답을 전송 대기함에 저장했습니다. 상단의 전송 상태를 확인해 주세요. 이 화면에서 점수나 피드백을 제공하지 않습니다.</p>');return;}
    let page=0;
    const render=()=>{
      const item=i.items[page];if(!item){this.show('검사','<p>문항 준비 중입니다.</p>');return;}
      this.show(i.title,`${i.draft?'<p class="research-warning">개발 확인용 문항 · 연구 검사로 사용하지 않습니다.</p>':''}<p>${page+1} / ${i.items.length}</p><fieldset class="research-likert"><legend>${esc(item.text)}</legend>${i.anchors.map((label,index)=>`<label><input type="radio" name="likert" value="${index+1}" ${this.answers[item.id]===index+1?'checked':''}><span>${index+1}</span>${esc(label)}</label>`).join('')}</fieldset><footer><button data-survey-prev ${page?'':'disabled'}>이전</button><button class="button primary" data-survey-next>${page===i.items.length-1?'응답 제출':'다음'}</button></footer>`);
      this.dialog.querySelectorAll<HTMLInputElement>('input[name=likert]').forEach(input=>input.addEventListener('change',()=>{this.answers[item.id]=Number(input.value);recordResearch('survey_answer',{itemId:item.id,value:Number(input.value),instrumentVersion:i.version});}));
      this.dialog.querySelector('[data-survey-prev]')!.addEventListener('click',()=>{page--;render();});
      this.dialog.querySelector('[data-survey-next]')!.addEventListener('click',()=>{if(this.submitting)return;if(item.required&&!this.answers[item.id]){this.message(new Error('응답 하나를 골라 주세요.'));return;}if(page<i.items.length-1){page++;render();return;}this.submitting=true;this.dialog.querySelectorAll<HTMLButtonElement|HTMLInputElement>('input,footer button').forEach(el=>el.disabled=true);const submission:SurveySubmission={submissionId:this.surveyId,version:i.version,answers:{...this.answers}};void this.collector.survey(submission).then(()=>{this.submitted=true;recordResearch('survey_submit',{instrumentVersion:i.version,count:Object.keys(submission.answers).length});this.survey();}).catch(e=>{render();this.message(e);}).finally(()=>this.submitting=false);});
    };render();
  }
}
