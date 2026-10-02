import type { ExplorationSource } from '../core/explorationSource';
import { MAP_MARGIN } from '../visualization/pixelLatentMap';
import type { Coordinate, ProjectionPlan } from './projectionMotion';
import { featureExpression, featureGroups, featureNumber as n, featurePicture } from './featureTrace';
import type { Payload } from '../research/schema';
import './dataProjection.css';
type ProjectionEvent='start'|'pause'|'resume'|'complete'|'skip'|'cancel'|'example';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const READ_MS=4200,MOVE_MS=1200,ease=(t:number)=>t*t*(3-2*t);
/** Explain a real feature first. Only its calculated number travels; no fake image compression. */
export class DataProjection {
  private source!:ExplorationSource;private plan:ProjectionPlan|null=null;
  private raf=0;private elapsed=0;private lastTime=0;private paused=false;
  private axis:0|1=0;private sample=0;private waitingForAxis=false;private stageKey='';
  private points:(Coordinate|null)[]|null=null;
  readonly dock:HTMLElement;private flyer:HTMLElement;private canvas:HTMLCanvasElement;
  constructor(private host:HTMLElement,private redraw:()=>void,private log:(operation:ProjectionEvent,axis:number,completed:boolean,values?:Payload)=>void,private replay:()=>void,private stateChanged:()=>void=()=>{}) {
    this.canvas=host.querySelector('canvas')!;
    this.dock=document.createElement('div');this.dock.className='explore-projection';
    this.dock.innerHTML='<div class="projection-stack"></div><div class="projection-caption" role="status" aria-live="polite"></div><div class="projection-tools"><button data-projection-play>다시 보기</button><button data-projection-skip hidden>결과 보기</button></div>';
    (host.querySelector('.plot-aspect-slot')??host.querySelector('.explore-map'))!.after(this.dock);
    this.flyer=document.createElement('div');this.flyer.className='projection-flyer';this.flyer.hidden=true;host.append(this.flyer);
    this.dock.addEventListener('click',event=>{
      event.stopPropagation();const b=(event.target as Element).closest('button');
      if(b?.hasAttribute('data-projection-skip'))this.finish('skip');
      else if(b?.hasAttribute('data-projection-play')){
        if(!this.plan)this.replay();
        else {this.paused=!this.paused;this.log(this.paused?'pause':'resume',this.axis,false);this.buttons();if(this.paused)cancelAnimationFrame(this.raf);else this.schedule();}
      }
    });
  }
  get running(){return this.plan!==null;}
  get positions(){return this.points;}
  setSource(source:ExplorationSource,visible:boolean,oneAxis:boolean,waitingForAxis=false,sample=0):void {
    this.source=source;this.dock.hidden=!visible;this.waitingForAxis=waitingForAxis;
    if(!visible){this.cancel();return;}
    if(!this.running){this.sample=Math.min(sample,Math.max(0,source.data.length-1));this.idle(oneAxis);}
  }
  private picture(phase=0,column=0):void {
    const pixels=this.source.pictures?.[this.sample],id=this.source.featureIds?.[this.axis]??'';
    this.dock.querySelector('.projection-stack')!.innerHTML=pixels?featurePicture(pixels,id,phase,column):'<span>'+esc(this.source.records?.[this.sample]?.name??(this.sample+1)+'번 자료')+'</span>';
  }
  private caption(title:string,body:string,note=''):void {
    this.dock.querySelector('.projection-caption')!.innerHTML='<strong>'+esc(title)+'</strong><span>'+body+'</span>'+(note?'<small>'+esc(note)+'</small>':'');
  }
  private idle(oneAxis:boolean):void {
    this.picture();this.buttons();
    this.caption((this.sample+1)+'번 자료 한 개로 계산해요',this.waitingForAxis?'가로 특징을 고르면 계산이 시작돼요.':oneAxis?'같은 자료에서 세로 특징도 골라 보세요.':'특징을 바꾸면 이 그림의 계산과 이동을 보여줘요.');
  }
  start(mode:ProjectionPlan['mode'],from:Coordinate[],to:Coordinate[],axis:0|1,sample=0,explain=true):void {
    this.cancel();this.axis=axis;this.sample=Math.max(0,Math.min(sample,to.length-1));this.elapsed=0;this.paused=false;this.stageKey='';
    this.plan={mode,from:from.map(p=>[...p]),to:to.map(p=>[...p]),examples:[this.sample],duration:(explain?READ_MS:0)+MOVE_MS};
    this.points=mode==='place'?to.map(()=>null):from;
    this.buttons();this.stateChanged();this.log('start',axis,false);
    const c=this.source.axisCalculation?.(this.sample,axis);
    const numeric=this.source.numericCalculation?.(this.sample,axis);
    if(to.length)this.log('example',axis,false,{sampleId:this.sample,coordinates:[...to[this.sample]!],coordinateSpace:'feature-plane',values:c?[c.total,c.mean,c.scale]:numeric?[numeric.value,numeric.low,numeric.high]:[to[this.sample]![axis]]});
    if(!to.length||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){this.finish('complete');return;}
    this.render();this.redraw();this.schedule();
  }
  private schedule():void {this.lastTime=performance.now();this.raf=requestAnimationFrame(t=>this.tick(t));}
  private tick(time:number):void {
    if(!this.plan||this.paused)return;
    this.elapsed+=Math.max(0,time-this.lastTime);this.lastTime=time;
    if(this.elapsed>=this.plan.duration){this.finish('complete');return;}
    const start=this.plan.duration-MOVE_MS,t=ease(Math.max(0,Math.min(1,(this.elapsed-start)/MOVE_MS))),p=this.plan;
    if(p.mode==='shift')this.points=p.to.map((point,i)=>{const from=p.from[i]??point;return [from[0]+(point[0]-from[0])*t,from[1]+(point[1]-from[1])*t];});
    else this.points=p.to.map((point,i)=>t>.8||i===this.sample&&t>.65?point:null);
    this.render();this.redraw();this.raf=requestAnimationFrame(t=>this.tick(t));
  }
  cancel():void {
    cancelAnimationFrame(this.raf);this.raf=0;const running=this.running;
    if(running)this.log('cancel',this.axis,false);
    this.plan=null;this.points=null;this.flyer.hidden=true;this.dock.removeAttribute('data-stage');
    if(running){this.buttons();this.stateChanged();}
  }
  private finish(operation:'complete'|'skip'):void {
    if(!this.plan)return;cancelAnimationFrame(this.raf);this.plan=null;this.points=null;this.flyer.hidden=true;
    this.dock.dataset.stage='done';this.buttons();this.stateChanged();this.log(operation,this.axis,true);
    const c=this.source.axisCalculation?.(this.sample,this.axis),title=this.axis===0?'가로':'세로';
    this.caption(title+' 좌표 '+n(this.source.data[this.sample]?.pixels[this.axis]??0),c?esc(featureExpression(this.source.featureIds?.[this.axis]??'',c)):'계산한 값을 좌표로 놓았어요.','나머지 자료에도 같은 계산을 적용했어요.');this.redraw();
  }
  private buttons():void {
    (this.dock.querySelector('[data-projection-play]') as HTMLElement).hidden=this.waitingForAxis&&!this.running;
    this.dock.querySelector('[data-projection-play]')!.textContent=this.running?this.paused?'계속 보기':'잠깐 멈춤':'다시 보기';
    (this.dock.querySelector('[data-projection-skip]') as HTMLElement).hidden=!this.running;
  }
  render():void {
    if(!this.plan)return;
    const p=this.plan,start=p.duration-MOVE_MS,phase=this.elapsed>=start?4:Math.min(3,Math.floor(this.elapsed/1050)),id=this.source.featureIds?.[this.axis]??'';
    const column=Math.min(13,Math.floor(Math.max(0,this.elapsed-1050)/150)),key=phase+':'+(id==='position'?column:0);
    const c=this.source.axisCalculation?.(this.sample,this.axis),title=this.axis===0?'가로':'세로';
    if(key!==this.stageKey){
      this.stageKey=key;this.dock.dataset.stage=String(phase);this.picture(phase===0?0:Math.min(phase,2),column);
      const groups=c?featureGroups(id,c):[];
      let body=phase===0?'흰 칸은 0, 검은 칸은 1 · 회색은 그 사이':phase===3&&c?'('+n(c.total)+' − 평균 '+n(c.mean)+') ÷ '+(c.scale<.005?'0.01보다 작은 간격':'간격 '+n(c.scale))+' ≈ <b>'+n(c.coordinate)+'</b>':c?esc(featureExpression(id,c)):esc(this.source.axes[this.axis]);
      if(c&&(phase===1||phase===2)){
        const g=groups[id==='position'?column:Math.min(phase-1,groups.length-1)]!;
        body=esc(g.name)+' = <b>'+n(g.value)+'</b>';
        if(id==='position'){const ink=c.terms.filter((_,i)=>i%14===column).reduce((s,t)=>s+t.pixel,0);body=(column+1)+'열의 진하기 '+n(ink)+' × '+(column+1)+' = <b>'+n(g.value)+'</b>';}
      }
      if(!c&&this.source.numericCalculation){const v=this.source.numericCalculation(this.sample,this.axis);body='기록한 값 '+n(v.value)+' → '+title+' 좌표 '+n(v.coordinate);}
      if(!c&&!this.source.numericCalculation)body=esc(this.source.axes[this.axis])+' '+n(p.to[this.sample]?.[this.axis]??0);
      this.caption(phase===4?title+' 위치로 이동':(this.sample+1)+'번 자료 · '+(phase===0?'원본':phase===3?'좌표 눈금으로 바꾸기':this.source.features?.find(f=>f.id===id)?.name??title),body,phase===3?'모든 자료에 같은 평균과 간격을 씁니다.':'');
    }
    this.flyer.hidden=phase!==4;if(this.flyer.hidden)return;
    const host=this.host.getBoundingClientRect(),card=this.dock.querySelector('.projection-stack')!.getBoundingClientRect(),canvas=this.canvas.getBoundingClientRect(),point=p.to[this.sample]!;
    const sx=card.left-host.left+card.width/2,sy=card.top-host.top+card.height/2;
    const x=canvas.left-host.left+MAP_MARGIN.left+(point[0]+1)/2*(canvas.width-MAP_MARGIN.left-MAP_MARGIN.right),y=canvas.top-host.top+MAP_MARGIN.top+(1-point[1])/2*(canvas.height-MAP_MARGIN.top-MAP_MARGIN.bottom),t=ease(Math.min(1,(this.elapsed-start)/MOVE_MS));
    this.flyer.textContent=title+' '+n(point[this.axis]);this.flyer.style.left=(sx+(x-sx)*t)+'px';this.flyer.style.top=(sy+(y-sy)*t)+'px';this.flyer.style.opacity=String(t>.85?(1-t)/.15:1);
  }
}
