import { NEURON_PROBES, neuronCalculation, neuronLessonModel } from "../core/neuronLesson";
import { drawPixelLatentMap } from "../visualization/pixelLatentMap";
import { neuronDiagram } from "./neuronDiagram";

const n = (v: number) => String(Number(v.toFixed(2)));
const identity = { mean:[0,0], horizontal:[1,0], vertical:[0,1], horizontalScale:1, verticalScale:1 };
const axes = { horizontal:{title:"가로 입력",negative:"",positive:""}, vertical:{title:"세로 입력",negative:"",positive:""} };
const titles = ["뉴런은 숫자를 계산해서 보내는 작은 계산기예요", "‘뉴런의 합’은 이렇게 더한 수예요", "보라선: 합이 0인 점들을 이은 선", "출력은 답마다 점수를 매기는 마지막 계산기예요", "검은 경계: A와 B 점수가 같은 곳"];

export function renderNeuronIntroduction(root: HTMLElement, stage: number, selected: string): void {
  const get = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const model = neuronLessonModel();
  const keys = stage === 2 ? ["purple1", "purple2", "purple3"] : stage === 4 ? ["black1", "black2", "black3", "sideA", "tie", "sideB"] : ["input"];
  const key = keys.includes(selected) ? selected : stage === 4 ? "tie" : keys[0]!;
  const point = NEURON_PROBES[key]!.point, r = neuronCalculation(model, point);
  get("flTitle").textContent = titles[stage]!;
  get("flVisualTitle").textContent = "같은 점을 그래프와 연결지도에서 봐요";
  get("flText").textContent = [
    "입력은 앞에서 고른 가로·세로 값입니다. 은닉 뉴런은 입력과 출력 사이에서 계산해 값을 보내요. 선 자체가 뉴런은 아닙니다.",
    "연결지도 화살표 옆의 ×1과 ×0.5는 입력에 곱할 수입니다. 곱한 결과에 더해주는 값 0을 더한 것이 ‘합’입니다. 이 예제는 합이 음수면 0, 양수면 그대로 보냅니다.",
    "좌표를 하나씩 눌러 보세요. 자리는 달라도 계산한 합은 모두 0입니다. 이런 점을 이어서 뉴런의 기준선을 그립니다. 아직 A·B의 경계는 아닙니다.",
    "은닉 뉴런이 보낸 값을 ‘신호’라고 부릅니다. 이 예제의 출력 A는 1에서 신호를 빼고, B는 신호를 그대로 씁니다. 더 큰 쪽을 예상 답으로 고릅니다.",
    "세 좌표에서 A와 B는 모두 0.5입니다. 이렇게 1등이 바뀌는 자리를 이으면 검은 경계가 됩니다. 아래에서 경계 양쪽도 비교해 보세요.",
  ][stage]!;
  let calculation = "";
  if (stage === 0) calculation = '<b>입력 → 은닉 뉴런 → 출력</b><span>여기서는 계산을 쉽게 따라가도록 숫자를 정했습니다. 실제 학습에서는 연결된 수들을 고칩니다.</span>';
  if (stage === 1) calculation = '<div class="neuron-terms"><span>가로에서<br>0.2 × 1 = <b>0.2</b></span><span>세로에서<br>0.2 × 0.5 = <b>0.1</b></span><span>더해주는 값<br><b>0</b></span></div><b>합 = 0.2 + 0.1 + 0 = 0.3</b><span>0.3은 양수이므로, 다음 계산기에 0.3을 보냅니다. 0.3이 정답이나 30%라는 뜻은 아닙니다.</span>';
  if (stage === 2) calculation = `<b>(${n(point[0])} × 1) + (${n(point[1])} × 0.5) + 0 = ${n(r.sum)}</b><span>0보다 큰 쪽은 양수를 보내고, 반대쪽은 0을 보냅니다. 보라선은 이 계산의 바뀌는 자리입니다.</span>`;
  if (stage === 3) calculation = `<div class="movement-scores"><span>A: 1 − 0.3 = <b>0.7</b></span><span>B: 0.3 × 1 = <b>0.3</b></span></div><b>0.7이 더 크므로 이 점의 예상은 A</b><span>여기는 아직 퍼센트가 아니라 출력 점수를 비교하는 장면입니다.</span>`;
  if (stage === 4) calculation = `<span>(${n(point[0])} × 1) + (${n(point[1])} × 0.5) + 0 = <b>${n(r.sum)}</b> → 보낼 값 ${n(r.hidden[0]!)}</span><div class="movement-scores"><span>A: 1 − ${n(r.hidden[0]!)} = <b>${n(r.logits[0]!)}</b></span><span>B: <b>${n(r.logits[1]!)}</b></span><strong>${Math.abs(r.logits[0]!-r.logits[1]!)<1e-9?"같은 점수":r.logits[0]!>r.logits[1]!?"A로 분류":"B로 분류"}</strong></div>`;
  const probes = stage === 2 || stage === 4 ? `<div class="neuron-probes" aria-label="같은 계산을 다른 좌표에서 확인">${keys.map(k=>`<button data-neuron-probe="${k}" aria-pressed="${k===key}">${NEURON_PROBES[k]!.title}</button>`).join("")}</div>` : "";
  get("flCalculation").innerHTML = calculation + probes;
  get("flSelected").innerHTML = neuronDiagram(model, point, stage);
  get("flVisualNote").textContent = stage < 2 ? "테두리 점의 좌표가 연결지도의 입력으로 들어갑니다." : stage < 4 ? "보라선은 합 0 · 보라 화살표는 합이 커지는 쪽" : "보라선: 은닉 뉴런의 합 0 · 검은 선: 최종 출력의 1등이 바뀌는 곳";
  const boundaryPoints = (stage === 2 ? ["purple1","purple2","purple3"] : stage === 4 ? ["black1","black2","black3"] : []).map(k=>({pixels:NEURON_PROBES[k]!.point,label:stage===2?2:0}));
  drawPixelLatentMap(get("flMap"), model, boundaryPoints, point, identity, { view:stage>=3||stage===2?"decision":"placement", neutralBackground:stage<4, classLabels:stage>=4?["A","B"]:undefined, showNeuronBoundaries:stage>=2, showDecisionBoundary:stage>=4, axisLegend:axes, focusLabel:`(${n(point[0])}, ${n(point[1])})`, markerColor:stage===4?"#202633":undefined });
}
