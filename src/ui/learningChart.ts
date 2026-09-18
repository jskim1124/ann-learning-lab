import type { HistoryPoint } from "../types";
import { exampleLoss, exampleMinima, descentTrace } from "../core/optimizationExample";

export type ChartMetric="loss"|"accuracy";
interface ChartState { metric:ChartMetric; zoom:boolean; history:HistoryPoint[]; draw:()=>void; }
const states=new WeakMap<HTMLCanvasElement,ChartState>();
export function chartControls(canvas:HTMLCanvasElement,history:HistoryPoint[],draw:()=>void):ChartState {
  let state=states.get(canvas);if(state){state.history=history;state.draw=draw;return state;}
  state={metric:"accuracy",zoom:true,history,draw};states.set(canvas,state);
  const parent=canvas.parentElement;if(!parent)return state;
  parent.classList.add("learning-chart");
  [...parent.children].filter(e=>e!==canvas).forEach(e=>e.remove());
  const bar=document.createElement("div");bar.className="learning-chart-controls";
  bar.innerHTML='<div role="group" aria-label="학습 그래프 종류"><button data-metric="loss" aria-pressed="false">오차</button><button data-metric="accuracy" aria-pressed="true">학습 정답률</button></div><label><input type="checkbox" data-chart-zoom checked> 차이 확대</label><button data-chart-help>그래프 읽는 법</button>';
  parent.prepend(bar);
  const current=state;
  bar.addEventListener("click",e=>{const b=(e.target as HTMLElement).closest<HTMLButtonElement>("[data-metric]");if(b){current.metric=b.dataset.metric as ChartMetric;bar.querySelectorAll<HTMLElement>("[data-metric]").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));current.draw();}if((e.target as HTMLElement).closest("[data-chart-help]"))openChartHelp();});
  bar.querySelector<HTMLInputElement>("[data-chart-zoom]")!.addEventListener("change",e=>{current.zoom=(e.target as HTMLInputElement).checked;current.draw();});
  return state;
}

