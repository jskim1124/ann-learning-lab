import { canvasPoint, PALETTE } from "./canvasUtils";

export interface SwitchLessonStep {
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

export const SWITCH_LESSON: SwitchLessonStep[] = [
  { tab: "네 경우", title: "두 스위치가 다를 때만 켜집니다", body: "점 하나는 두 스위치의 한 가지 조합입니다. 같은 방향인 두 점은 꺼짐, 다른 방향인 두 점은 켜짐입니다.", reveal: "켜지는 두 점만 진하게 보기", result: "켜짐 두 점은 서로 대각선에 떨어져 있습니다.", question: "전등이 켜지는 때는 언제일까요?", choices: [["different", "두 스위치가 다를 때"], ["same", "두 스위치가 같을 때"]], correct: "different", explanation: "한쪽은 위, 다른 쪽은 아래일 때 전등이 켜집니다." },
  { tab: "노드 1개", title: "은닉 노드 1개는 선 하나를 찾습니다", body: "은닉 노드는 점들을 나눌 선 하나를 맡습니다. 하지만 켜짐과 꺼짐이 대각선으로 번갈아 있어, 선 하나의 양쪽에는 두 답이 함께 남습니다.", reveal: "은닉 노드 1개의 선 보기", result: "선 하나의 양쪽 모두에 켜짐과 꺼짐이 섞여 있습니다.", question: "은닉 노드 1개만으로 네 점을 완전히 나눌 수 있을까요?", choices: [["no", "나눌 수 없다"], ["yes", "나눌 수 있다"]], correct: "no", explanation: "노드 하나는 선 하나만 찾으므로 대각선의 두 켜짐 점을 한 영역으로 만들 수 없습니다." },
  { tab: "노드 2개", title: "은닉 노드를 하나 더하면 선도 두 개가 됩니다", body: "첫 노드는 아래·아래 꺼짐을 떼고, 둘째 노드는 위·위 꺼짐을 떼는 선을 맡습니다. 두 선 사이에는 켜짐 두 점만 남습니다.", reveal: "두 노드가 맡은 선 함께 보기", result: "은닉 노드 두 개가 바깥쪽 꺼짐을 하나씩 나누어 맡았습니다.", question: "은닉 노드 2개가 만든 두 선 사이에는 무엇이 남나요?", choices: [["on", "켜짐 두 점"], ["off", "꺼짐 두 점"]], correct: "on", explanation: "선 두 개를 함께 쓰면 가운데의 켜짐 두 점을 하나의 영역으로 묶을 수 있습니다." },
  { tab: "선 연습", title: "오답을 본 대표 선은 알맞은 쪽으로 조금씩 움직입니다", body: "처음 선은 임의의 위치에서 시작해 켜짐 점 하나를 잘못 나눕니다. 그 오답을 다시 연습할 때마다 선이 위·오른쪽으로 조금씩 움직여, 켜짐은 두 선 사이에 남기고 위·위 꺼짐은 밖으로 보냅니다.", reveal: "대표 선의 이동 순서 보기", result: "회색 점선에서 보라 선까지, 오답이 줄어드는 방향으로 여러 번 조금씩 이동했습니다.", question: "대표 선이 위·오른쪽으로 움직인 까닭은 무엇일까요?", choices: [["correct", "켜짐 점은 안쪽에 남기고 꺼짐 점은 밖으로 보내려고"], ["random", "항상 같은 방향으로 움직이도록 정해져 있어서"]], correct: "correct", explanation: "선의 방향은 고정된 규칙이 아니라, 지금 틀린 점을 줄이는 쪽으로 연결값이 바뀌며 정해집니다." },
];

function lineSegment(sum: number): [[number, number], [number, number]] {
  return sum < 0 ? [[-1, sum + 1], [sum + 1, -1]] : [[sum - 1, 1], [1, sum - 1]];
}

function drawLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, sum: number, color: string, width = 4, dashed = false): void {
  const [a, b] = lineSegment(sum).map(([x, y]) => canvasPoint(canvas, x, y)) as [[number, number], [number, number]];
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [12, 8] : []); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
}

function drawNodeBadge(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string): void {
  ctx.font = "800 14px system-ui"; const width = ctx.measureText(label).width + 20;
  ctx.fillStyle = "rgba(255,255,255,.94)"; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillRect(x, y, width, 29); ctx.strokeRect(x, y, width, 29);
  ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(label, x + 10, y + 20);
}

