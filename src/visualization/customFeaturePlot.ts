import type { CustomRow } from "../data/customDataset";
import type { DataPoint } from "../types";
import { canvasPoint, PALETTE } from "./canvasUtils";

export function drawCustomFeaturePlot(canvas: HTMLCanvasElement, points: DataPoint[], rows: CustomRow[]): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#f7f8fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(66,75,90,.16)"; ctx.lineWidth = 1;
  for (let step = 0; step <= 8; step += 1) {
    const x = step / 8 * canvas.width; const y = step / 8 * canvas.height;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  points.forEach((point, index) => {
    const [x, y] = canvasPoint(canvas, point.x, point.y);
    ctx.fillStyle = point.label === 0 ? PALETTE.zero : PALETTE.one; ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.beginPath();
    if (point.label === 0) ctx.arc(x, y, 9, 0, Math.PI * 2); else ctx.rect(x - 8, y - 8, 16, 16);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#394658"; ctx.font = "700 13px system-ui"; ctx.fillText(rows[index]?.name ?? `사례 ${index + 1}`, x + 12, y - 10);
  });
}