let help:HTMLDialogElement|null=null,animation=0;
function stop(){window.cancelAnimationFrame(animation);animation=0;}
export function openChartHelp():void {
  if(!help||!help.isConnected){
    help=document.createElement("dialog");help.className="learning-chart-help";help.setAttribute("aria-label","오차와 정답률, 최적점 알아보기");
    help.innerHTML='<header><h2>오차와 정답률은 달라요</h2><button data-close aria-label="그래프 설명 닫기">×</button></header><nav><button data-chart-topic="metrics" aria-pressed="true">오차와 정답률</button><button data-chart-topic="landscape" aria-pressed="false">전역·지역 최적점</button></nav><section data-chart-page="metrics"><p>정답 B를 51%로 골라도, 99%로 골라도 둘 다 맞힌 답입니다. 정답률은 같지만 정답에 더 높은 점수를 준 쪽의 오차가 작습니다.</p><div class="loss-comparison"><span>B 51%<b>정답률 100% · 오차 0.673</b></span><span>B 99%<b>정답률 100% · 오차 0.010</b></span></div><p><b>연습 그래프</b>의 가로축은 학습 횟수입니다. 선이 멈췄다는 이유만으로 가장 좋은 모델을 찾았다고 할 수 없습니다.</p></section><section data-chart-page="landscape" hidden><h3>최적점은 ‘오차 지형’으로 따로 볼까요?</h3><p>아래는 원리 설명용 모형입니다. 실제 내 모델의 학습 기록이 아닙니다. 가로축은 학습 횟수가 아니라 <b>바꾸는 값 하나</b>입니다.</p><canvas width="650" height="240" aria-label="서로 다른 높이의 두 골짜기가 있는 예제 오차 지형"></canvas><div class="landscape-actions"><button data-descent="-1.5">왼쪽에서 출발 ▶</button><button data-descent="1.5">오른쪽에서 출발 ▶</button></div><p data-landscape-status role="status">오차가 낮아지는 쪽으로 내려가 보세요.</p><p class="chart-caveat">주변보다 낮은 곳은 지역 최적, 전체에서 가장 낮은 곳은 전역 최적입니다. 실제 신경망에는 바꾸는 값이 많이 있습니다. 정답률이 높아도 새 자료에서 잘 맞히는지는 따로 확인해야 합니다.</p></section>';
    document.body.append(help);
    help.addEventListener("close",stop);help.addEventListener("cancel",stop);
    help.addEventListener("click",e=>{const target=e.target as HTMLElement;const topic=target.closest<HTMLElement>("[data-chart-topic]");if(topic){stop();help!.querySelectorAll<HTMLElement>("[data-chart-page]").forEach(p=>p.hidden=p.dataset.chartPage!==topic.dataset.chartTopic);help!.querySelectorAll<HTMLElement>("[data-chart-topic]").forEach(b=>b.setAttribute("aria-pressed",String(b===topic)));drawLandscape(null);}if(target.closest("[data-close]")){help!.close();return;}const b=target.closest<HTMLElement>("[data-descent]");if(b)animateLandscape(Number(b.dataset.descent));});
  }
  help.showModal();drawLandscape(null);
}
function drawLandscape(value:number|null){
  const canvas=help!.querySelector("canvas")!,ctx=canvas.getContext("2d");if(!ctx)return;
  const w=canvas.width,h=canvas.height,px=(x:number)=>45+(x+1.6)/3.2*(w-65),py=(v:number)=>h-40-v/4*(h-65);
  ctx.clearRect(0,0,w,h);ctx.strokeStyle="#dce1ea";ctx.lineWidth=1;for(let i=0;i<=3;i++){ctx.beginPath();ctx.moveTo(45,py(i));ctx.lineTo(w-20,py(i));ctx.stroke();}
  ctx.strokeStyle="#1f6bd6";ctx.lineWidth=3;ctx.beginPath();for(let i=0;i<=160;i++){const x=-1.6+i*.02; if(i===0)ctx.moveTo(px(x),py(exampleLoss(x)));else ctx.lineTo(px(x),py(exampleLoss(x)));}ctx.stroke();
  const minima=exampleMinima();ctx.font="bold 15px sans-serif";ctx.textAlign="center";
  minima.forEach((x,i)=>{ctx.fillStyle=i===0?"#7446f5":"#df466f";ctx.beginPath();ctx.arc(px(x),py(exampleLoss(x)),5,0,Math.PI*2);ctx.fill();ctx.fillText(i===0?"전체에서 가장 낮음 (전역)":"이웃에서 가장 낮음 (지역)",px(x),py(exampleLoss(x))+26);});
  if(value!==null){ctx.fillStyle="#f17605";ctx.beginPath();ctx.arc(px(value),py(exampleLoss(value)),9,0,Math.PI*2);ctx.fill();ctx.strokeStyle="white";ctx.lineWidth=2;ctx.stroke();}
  ctx.fillStyle="#596574";ctx.font="14px sans-serif";ctx.fillText("바꾸는 값 하나 →",w/2,h-5);ctx.textAlign="left";ctx.fillText("오차 ↑",5,17);
}
function animateLandscape(start:number){
  stop();const trace=descentTrace(start),status=help!.querySelector<HTMLElement>("[data-landscape-status]")!;
  const done=()=>{status.textContent=start<0?"왼쪽은 이 모형 전체에서 가장 낮은 곳에 도착했습니다.":"오른쪽은 이웃보다 낮지만, 왼쪽에 더 낮은 곳이 있습니다. 낮아지는 방향만 따라가면 여기서 멈춥니다.";};
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){drawLandscape(trace.at(-1)!);done();return;}
  const began=performance.now();const tick=(now:number)=>{const progress=Math.min(trace.length-1,(now-began)/40),i=Math.floor(progress),next=Math.min(i+1,trace.length-1),x=trace[i]!+(trace[next]!-trace[i]!)*(progress-i);drawLandscape(x);status.textContent=`바꾸는 값 ${x.toFixed(2)} · 오차 ${exampleLoss(x).toFixed(3)}`;if(progress<trace.length-1)animation=window.requestAnimationFrame(tick);else{animation=0;done();}};animation=window.requestAnimationFrame(tick);
}
