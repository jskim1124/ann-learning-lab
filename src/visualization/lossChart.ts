import type { HistoryPoint } from "../types";

export function drawLossChart(canvas: HTMLCanvasElement, history: HistoryPoint[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#dde2ea"; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach((ratio) => { ctx.beginPath(); ctx.moveTo(0, canvas.height * ratio); ctx.lineTo(canvas.width, canvas.height * ratio); ctx.stroke(); });
  if (history.length < 2) return;
  const maxLoss = Math.max(...history.map((item) => item.loss), 0.01);
  const minEpoch = history[0]?.epoch ?? 0;
  const maxEpoch = history.at(-1)?.epoch ?? 1;
  ctx.strokeStyle = "#1f6bd6"; ctx.lineWidth = 3; ctx.beginPath();
  history.forEach((item, index) => {
    const x = ((item.epoch - minEpoch) / Math.max(1, maxEpoch - minEpoch)) * canvas.width;
    const y = canvas.height - (item.loss / maxLoss) * (canvas.height - 8) - 4;
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
