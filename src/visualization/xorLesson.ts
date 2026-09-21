import { drawCoordinateGrid, drawCoordinateTicks } from "./coordinateGrid";
import { canvasPoint, PALETTE, probabilityColor } from "./canvasUtils";
import { NEURON_COLORS } from "./neuronColors";
import { forward, trainOne } from "../core/neuralNetwork";
import type { NetworkModel } from "../types";
import { contourCell, hiddenBoundarySegment } from "./decisionSurface";

export interface XorLessonStep {
  tab: string;
  title: string;
  body: string;
  reveal: string;
  result: string;
  question: string;
  choices: Array<[string, string]>;
  correct: string;
  explanation: string;
}

export const XOR_LESSON: XorLessonStep[] = [
  {
    tab: "네 경우",
    title: "방향이 다르면 골입니다",
    body: "점 하나는 키커와 골키퍼가 고른 방향 한 쌍입니다. 이 연습에서는 같은 방향이면 막힘, 다른 방향이면 골로 정합니다.",
    reveal: "골이 된 두 점만 진하게 보기",
    result: "왼쪽·오른쪽과 오른쪽·왼쪽, 두 골이 대각선에 떨어져 있습니다.",
    question: "이 연습에서 골이 되는 때는 언제일까요?",
    choices: [["different", "두 방향이 다를 때"], ["same", "두 방향이 같을 때"]],
    correct: "different",
    explanation: "키커가 찬 쪽과 골키퍼가 몸을 던진 쪽이 다르면 골입니다.",
  },
  {
    tab: "뉴런 1개",
    title: "은닉 뉴런 1개는 하나의 기준을 학습합니다",
    body: "골과 막힘이 대각선으로 번갈아 있습니다. 직선 하나로 한쪽에는 골만, 다른 쪽에는 막힘만 남도록 나눌 수 없습니다.",
    reveal: "은닉 뉴런 1개의 기준선 보기",
    result: "막힘 한 점이 골 두 점과 같은 쪽에 남았습니다.",
    question: "은닉 뉴런 1개만으로 네 경우를 완전히 나눌 수 있을까요?",
    choices: [["no", "나눌 수 없다"], ["yes", "나눌 수 있다"]],
    correct: "no",
    explanation: "은닉 뉴런 하나는 선 하나만 찾으므로 대각선의 두 골을 한 영역으로 묶지 못합니다.",
  },
  {
    tab: "뉴런 2개",
    title: "은닉 뉴런 두 개의 기준을 함께 사용합니다",
    body: "계산을 살펴보기 위한 예제 모델입니다. 색 선은 뉴런 각각의 기준이고, 검은 선은 두 신호를 합친 출력이 골·막힘 사이에서 바뀌는 경계입니다.",
    reveal: "두 뉴런이 맡은 선 함께 보기",
    result: "보라·분홍 기준선과 검은 최종 경계는 서로 다릅니다. 출력은 두 신호를 함께 사용합니다.",
    question: "두 선 사이에 남은 두 경우의 결과는 무엇일까요?",
    choices: [["goal", "골"], ["blocked", "막힘"]],
    correct: "goal",
    explanation: "선 두 개를 함께 쓰면 대각선으로 떨어진 두 골을 하나의 띠 안에 묶을 수 있습니다.",
  },
  {
    tab: "선 연습",
    title: "놓친 골을 보고 선을 옮깁니다",
    body: "모델이 표시한 골 한 점을 ‘막힘’으로 틀렸습니다. 이 한 점으로 실제 학습하면서 뉴런 2의 값과 골 예상이 함께 바뀌는지 봅시다.",
    reveal: "대표 골 한 점과 선의 이동 보기",
    result: "회색은 처음 선, 분홍은 학습한 뉴런 2의 선입니다. 다른 연결값도 함께 고쳤습니다. 여기서는 대표선 하나만 표시합니다.",
    question: "대표 선이 분홍색 위치로 움직인 직접 이유는 무엇일까요?",
    choices: [["correct", "놓친 골을 골 영역에 넣으려고"], ["random", "선은 언제나 같은 방향으로 움직여서"]],
    correct: "correct",
    explanation: "선의 방향은 미리 정해져 있지 않습니다. 지금 틀린 사례를 줄이는 쪽으로 연결값이 바뀝니다.",
  },
];

export const XOR_TWO_NEURON_MODEL: NetworkModel = {
  config: {hiddenUnits:2,activation:"tanh",learningRate:.08,seed:31}, epoch:0,
  parameters: {inputHidden:[[3,3],[3,3]],hiddenBias:[1.05,-1.05],hiddenOutput:[4,-4],outputBias:-3},
};

