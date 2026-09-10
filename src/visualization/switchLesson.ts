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
  { tab: "선 하나", title: "직선 하나로는 두 색을 나눌 수 없습니다", body: "켜짐과 꺼짐이 번갈아 대각선에 놓여 있습니다. 어느 방향으로 한 줄을 그어도 한쪽에 두 색이 함께 남습니다.", reveal: "직선 하나를 그어 확인하기", result: "직선의 양쪽 모두에 켜짐과 꺼짐이 섞여 있습니다.", question: "직선 하나로 네 점을 완전히 나눌 수 있을까요?", choices: [["no", "나눌 수 없다"], ["yes", "나눌 수 있다"]], correct: "no", explanation: "대각선으로 같은 두 점 때문에 한 줄만으로는 나뉘지 않습니다." },
  { tab: "선 두 개", title: "두 직선이 가운데 띠를 만듭니다", body: "첫 선은 아래·아래 꺼짐을 바깥으로 떼고, 둘째 선은 위·위 꺼짐을 바깥으로 뗍니다. 그러면 두 선 사이에는 켜짐 두 점만 남습니다.", reveal: "두 선 사이를 색칠해 보기", result: "두 규칙 찾기 칸이 각각 바깥쪽 꺼짐을 하나씩 찾아냈습니다.", question: "두 선 사이의 가운데 띠에는 어떤 점이 남나요?", choices: [["on", "켜짐 두 점"], ["off", "꺼짐 두 점"]], correct: "on", explanation: "두 스위치가 다른 두 점의 합은 가운데에 모입니다." },
  { tab: "최종 판단", title: "모델은 두 선의 안과 밖을 합쳐 판단합니다", body: "두 선의 바깥은 꺼짐, 두 선 사이는 켜짐으로 정합니다. 검은 경계 두 개를 건널 때 모델의 답이 바뀝니다.", reveal: "최종 판단 영역 겹쳐 보기", result: "주황 띠는 켜짐 예상, 파란 바깥은 꺼짐 예상입니다.", question: "모델이 켜짐으로 판단하는 곳은 어디인가요?", choices: [["between", "두 선 사이"], ["outside", "두 선 바깥"]], correct: "between", explanation: "두 규칙을 합치면 가운데 띠가 켜짐 영역이 됩니다." },
];

function lineSegment(sum: number): [[number, number], [number, number]] {
  return sum < 0 ? [[-1, sum + 1], [sum + 1, -1]] : [[sum - 1, 1], [1, sum - 1]];
}

function drawLine(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, sum: number, color: string, width = 4, dashed = false): void {
  const [a, b] = lineSegment(sum).map(([x, y]) => canvasPoint(canvas, x, y)) as [[number, number], [number, number]];
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [12, 8] : []); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
}

export function drawSwitchLesson(canvas: HTMLCanvasElement, step: 1 | 2 | 3 | 4, revealed: boolean): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = step === 4 && revealed ? "rgba(53,104,212,.12)" : "#f7f8fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (step >= 3 && revealed) {
    const polygon = [[-1, .65], [-.65, 1], [1, -.65], [.65, -1]].map(([x, y]) => canvasPoint(canvas, x!, y!));
    ctx.fillStyle = step === 4 ? "rgba(241,118,5,.24)" : "rgba(116,70,245,.13)"; ctx.beginPath(); ctx.moveTo(...polygon[0]!); polygon.slice(1).forEach((point) => ctx.lineTo(...point)); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "rgba(55,67,84,.15)"; ctx.lineWidth = 1;
  [0.25, .5, .75].forEach((ratio) => { ctx.beginPath(); ctx.moveTo(canvas.width * ratio, 0); ctx.lineTo(canvas.width * ratio, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, canvas.height * ratio); ctx.lineTo(canvas.width, canvas.height * ratio); ctx.stroke(); });
  if (step === 2 && revealed) drawLine(ctx, canvas, 0, "#6f7784", 4, true);
  if (step >= 3 && revealed) { drawLine(ctx, canvas, -.35, step === 4 ? "#111827" : "#6a4bbc", step === 4 ? 5 : 4); drawLine(ctx, canvas, .35, step === 4 ? "#111827" : "#00897b", step === 4 ? 5 : 4); }
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
