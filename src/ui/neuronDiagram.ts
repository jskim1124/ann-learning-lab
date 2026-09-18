import type { PixelModel } from "../core/pixelNetwork";
import { neuronCalculation } from "../core/neuronLesson";

const n = (v: number) => String(Number(v.toFixed(2)));
/** One real hidden neuron, with the same weights and values as the map. No decorative connections. */
export function neuronDiagram(model: PixelModel, point: number[], stage: number): string {
  const r = neuronCalculation(model, point), w = model.inputHidden[0]!;
  return `<div class="neuron-diagram" aria-label="입력에서 은닉 뉴런을 거쳐 A와 B로 가는 연결지도">
    <div class="neuron-inputs"><span>가로 <b>${n(point[0]!)}</b></span><span>세로 <b>${n(point[1]!)}</b></span></div>
    <div class="neuron-links"><span>× ${n(w[0]!)} →</span><span>× ${n(w[1]!)} →</span></div>
    <div class="neuron-box ${stage < 3 ? "is-active" : ""}"><strong>은닉 뉴런 1개</strong><span>곱한 값 + 더해주는 값 ${n(model.hiddenBias[0]!)}</span>${stage > 0 ? `<span>합 <b>${n(r.sum)}</b> → 보낼 값 <b>${n(r.hidden[0]!)}</b></span>` : "<span>합이 음수면 0 보내기</span>"}</div>
    ${stage >= 3 ? `<div class="neuron-output-links"><span>1 − 신호 →</span><span>신호 그대로 →</span></div><div class="neuron-outputs"><span>A <b>${n(r.logits[0]!)}</b></span><span>B <b>${n(r.logits[1]!)}</b></span></div>` : ""}
  </div>`;
}