function lineSegment(sum: number): [[number, number], [number, number]] {
  return sum < 0 ? [[-1, sum + 1], [sum + 1, -1]] : [[sum - 1, 1], [1, sum - 1]];
}

function drawLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, sum: number, color: string, width = 4, dashed = false): void {
  const [a, b] = lineSegment(sum).map(([x, y]) => canvasPoint(canvas, x, y)) as [[number, number], [number, number]];
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [12, 8] : []);
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawNodeBadge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  ctx.font = "800 14px system-ui";
  const width = ctx.measureText(label).width + 20;
  ctx.fillStyle = "rgba(255,255,255,.94)";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, 29);
  ctx.strokeRect(x, y, width, 29);
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(label, x + 10, y + 20);
}

function drawArrow(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number]): void {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  ctx.strokeStyle = "#f17605";
  ctx.fillStyle = "#f17605";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.lineTo(...to);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(...to);
  ctx.lineTo(to[0] - 15 * Math.cos(angle - .55), to[1] - 15 * Math.sin(angle - .55));
  ctx.lineTo(to[0] - 15 * Math.cos(angle + .55), to[1] - 15 * Math.sin(angle + .55));
  ctx.closePath();
  ctx.fill();
}

export const XOR_FOCUS = { x: -.65, y: .65, label: 1 };
/** Every animation frame comes from the same real update used in practice, not a target line. */
export function createXorLearningTrace(): NetworkModel[] {
  let model: NetworkModel = {
    config: { hiddenUnits: 2, activation: "tanh", learningRate: .08, seed: 31 },
    parameters: { inputHidden: [[4, 4], [-4, -4]], hiddenBias: [1.4, -.4], hiddenOutput: [3, 3], outputBias: -2 },
    epoch: 0,
  };
  const trace = [model];
  for (let i = 0; i < 30; i++) { model = trainOne(model, [XOR_FOCUS]); trace.push(model); }
  return trace;
}
const LEARNING_TRACE = createXorLearningTrace();

function drawActualLearning(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, progress: number): void {
  const model = LEARNING_TRACE[Math.round(Math.max(0, Math.min(1, progress)) * 30)]!;
  const initial = LEARNING_TRACE[0]!;
  const cells = 48, cw = canvas.width / cells, ch = canvas.height / cells;
  const values = Array.from({ length: cells + 1 }, (_, r) => Array.from({ length: cells + 1 }, (_, c) => forward(model, -1 + c / cells * 2, 1 - r / cells * 2).probability));
  for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
    ctx.fillStyle = probabilityColor(forward(model, -1 + (c + .5) / cells * 2, 1 - (r + .5) / cells * 2).probability);
    ctx.fillRect(c * cw, r * ch, cw + 1, ch + 1);
  }
  ctx.strokeStyle = "#111827"; ctx.lineWidth = 3; ctx.beginPath();
  for (let r = 0; r < cells; r++) for (let c = 0; c < cells; c++) {
    contourCell([[c * cw,r * ch,values[r]![c]!],[(c+1)*cw,r*ch,values[r]![c+1]!],[(c+1)*cw,(r+1)*ch,values[r+1]![c+1]!],[c*cw,(r+1)*ch,values[r+1]![c]!]]).forEach(([a,b]) => {ctx.moveTo(...a);ctx.lineTo(...b);});
  }
  ctx.stroke();
  const line = (m: NetworkModel, dashed: boolean) => {
    const weights = m.parameters.inputHidden[1]!;
    const segment = hiddenBoundarySegment(weights[0], weights[1], m.parameters.hiddenBias[1]!);
    if (!segment) return;
    const a = canvasPoint(canvas, ...segment[0]), b = canvasPoint(canvas, ...segment[1]);
    ctx.strokeStyle = dashed ? "#7b8491" : NEURON_COLORS[1]!; ctx.lineWidth = dashed ? 3 : 5; ctx.setLineDash(dashed ? [10,7] : []);
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
  };
  line(initial, true); line(model, false);
  const nearest = (m: NetworkModel): [number, number] => {
    const [a,b] = m.parameters.inputHidden[1]!, bias = m.parameters.hiddenBias[1]!;
    const distance = (a*XOR_FOCUS.x + b*XOR_FOCUS.y + bias)/(a*a+b*b);
    return canvasPoint(canvas, XOR_FOCUS.x-a*distance, XOR_FOCUS.y-b*distance);
  };
  if (progress > 0) drawArrow(ctx, nearest(initial), nearest(model));
  const before = forward(initial,XOR_FOCUS.x,XOR_FOCUS.y);
  const current = forward(model,XOR_FOCUS.x,XOR_FOCUS.y);
  drawNodeBadge(ctx, 16, 14, "분홍: 뉴런 2의 선 · 검정: 최종 경계", NEURON_COLORS[1]!);
  drawNodeBadge(ctx, 16, canvas.height*.44, `표시한 골의 뉴런 2 신호: ${before.hidden[1]!.toFixed(2)} → ${current.hidden[1]!.toFixed(2)}`, NEURON_COLORS[1]!);
  drawNodeBadge(ctx, 16, canvas.height*.44+35, `골 예상: ${(before.probability*100).toFixed(2)}% → ${(current.probability*100).toFixed(2)}% · ${model.epoch}번 학습`, "#253247");
}

