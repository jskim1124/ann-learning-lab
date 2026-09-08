import { forward } from "../core/neuralNetwork";
import type { DataPoint, NetworkModel } from "../types";
import { canvasPoint, PALETTE, probabilityColor } from "./canvasUtils";

export const HIDDEN_COLORS = ["#6a4bbc", "#00897b", "#d56a00", "#c23b6e", "#1976d2", "#697214"];

export interface SurfaceOptions {
  explanationStep?: 1 | 2 | 3 | 4;
  selectedNeuron?: number;
}

export type Segment = [[number, number], [number, number]];

/** Clip wA·x + wB·y + b = 0 to the input square [-1, 1]². */
export function hiddenBoundarySegment(wA: number, wB: number, bias: number): Segment | null {
  const points: [number, number][] = [];
  const push = (x: number, y: number) => {
    if (x < -1 - 1e-9 || x > 1 + 1e-9 || y < -1 - 1e-9 || y > 1 + 1e-9) return;
    if (!points.some(([px, py]) => Math.abs(px - x) < 1e-7 && Math.abs(py - y) < 1e-7)) points.push([x, y]);
  };
  if (Math.abs(wB) > 1e-10) { push(-1, -(bias - wA) / wB); push(1, -(bias + wA) / wB); }
  if (Math.abs(wA) > 1e-10) { push(-(bias - wB) / wA, -1); push(-(bias + wB) / wA, 1); }
  return points.length >= 2 ? [points[0]!, points[1]!] : null;
}

function interpolate(a: [number, number, number], b: [number, number, number], threshold: number): [number, number] {
  const ratio = Math.abs(b[2] - a[2]) < 1e-12 ? 0.5 : (threshold - a[2]) / (b[2] - a[2]);
  return [a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])];
}

/** Contour segments for one sampled cell, with a center tie break for saddle cells. */
export function contourCell(corners: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]], threshold = 0.5): Segment[] {
  const hits: Array<{ edge: number; point: [number, number] }> = [];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 0]] as const;
  edges.forEach(([a, b], edge) => {
    if ((corners[a][2] >= threshold) !== (corners[b][2] >= threshold)) hits.push({ edge, point: interpolate(corners[a], corners[b], threshold) });
  });
  if (hits.length === 2) return [[hits[0]!.point, hits[1]!.point]];
  if (hits.length !== 4) return [];
  const centerHigh = corners.reduce((sum, corner) => sum + corner[2], 0) / 4 >= threshold;
  const topLeftHigh = corners[0][2] >= threshold;
  const pairs: Array<[number, number]> = centerHigh === topLeftHigh ? [[0, 1], [2, 3]] : [[0, 3], [1, 2]];
  return pairs.map(([a, b]) => [hits[a]!.point, hits[b]!.point]);
}

function drawGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.strokeStyle = "rgba(66, 75, 90, .17)"; ctx.lineWidth = 1;
  for (let step = 0; step <= 8; step += 1) {
    const x = (step / 8) * canvas.width; const y = (step / 8) * canvas.height;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(37,48,71,.45)";
  ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
}

