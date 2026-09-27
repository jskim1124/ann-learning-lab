import type { PixelModel } from '../core/pixelNetwork';
import { hiddenBoundarySegment } from './decisionSurface';
import { NEURON_COLORS } from './neuronColors';
import './trainingMotion.css';

export interface MotionFrame { epoch:number; planes:number[][]; }
/** Keep measured endpoints, never extrapolate gradient updates as a promised future path. */
export class TrainingMotionHistory {
  frames:MotionFrame[]=[];
  record(model:PixelModel):void {
    const frame={epoch:model.epoch,planes:model.inputHidden.map((w,i)=>[w[0]??0,w[1]??0,model.hiddenBias[i]??0])};
    const last=this.frames.at(-1);
    if(last&&(frame.epoch<last.epoch||frame.planes.length!==last.planes.length||frame.epoch===last.epoch&&JSON.stringify(frame.planes)!==JSON.stringify(last.planes)))this.frames=[];
    if(this.frames.at(-1)?.epoch!==frame.epoch)this.frames.push(frame);
    this.frames=this.frames.slice(-3);
  }
}
interface MotionView {history:TrainingMotionHistory;bar:HTMLElement;selected:number;enabled:boolean;}
const views=new WeakMap<HTMLCanvasElement,MotionView>();
export function installTrainingMotion(canvas:HTMLCanvasElement,network:HTMLElement,redraw:()=>void):void {
  if(views.has(canvas))return;
  const bar=document.createElement('div');bar.className='training-motion';
  bar.innerHTML='<label><input type="checkbox" checked aria-label="선 이동 흔적">이동 흔적</label><span role="status"></span>';
  canvas.before(bar);const view={history:new TrainingMotionHistory(),bar,selected:0,enabled:true};views.set(canvas,view);
  bar.querySelector('input')!.addEventListener('change',e=>{view.enabled=(e.target as HTMLInputElement).checked;redraw();});
  network.addEventListener('networkfocus',e=>{view.selected=(e as CustomEvent<{neuron:number}>).detail.neuron;redraw();});
}
export function drawTrainingMotion(canvas:HTMLCanvasElement,model:PixelModel,rect={left:0,top:0,width:canvas.width,height:canvas.height},active=true,linesVisible=true):void {
  const view=views.get(canvas);if(!view)return;view.bar.hidden=!active;if(!active){view.history.frames=[];return;}
  view.history.record(model);view.selected=Math.min(view.selected,model.hiddenUnits-1);
  const frames=view.history.frames,old=frames.at(-2),now=frames.at(-1)!;
  const status=view.bar.querySelector('span')!;
  status.textContent=!linesVisible?'분류선을 켜면 이동 흔적도 보여요.':!old?`뉴런 ${view.selected+1} · 1번 또는 10번 학습하며 다음 이동을 예상해 보세요.`:`뉴런 ${view.selected+1} · ${old.epoch} → ${now.epoch}회 · 점선 → 실선 · 화살표는 실제 이동`;
  view.bar.title='화살표는 두 학습 시점 사이의 선 위치 변화를 보여줍니다. 값이 커지는 방향 화살표와 다릅니다. 다음 학습에서는 방향이 달라지거나 선이 거의 움직이지 않을 수 있습니다.';
  if(!old||!view.enabled||!linesVisible)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const previous=old.planes[view.selected]!,current=now.planes[view.selected]!;
  const segment=hiddenBoundarySegment(previous[0]!,previous[1]!,previous[2]!);if(!segment)return;
  const map=([x,y]:number[])=>[rect.left+(x!+1)/2*rect.width,rect.top+(1-y!)/2*rect.height] as const;
  ctx.save();ctx.beginPath();ctx.rect(rect.left,rect.top,rect.width,rect.height);ctx.clip();
  ctx.strokeStyle='#808998';ctx.globalAlpha=.85;ctx.lineWidth=2;ctx.setLineDash([7,6]);ctx.beginPath();ctx.moveTo(...map(segment[0]));ctx.lineTo(...map(segment[1]));ctx.stroke();ctx.setLineDash([]);
  const color=NEURON_COLORS[view.selected%NEURON_COLORS.length]!;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=4;
  // Two anchors make rotation visible. Each arrow goes from an old-line point to its nearest new-line point.
  for(const ratio of [.3,.7]){
    const x=segment[0][0]+ratio*(segment[1][0]-segment[0][0]),y=segment[0][1]+ratio*(segment[1][1]-segment[0][1]);
    const [a,b,c]=current,denom=a!**2+b!**2;if(denom<1e-12)continue;
    const distance=(a!*x+b!*y+c!)/denom,end=[x-distance*a!,y-distance*b!];
    if(end.some(v=>v<-1||v>1))continue;
    const startPx=map([x,y]),endPx=map(end),dx=endPx[0]-startPx[0],dy=endPx[1]-startPx[1];if(Math.hypot(dx,dy)<3)continue;
    ctx.beginPath();ctx.moveTo(...startPx);ctx.lineTo(...endPx);ctx.stroke();const angle=Math.atan2(dy,dx);ctx.beginPath();ctx.moveTo(...endPx);ctx.lineTo(endPx[0]-9*Math.cos(angle-.5),endPx[1]-9*Math.sin(angle-.5));ctx.lineTo(endPx[0]-9*Math.cos(angle+.5),endPx[1]-9*Math.sin(angle+.5));ctx.closePath();ctx.fill();
  }
  ctx.restore();
}