export function drawXorLesson(canvas: HTMLCanvasElement, step: 1 | 2 | 3 | 4, revealed: boolean, progress = 1): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const revealProgress = revealed ? Math.max(0, Math.min(1, progress)) : 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = step === 3 && revealed ? `rgba(53,104,212,${.10 * revealProgress})` : "#f7f8fa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (step === 4) drawActualLearning(ctx, canvas, revealProgress);
  if (step === 3 && revealed) {
    const grid=120, cw=canvas.width/grid, ch=canvas.height/grid;
    const values=Array.from({length:grid+1},(_,r)=>Array.from({length:grid+1},(_,c)=>forward(XOR_TWO_NEURON_MODEL,-1+2*c/grid,1-2*r/grid).probability));
    ctx.save();ctx.globalAlpha=revealProgress;
    for(let r=0;r<grid;r++)for(let c=0;c<grid;c++){ctx.fillStyle=probabilityColor(values[r]![c]!);ctx.fillRect(c*cw,r*ch,cw+1,ch+1);}
    ctx.strokeStyle="#202633";ctx.lineWidth=3;ctx.lineCap="round";ctx.beginPath();
    for(let r=0;r<grid;r++)for(let c=0;c<grid;c++)for(const [a,b] of contourCell([[c*cw,r*ch,values[r]![c]!],[(c+1)*cw,r*ch,values[r]![c+1]!],[(c+1)*cw,(r+1)*ch,values[r+1]![c+1]!],[c*cw,(r+1)*ch,values[r+1]![c]!]],.5)){ctx.moveTo(...a);ctx.lineTo(...b);}
    ctx.stroke();ctx.restore();
  }
  drawCoordinateGrid(ctx, {left:0, top:0, width:canvas.width, height:canvas.height});
  drawCoordinateTicks(ctx, {left:0, top:0, width:canvas.width, height:canvas.height});
  if (step === 2 && revealed) {
    ctx.save(); ctx.globalAlpha = revealProgress;
    drawLine(ctx, canvas, .3, "#6f7784", 4, true);
    drawNodeBadge(ctx, 20, 18, "은닉 뉴런 1 → 선 1개", "#6f7784"); ctx.restore();
  }
  if (step === 3 && revealed) {
    ctx.save(); ctx.globalAlpha = revealProgress;
    drawLine(ctx, canvas, -.35, "#7446f5", 4);
    drawLine(ctx, canvas, .35, "#df466f", 4);
    drawNodeBadge(ctx, 20, 18, "은닉 뉴런 1", "#7446f5");
    drawNodeBadge(ctx, 20, 54, "은닉 뉴런 2", "#df466f"); ctx.restore();
  }

  const cases = [
    { x: -.65, y: -.65, goal: false, label: "왼쪽 · 왼쪽" },
    { x: -.65, y: .65, goal: true, label: "왼쪽 · 오른쪽" },
    { x: .65, y: -.65, goal: true, label: "오른쪽 · 왼쪽" },
    { x: .65, y: .65, goal: false, label: "오른쪽 · 오른쪽" },
  ];
  cases.forEach(({ x, y, goal, label }) => {
    const [px, py] = canvasPoint(canvas, x, y);
    const emphasized = !revealed || step !== 1 || goal;
    ctx.globalAlpha = emphasized ? 1 : 1 - .78 * revealProgress;
    ctx.fillStyle = goal ? PALETTE.one : PALETTE.zero;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (goal) ctx.rect(px - 12, py - 12, 24, 24);
    else ctx.arc(px, py, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#253247";
    ctx.font = "800 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(goal ? "골" : "막힘", px, py - 22);
    ctx.font = "700 14px system-ui";
    ctx.fillText(label, px, py + 34);
    ctx.globalAlpha = 1;
    if (step === 4 && revealed && goal && x < 0) {
      ctx.globalAlpha = .35 + .65 * revealProgress;
      ctx.strokeStyle = "#f17605";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  });
}
