import { canvasPoint, PALETTE } from "./canvasUtils";

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
    tab: "노드 1개",
    title: "은닉 노드 1개는 선 하나를 찾습니다",
    body: "골과 막힘이 대각선으로 번갈아 있습니다. 어느 방향으로 선 하나를 그어도 양쪽에 골과 막힘이 함께 남습니다.",
    reveal: "은닉 노드 1개의 선 보기",
    result: "선 하나의 양쪽 모두에 골과 막힘이 섞여 있습니다.",
    question: "은닉 노드 1개만으로 네 경우를 완전히 나눌 수 있을까요?",
    choices: [["no", "나눌 수 없다"], ["yes", "나눌 수 있다"]],
    correct: "no",
    explanation: "노드 하나는 선 하나만 찾으므로 대각선의 두 골을 한 영역으로 묶지 못합니다.",
  },
  {
    tab: "노드 2개",
    title: "노드를 하나 더하면 선도 두 개가 됩니다",
    body: "첫 노드는 왼쪽·왼쪽 막힘을, 둘째 노드는 오른쪽·오른쪽 막힘을 바깥으로 나눕니다. 두 선 사이에는 골 두 개만 남습니다.",
    reveal: "두 노드가 맡은 선 함께 보기",
    result: "은닉 노드 두 개가 양쪽의 막힘을 하나씩 나누어 맡았습니다.",
    question: "두 선 사이에 남은 두 경우의 결과는 무엇일까요?",
    choices: [["goal", "골"], ["blocked", "막힘"]],
    correct: "goal",
    explanation: "선 두 개를 함께 쓰면 대각선으로 떨어진 두 골을 하나의 띠 안에 묶을 수 있습니다.",
  },
  {
    tab: "선 연습",
    title: "놓친 골을 보고 선을 옮깁니다",
    body: "회색 선은 방향이 다른 한 점을 ‘막힘’으로 틀렸습니다. 다시 연습하면 이 점이 두 선 사이에 오도록 움직입니다.",
    reveal: "대표 골 한 점과 선의 이동 보기",
    result: "회색 점선에서 보라 선까지, 대표 골이 두 선 사이에 들어오도록 조금씩 이동했습니다.",
    question: "대표 선이 보라색 위치로 움직인 직접 이유는 무엇일까요?",
    choices: [["correct", "놓친 골을 골 영역에 넣으려고"], ["random", "선은 언제나 같은 방향으로 움직여서"]],
    correct: "correct",
    explanation: "선의 방향은 미리 정해져 있지 않습니다. 지금 틀린 사례를 줄이는 쪽으로 연결값이 바뀝니다.",
  },
];

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

export function drawXorLesson(canvas: HTMLCanvasElement, step: 1 | 2 | 3 | 4, revealed: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = step === 3 && revealed ? "rgba(53,104,212,.10)" : "#f7f8fa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (step === 3 && revealed) {
    const polygon = [[-1, .65], [-.65, 1], [1, -.65], [.65, -1]].map(([x, y]) => canvasPoint(canvas, x!, y!));
    ctx.fillStyle = "rgba(241,118,5,.20)";
    ctx.beginPath();
    ctx.moveTo(...polygon[0]!);
    polygon.slice(1).forEach((point) => ctx.lineTo(...point));
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(55,67,84,.15)";
  ctx.lineWidth = 1;
  [0.25, .5, .75].forEach((ratio) => {
    ctx.beginPath(); ctx.moveTo(canvas.width * ratio, 0); ctx.lineTo(canvas.width * ratio, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height * ratio); ctx.lineTo(canvas.width, canvas.height * ratio); ctx.stroke();
  });
  if (step === 2 && revealed) {
    drawLine(ctx, canvas, 0, "#6f7784", 4, true);
    drawNodeBadge(ctx, 20, 18, "은닉 노드 1 → 선 1개", "#6f7784");
  }
  if (step === 3 && revealed) {
    drawLine(ctx, canvas, -.35, "#7446f5", 4);
    drawLine(ctx, canvas, .35, "#df466f", 4);
    drawNodeBadge(ctx, 20, 18, "은닉 노드 1", "#7446f5");
    drawNodeBadge(ctx, 20, 54, "은닉 노드 2", "#df466f");
  }
  if (step === 4) {
    drawLine(ctx, canvas, -.35, "#111827", 4);
    drawLine(ctx, canvas, -.10, "#7b8491", 3, true);
    drawNodeBadge(ctx, 20, 18, "대표 선 · 은닉 노드 2", "#7446f5");
    if (revealed) {
      [-.01, .08, .17, .26].forEach((sum, index) => drawLine(ctx, canvas, sum, `rgba(116,87,199,${.18 + index * .13})`, 3));
      drawLine(ctx, canvas, .35, "#7446f5", 5);
      const from = canvasPoint(canvas, -.05, -.05);
      const to = canvasPoint(canvas, .175, .175);
      drawArrow(ctx, from, to);
      ctx.fillStyle = "#566271";
      ctx.font = "800 13px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("연습 전", from[0] - 72, from[1] + 30);
      ctx.fillStyle = "#7446f5";
      ctx.fillText("골 점을 안쪽에 넣은 뒤", to[0] + 15, to[1] - 15);
    }
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
    ctx.globalAlpha = emphasized ? 1 : .22;
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
      ctx.strokeStyle = "#f17605";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.stroke();
      drawNodeBadge(ctx, px + 28, py - 18, "대표 오답 → 골", "#f17605");
    }
  });
}
