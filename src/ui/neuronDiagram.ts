import type { PixelModel } from "../core/pixelNetwork";
import { neuronCalculation } from "../core/neuronLesson";

const n = (v: number) => String(Number(v.toFixed(3)));
/** One real hidden neuron, with the same weights and values as the map. No decorative connections. */
export function neuronDiagram(model: PixelModel, point: number[], stage: number, phase?: number): string {
  const r = neuronCalculation(model, point), w = model.inputHidden[0]!;
  return `<div class="neuron-diagram" aria-label="입력에서 은닉 뉴런을 거쳐 A와 B로 가는 연결지도">
    <div class="neuron-inputs"><span class="${phase!==undefined&&phase<=1?'is-current':''}">가로 <b>${n(point[0]!)}</b></span><span class="${phase===2?'is-current':''}">세로 <b>${n(point[1]!)}</b></span></div>
    <div class="neuron-links"><span class="${phase===1?'arithmetic-token':''}">× ${n(w[0]!)} → <b>${phase===undefined||phase>=1?n(r.terms[0]!):'?'}</b></span><span class="${phase===2?'arithmetic-token':''}">× ${n(w[1]!)} → <b>${phase===undefined||phase>=2?n(r.terms[1]!):'?'}</b></span></div>
    <div class="neuron-box ${stage < 3 ? "is-active" : ""}"><strong>은닉 뉴런 1</strong><span>${n(r.terms[0]!)} + (${n(r.terms[1]!)}) + <mark class="bias-value">${n(model.hiddenBias[0]!)}</mark></span>${stage > 0 && (phase===undefined||phase>=4) ? `<span>합 <b>${n(r.sum)}</b> → 보낼 값 <b>${n(r.hidden[0]!)}</b></span>` : "<span>곱한 값들이 이곳에 모여요</span>"}</div>
    ${stage >= 3 ? `<div class="neuron-output-links"><span>× (−1) + 1 →</span><span>× 1 + 0 →</span></div><div class="neuron-outputs"><span style="--class-color:#f17605">A <b>${n(r.logits[0]!)}</b></span><span style="--class-color:#df466f">B <b>${n(r.logits[1]!)}</b></span></div>` : ""}
  </div>`;
}