function drawArrow(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number]): void {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]); ctx.strokeStyle = "#c78100"; ctx.fillStyle = "#c78100"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(...from); ctx.lineTo(...to); ctx.stroke(); ctx.beginPath(); ctx.moveTo(...to); ctx.lineTo(to[0] - 15 * Math.cos(angle - .55), to[1] - 15 * Math.sin(angle - .55)); ctx.lineTo(to[0] - 15 * Math.cos(angle + .55), to[1] - 15 * Math.sin(angle + .55)); ctx.closePath(); ctx.fill();
}

export function drawSwitchLesson(canvas: HTMLCanvasElement, step: 1 | 2 | 3 | 4, revealed: boolean): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = step === 3 && revealed ? "rgba(53,104,212,.10)" : "#f7f8fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (step === 3 && revealed) {
    const polygon = [[-1, .65], [-.65, 1], [1, -.65], [.65, -1]].map(([x, y]) => canvasPoint(canvas, x!, y!));
    ctx.fillStyle = "rgba(241,118,5,.20)"; ctx.beginPath(); ctx.moveTo(...polygon[0]!); polygon.slice(1).forEach((point) => ctx.lineTo(...point)); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "rgba(55,67,84,.15)"; ctx.lineWidth = 1;
  [0.25, .5, .75].forEach((ratio) => { ctx.beginPath(); ctx.moveTo(canvas.width * ratio, 0); ctx.lineTo(canvas.width * ratio, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, canvas.height * ratio); ctx.lineTo(canvas.width, canvas.height * ratio); ctx.stroke(); });
  if (step === 2 && revealed) { drawLine(ctx, canvas, 0, "#6f7784", 4, true); drawNodeBadge(ctx, 20, 18, "은닉 노드 1 → 선 1개", "#6f7784"); }
  if (step === 3 && revealed) { drawLine(ctx, canvas, -.35, "#6a4bbc", 4); drawLine(ctx, canvas, .35, "#00897b", 4); drawNodeBadge(ctx, 20, 18, "은닉 노드 1", "#6a4bbc"); drawNodeBadge(ctx, 20, 54, "은닉 노드 2", "#00897b"); }
  if (step === 4) {
    drawLine(ctx, canvas, -.35, "#111827", 4); drawLine(ctx, canvas, -.10, "#7b8491", 3, true); drawNodeBadge(ctx, 20, 18, "대표 선 · 은닉 노드 2", "#7457c7");
    if (revealed) {
      [-.01, .08, .17, .26].forEach((sum, index) => drawLine(ctx, canvas, sum, `rgba(116,87,199,${.18 + index * .13})`, 3));
      drawLine(ctx, canvas, .35, "#7457c7", 5);
      const from = canvasPoint(canvas, -.05, -.05); const to = canvasPoint(canvas, .175, .175); drawArrow(ctx, from, to);
      ctx.fillStyle = "#566271"; ctx.font = "800 13px system-ui"; ctx.textAlign = "left"; ctx.fillText("연습 전", from[0] - 72, from[1] + 30); ctx.fillStyle = "#7457c7"; ctx.fillText("오답을 줄인 뒤", to[0] + 15, to[1] - 15);
    }
  }
  const cases = [
    { x: -.65, y: -.65, on: false, label: "아래 · 아래" }, { x: -.65, y: .65, on: true, label: "아래 · 위" },
    { x: .65, y: -.65, on: true, label: "위 · 아래" }, { x: .65, y: .65, on: false, label: "위 · 위" },
  ];
  cases.forEach(({ x, y, on, label }) => {
    const [px, py] = canvasPoint(canvas, x, y); const emphasized = !revealed || step !== 1 || on;
    ctx.globalAlpha = emphasized ? 1 : .22; ctx.fillStyle = on ? PALETTE.one : PALETTE.zero; ctx.strokeStyle = "white"; ctx.lineWidth = 4; ctx.beginPath(); if (on) ctx.rect(px - 12, py - 12, 24, 24); else ctx.arc(px, py, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#253247"; ctx.font = "800 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(on ? "켜짐" : "꺼짐", px, py - 22); ctx.font = "700 14px system-ui"; ctx.fillText(label, px, py + 34); ctx.globalAlpha = 1;
  });
  ctx.fillStyle = "#526071"; ctx.font = "700 15px system-ui"; ctx.textAlign = "center"; ctx.fillText("교실 쪽 스위치  아래 ← → 위", canvas.width / 2, canvas.height - 10);
  ctx.save(); ctx.translate(16, canvas.height / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("계단 쪽 스위치  아래 ← → 위", 0, 0); ctx.restore();
}
