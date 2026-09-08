import { forward } from "../core/neuralNetwork";
import type { DataPoint, NetworkModel } from "../types";
import { canvasPoint, PALETTE, probabilityColor } from "./canvasUtils";

export function drawDecisionSurface(
  canvas: HTMLCanvasElement,
  model: NetworkModel,
  data: DataPoint[],
  testInput: { x: number; y: number },
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const grid = 70;
  const cellW = canvas.width / grid;
  const cellH = canvas.height / grid;
  const probabilities = Array.from({ length: grid + 1 }, () => Array(grid + 1).fill(0) as number[]);
  for (let row = 0; row <= grid; row += 1) {
    for (let col = 0; col <= grid; col += 1) {
      const x = -1 + (col / grid) * 2;
      const y = 1 - (row / grid) * 2;
      const probability = forward(model, x, y).probability;
      const values = probabilities[row];
      if (values) values[col] = probability;
      if (row < grid && col < grid) {
        ctx.fillStyle = probabilityColor(probability);
        ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
      }
    }
  }

  ctx.strokeStyle = "rgba(66, 75, 90, .18)"; ctx.lineWidth = 1;
  for (let step = 0; step <= 8; step += 1) {
    const position = (step / 8) * canvas.width;
    ctx.beginPath(); ctx.moveTo(position, 0); ctx.lineTo(position, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, position); ctx.lineTo(canvas.width, position); ctx.stroke();
  }

  ctx.strokeStyle = "#202938"; ctx.lineWidth = 3;
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const values = [
        probabilities[row]?.[col] ?? 0,
        probabilities[row]?.[col + 1] ?? 0,
        probabilities[row + 1]?.[col + 1] ?? 0,
        probabilities[row + 1]?.[col] ?? 0,
      ];
      if (Math.min(...values) < 0.5 && Math.max(...values) >= 0.5) {
        ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
      }
    }
  }

  for (const point of data) drawDataPoint(ctx, canvas, point);
  const [tx, ty] = canvasPoint(canvas, testInput.x, testInput.y);
  ctx.strokeStyle = PALETTE.test; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(tx - 10, ty); ctx.lineTo(tx + 10, ty); ctx.moveTo(tx, ty - 10); ctx.lineTo(tx, ty + 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.stroke();
}

function drawDataPoint(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: DataPoint): void {
  const [x, y] = canvasPoint(canvas, point.x, point.y);
  ctx.fillStyle = point.label === 0 ? PALETTE.zero : PALETTE.one;
  ctx.strokeStyle = "white"; ctx.lineWidth = 3;
  ctx.beginPath();
  if (point.label === 0) ctx.arc(x, y, 7, 0, Math.PI * 2);
  else ctx.rect(x - 6, y - 6, 12, 12);
  ctx.fill(); ctx.stroke();
}