function drawHiddenBoundaries(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, model: NetworkModel, selectedNeuron: number, subdued: boolean): void {
  model.parameters.inputHidden.forEach(([wA, wB], index) => {
    const segment = hiddenBoundarySegment(wA, wB, model.parameters.hiddenBias[index] ?? 0); if (!segment) return;
    const [start, end] = segment.map(([x, y]) => canvasPoint(canvas, x, y)) as [[number, number], [number, number]];
    const selected = index === selectedNeuron;
    ctx.save(); ctx.globalAlpha = subdued ? (selected ? 0.65 : 0.27) : (selected ? 1 : 0.58);
    ctx.strokeStyle = HIDDEN_COLORS[index % HIDDEN_COLORS.length] ?? "#6a4bbc"; ctx.lineWidth = selected ? 4.5 : 2; ctx.setLineDash(selected ? [] : [7, 5]);
    ctx.beginPath(); ctx.moveTo(...start); ctx.lineTo(...end); ctx.stroke();
    const mx = (start[0] + end[0]) / 2; const my = (start[1] + end[1]) / 2;
    const length = Math.hypot(wA, wB) || 1; const nx = (wA / length) * 28; const ny = -(wB / length) * 28;
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + nx, my + ny); ctx.stroke();
    const angle = Math.atan2(ny, nx); ctx.beginPath(); ctx.moveTo(mx + nx, my + ny); ctx.lineTo(mx + nx - 8 * Math.cos(angle - .45), my + ny - 8 * Math.sin(angle - .45)); ctx.moveTo(mx + nx, my + ny); ctx.lineTo(mx + nx - 8 * Math.cos(angle + .45), my + ny - 8 * Math.sin(angle + .45)); ctx.stroke();
    ctx.font = `700 ${selected ? 17 : 14}px system-ui`; ctx.fillStyle = ctx.strokeStyle; ctx.fillText(`H${index + 1}  z>0`, mx + nx + 5, my + ny - 5);
    ctx.restore();
  });
}

export function drawDecisionSurface(canvas: HTMLCanvasElement, model: NetworkModel, data: DataPoint[], testInput: { x: number; y: number }, options: SurfaceOptions = {}): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const step = options.explanationStep ?? 4; const selectedNeuron = options.selectedNeuron ?? 0;
  const grid = 70; const cellW = canvas.width / grid; const cellH = canvas.height / grid;
  const probabilities = Array.from({ length: grid + 1 }, () => Array(grid + 1).fill(0) as number[]);
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#f5f7fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row <= grid; row += 1) for (let col = 0; col <= grid; col += 1) {
    const x = -1 + (col / grid) * 2; const y = 1 - (row / grid) * 2;
    const probability = forward(model, x, y).probability; probabilities[row]![col] = probability;
    if (step >= 3 && row < grid && col < grid) { ctx.fillStyle = probabilityColor(probability); ctx.fillRect(col * cellW, row * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1); }
  }
  drawGrid(ctx, canvas);
  if (step >= 2) drawHiddenBoundaries(ctx, canvas, model, selectedNeuron, step === 4);
  if (step === 4) {
    ctx.strokeStyle = "#111827"; ctx.lineWidth = 4; ctx.setLineDash([]); ctx.beginPath();
    for (let row = 0; row < grid; row += 1) for (let col = 0; col < grid; col += 1) {
      const corners = [
        [col * cellW, row * cellH, probabilities[row]![col]!], [(col + 1) * cellW, row * cellH, probabilities[row]![col + 1]!],
        [(col + 1) * cellW, (row + 1) * cellH, probabilities[row + 1]![col + 1]!], [col * cellW, (row + 1) * cellH, probabilities[row + 1]![col]!],
      ] as [[number, number, number], [number, number, number], [number, number, number], [number, number, number]];
      contourCell(corners, .5).forEach(([a, b]) => { ctx.moveTo(...a); ctx.lineTo(...b); });
    }
    ctx.stroke();
  }
  for (const point of data) drawDataPoint(ctx, canvas, point);
  const [tx, ty] = canvasPoint(canvas, testInput.x, testInput.y);
  ctx.strokeStyle = PALETTE.test; ctx.lineWidth = 3; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(tx - 11, ty); ctx.lineTo(tx + 11, ty); ctx.moveTo(tx, ty - 11); ctx.lineTo(tx, ty + 11); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = PALETTE.test; ctx.font = "700 14px system-ui"; ctx.fillText("탐침", tx + 11, ty - 11);
}

function drawDataPoint(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, point: DataPoint): void {
  const [x, y] = canvasPoint(canvas, point.x, point.y);
  ctx.fillStyle = point.label === 0 ? PALETTE.zero : PALETTE.one; ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.beginPath();
  if (point.label === 0) ctx.arc(x, y, 7, 0, Math.PI * 2); else ctx.rect(x - 6, y - 6, 12, 12);
  ctx.fill(); ctx.stroke();
}
