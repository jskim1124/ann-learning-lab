import { directionCoordinate, GOAL_BOUNDS, type GoalPick, type PenaltyRole, penaltyRecord, pickInGoal, PENALTY_AXES, PENALTY_PROJECTION, penaltyTeachingModel, penaltyPixelModel } from '../core/penalty';
import { drawPixelLatentMap } from '../visualization/pixelLatentMap';
import type { LabStore } from '../state/labStore';
import { workspacePanels } from './workspacePanels';
import { PALETTE } from '../visualization/canvasUtils';
import './penaltyWorkspace.css';

export class PenaltyCollection {
  readonly root:HTMLElement;
  private role:PenaltyRole='kicker';
  private picks:{kicker:GoalPick|null;keeper:GoalPick|null}={kicker:null,keeper:null};
  private latest:number[]=[];
  constructor(private store:LabStore,private message:(s:string)=>void){
    this.root=document.createElement('div');this.root.id='penaltyData';this.root.className='image-workspace penalty-collection';this.root.hidden=true;
    this.root.innerHTML=`<section class="image-panel penalty-source"><div class="image-heading"><h2>사진 위에서 두 방향을 골라요</h2></div><nav class="image-lesson-tabs" aria-label="승부차기 역할"><button data-penalty-role="kicker">1 키커로 슛 놓기</button><button data-penalty-role="keeper">2 골키퍼로 막기</button></nav><p id="penaltyInstruction"></p><div id="penaltyPhoto" class="penalty-photo"><img src="/illustrations/penalty-goalkeeper-photo.png" alt="골대 가운데 준비 자세를 취한 골키퍼, 수업용 생성 사진" draggable="false"><div class="penalty-goal-area" style="left:${GOAL_BOUNDS.left*100}%;top:${GOAL_BOUNDS.top*100}%;width:${GOAL_BOUNDS.width*100}%;height:${GOAL_BOUNDS.height*100}%"></div><span id="penaltyBall" class="penalty-marker ball" hidden>공</span><span id="penaltyGlove" class="penalty-marker glove" hidden>막기</span></div><div class="penalty-accessible"><span>키보드로 고르기</span><button data-penalty-side="left">왼쪽</button><button data-penalty-side="right">오른쪽</button></div><p class="penalty-caveat">좌우는 모두 키커가 골대를 보는 방향입니다. 높이와 가운데 슛은 이번 규칙에서 쓰지 않아요.</p><div class="image-capture-buttons"><button id="penaltyClear">다시 고르기</button><button id="penaltyAdd" class="button primary">이 승부차기 추가</button></div></section><section class="image-panel penalty-map-panel"><div class="image-heading"><h2>두 선택을 점 하나로</h2><span id="penaltyCount"></span></div><div id="penaltyCoordinates" aria-live="polite"></div><canvas id="penaltyMap" aria-label="선택한 슛과 골키퍼 방향의 분포, 점을 직접 추가하지 않는 결과 지도"></canvas><p>가로는 공의 좌우, 세로는 골키퍼의 좌우입니다. 사진의 높이를 세로축으로 옮긴 것이 아니에요.</p><p class="penalty-caveat">수업 규칙: 같은 쪽이면 막힘, 다른 쪽이면 골. 실제 경기 결과를 보장하지 않습니다.</p><div class="image-capture-buttons"><button id="penaltyUndo">마지막 자료 취소</button><button id="penaltyRestore">처음 자료로</button></div></section>`;
    document.querySelector('[data-app-page="2"] .page-nav')!.before(this.root);
    const legend=document.createElement('div');legend.className='penalty-map-legend';legend.innerHTML=`<span style="color:${PALETTE.zero}">● 막힘</span><span style="color:${PALETTE.one}">● 골</span>`;this.el('penaltyCoordinates').before(legend);
    workspacePanels(this.root,[...this.root.children],['사진에서 선택','분포 확인'],()=>this.render());
    this.root.addEventListener('click',e=>{
      const target=e.target as HTMLElement,role=target.closest<HTMLElement>('[data-penalty-role]')?.dataset.penaltyRole as PenaltyRole|undefined;
      if(role){this.role=role;this.render();}
      const side=target.closest<HTMLElement>('[data-penalty-side]')?.dataset.penaltySide;
      if(side)this.select({u:side==='left'?.25:.75,v:.5});
    });
    this.el('penaltyPhoto').addEventListener('click',e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect(),p=pickInGoal((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);if(p)this.select(p);else this.message('골대 안의 왼쪽 또는 오른쪽을 찍어 주세요.');});
    this.el('penaltyClear').addEventListener('click',()=>{this.reset();this.render();});
    this.el('penaltyAdd').addEventListener('click',()=>{
      if(!this.picks.kicker||!this.picks.keeper)return;
      const r=penaltyRecord(this.picks.kicker,this.picks.keeper);this.latest=[r.x,r.y];this.store.addDataPoint(r.x,r.y,r.label);
      this.el('penaltyMap').classList.remove('penalty-new-point');void this.el('penaltyMap').offsetWidth;this.el('penaltyMap').classList.add('penalty-new-point');
      this.message(`${r.label?'골':'막힘'} 사례를 (${r.x}, ${r.y})에 추가했습니다.`);
    });
    this.el('penaltyUndo').addEventListener('click',()=>{this.latest=[];this.store.undoDataPoint();});
    this.el('penaltyRestore').addEventListener('click',()=>{if(window.confirm('직접 추가한 승부차기를 지우고 시작 자료로 돌아갈까요?')){this.reset();this.store.setPreset('xor');}});
  }
  private el<T extends HTMLElement=HTMLElement>(id:string):T{return this.root.querySelector<T>('#'+id)!;}
  reset():void{this.picks={kicker:null,keeper:null};this.role='kicker';this.latest=[];}
  private select(p:GoalPick):void{this.picks[this.role]=p;this.latest=[];if(this.role==='kicker'&&!this.picks.keeper)this.role='keeper';this.render();}
  show(active:boolean):void{this.root.hidden=!active;if(active)this.render();}
  render():void{
    if(this.root.hidden)return;
    const s=this.store.snapshot;
    this.root.querySelectorAll<HTMLElement>('[data-penalty-role]').forEach(b=>{const yes=b.dataset.penaltyRole===this.role;b.classList.toggle('active',yes);b.setAttribute('aria-pressed',String(yes));});
    this.el('penaltyInstruction').textContent=this.role==='kicker'?'골대 안에서 공을 보낼 곳을 찍으세요.':'이번엔 골키퍼입니다. 몸을 던져 막을 곳을 찍으세요.';
    for(const [role,id] of [['kicker','penaltyBall'],['keeper','penaltyGlove']] as const){const p=this.picks[role],marker=this.el(id);marker.hidden=!p;if(p){marker.style.left=`${(GOAL_BOUNDS.left+p.u*GOAL_BOUNDS.width)*100}%`;marker.style.top=`${(GOAL_BOUNDS.top+p.v*GOAL_BOUNDS.height)*100}%`;}}
    const ready=!!this.picks.kicker&&!!this.picks.keeper;this.el<HTMLButtonElement>('penaltyAdd').disabled=!ready;
    this.el('penaltyCount').textContent=`${s.data.length}개 · 시작 4개는 예제`;
    const parts=([['kicker','가로 · 공'],['keeper','세로 · 골키퍼']] as const).map(([role,name])=>{const p=this.picks[role];return `<span>${name}<b>${p?`${p.u<.5?'왼쪽':'오른쪽'} ${directionCoordinate(p.u)}`:'아직 선택 전'}</b>${p?`(${p.u} − 0.5) × 2`:''}</span>`;});
    this.el('penaltyCoordinates').innerHTML=`<div class="penalty-coordinates">${parts.join('')}</div>${ready?`<strong>이 규칙의 정답: ${penaltyRecord(this.picks.kicker!,this.picks.keeper!).label?'골':'막힘'}</strong>`:'<span>두 역할에서 고르면 좌표가 완성됩니다.</span>'}`;
    const record=ready?penaltyRecord(this.picks.kicker!,this.picks.keeper!):null;
    const focus=record?[record.x,record.y]:this.latest;
    drawPixelLatentMap(this.el('penaltyMap'),penaltyPixelModel(penaltyTeachingModel()),s.data.map(p=>({pixels:[p.x,p.y],label:p.label})),focus,PENALTY_PROJECTION,{view:'placement',classColors:[PALETTE.zero,PALETTE.one],classLabels:['막힘','골'],showDataLabels:s.data.length<=12,axisLegend:PENALTY_AXES,focusLabel:this.latest.length?'방금 추가한 사례':'선택 중 · 아직 추가 전'});
    this.el<HTMLButtonElement>('penaltyUndo').disabled=!s.data.length;
  }
}
