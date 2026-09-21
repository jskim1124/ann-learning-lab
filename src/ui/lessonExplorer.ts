import type { ManualLab, ManualMission } from '../core/manualLab';
import { ManualLabWorkspace } from './manualLab';
import './lessonExplorer.css';

export function explorationChecks(lab:ManualLab):Array<{text:string;done:boolean}> {
  return lab.mission==='move' ? [
    {text:'6개 맞히기',done:lab.won&&lab.edits>0},
    {text:'계산 풀기',done:lab.calculations>0},
    {text:'변화 예상하기',done:lab.predictions>0},
  ] : [
    {text:'2뉴런으로 6개 맞히기',done:lab.won&&lab.model.hiddenUnits>=2},
    {text:'뉴런 없이 비교',done:lab.compared},
    {text:'출력 점수 계산',done:lab.outputCalculations>0},
  ];
}

/** The same manipulatives live INSIDE understanding, with the original contents always reachable. */
export class LessonExplorer {
  readonly workspace:ManualLabWorkspace;
  private host=document.createElement('div');
  private bar=document.createElement('div');
  private progress=document.createElement('div');
  private continueButton=document.createElement('button');
  private modes=document.createElement('div');
  private mission:ManualMission|null=null;
  private exploring=false;
  private priorReady=true;
  private presentation='';
  constructor(private root:HTMLElement,private panels:HTMLElement[],nav:HTMLElement,prefix:string,private redraw:()=>void,private complete:()=>void) {
    root.classList.add('lesson-integrated');
    this.bar.className='lesson-explorer-bar';this.modes.className='lesson-explorer-modes';
    this.modes.innerHTML='<button data-lesson-view="explain">원리 설명</button><button data-lesson-view="explore">직접 고치기</button>';
    this.bar.append(nav,this.modes);root.prepend(this.bar);
    this.host.className='lesson-explorer-host';this.host.hidden=true;this.bar.after(this.host);
    this.workspace=new ManualLabWorkspace(()=>({data:[],classes:['A','B'],axes:['가로','세로'],note:'원리를 익히기 위한 공통 작은 예제입니다. 실제 문제의 자료나 학습 모델과는 별개입니다.'}),{host:this.host,idPrefix:prefix,onChange:()=>this.updateProgress()});
    const footer=document.createElement('div');footer.className='lesson-explorer-footer';this.progress.className='lesson-explorer-checks';this.progress.setAttribute('aria-label','직접 해 볼 일');
    this.continueButton.className='button primary';this.continueButton.dataset.explorerNext='';footer.append(this.progress,this.continueButton);this.host.append(footer);
    this.modes.addEventListener('click',event=>{const b=(event.target as HTMLElement).closest<HTMLElement>('[data-lesson-view]');if(!b)return;this.exploring=b.dataset.lessonView==='explore';this.redraw();});
    this.continueButton.addEventListener('click',()=>{if(!this.continueButton.disabled)this.complete();});
  }
  reset():void {this.mission=null;this.exploring=false;this.presentation='';this.workspace.reset();}
  show(mission:ManualMission|null,nextLabel:string,priorReady=true):void {
    const changed=mission!==this.mission,wasHidden=this.host.hidden;
    if(mission!==this.mission){this.mission=mission;this.exploring=mission!==null;}
    const presentation=JSON.stringify([mission,this.exploring,nextLabel,priorReady]);if(presentation===this.presentation)return;this.presentation=presentation;
    this.priorReady=priorReady;this.continueButton.textContent=priorReady?nextLabel:'위 목차의 앞 내용을 먼저 확인해 주세요';
    this.modes.hidden=mission===null;this.host.hidden=!this.exploring||mission===null;
    this.root.classList.toggle('is-exploring',!this.host.hidden);
    this.panels.forEach(panel=>panel.hidden=!this.host.hidden);
    this.modes.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.lessonView==='explore')===this.exploring)));
    if(!this.host.hidden){if(changed||wasHidden)this.workspace.open(mission!);else this.updateProgress();}
  }
  private updateProgress():void {
    if(!this.mission)return;
    const checks=explorationChecks(this.workspace.lab);
    this.progress.replaceChildren(...checks.map(check=>{const item=document.createElement('span');item.className=check.done?'done':'';item.textContent=`${check.done?'✓':'○'} ${check.text}`;return item;}));
    this.continueButton.disabled=!this.priorReady||checks.some(check=>!check.done);
  }
}
