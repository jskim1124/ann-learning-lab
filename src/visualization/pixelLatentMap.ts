import { forwardPixels, type PixelExample, type PixelModel } from "../core/pixelNetwork";

const SOFT = ["#ffebe1", "#fde8ee", "#efedff", "#dbe9fd", "#e4f3ee", "#fff3cf"];
const STRONG = ["#f17605", "#df466f", "#7446f5", "#1769d2", "#247a63", "#b98700"];
const HIDDEN = ["#7457c7", "#2d8a78", "#d06c2c", "#4477c5", "#bd4e78", "#71813a"];

export interface PixelProjection { mean: number[]; horizontal: number[]; vertical: number[]; horizontalScale: number; verticalScale: number; }

function normalize(vector: number[]): number[] { const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1; return vector.map((value) => value / length); }
function dot(left: number[], right: number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }
function component(centered: number[][], seed: (index: number) => number, exclude?: number[]): number[] {
  let vector = normalize(Array.from({ length: centered[0]?.length ?? 0 }, (_, index) => seed(index)));
  for (let turn = 0; turn < 45; turn += 1) {
    const next = Array<number>(vector.length).fill(0);
    centered.forEach((row) => { const score = dot(row, vector); row.forEach((value, index) => { next[index] = (next[index] ?? 0) + value * score; }); });
    if (exclude) { const removed = dot(next, exclude); next.forEach((value, index) => { next[index] = value - removed * (exclude[index] ?? 0); }); }
    vector = normalize(next);
  }
  return vector;
}

export function createPixelProjection(data: PixelExample[]): PixelProjection {
  const inputSize = data[0]?.pixels.length ?? 196;
  const mean = Array.from({ length: inputSize }, (_, index) => data.reduce((sum, example) => sum + (example.pixels[index] ?? 0), 0) / Math.max(1, data.length));
  const centered = data.map((example) => example.pixels.map((value, index) => value - (mean[index] ?? 0)));
  const horizontal = component(centered, (index) => Math.sin(index * 1.73 + .4));
  const vertical = component(centered, (index) => Math.cos(index * 1.17 + .9), horizontal);
  const horizontalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, horizontal))));
  const verticalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, vertical))));
  return { mean, horizontal, vertical, horizontalScale, verticalScale };
}

export function projectPixels(projection: PixelProjection, pixels: number[]): { x: number; y: number } {
  const centered = pixels.map((value, index) => value - (projection.mean[index] ?? 0));
  return { x: Math.max(-1, Math.min(1, dot(centered, projection.horizontal) / projection.horizontalScale)), y: Math.max(-1, Math.min(1, dot(centered, projection.vertical) / projection.verticalScale)) };
}

function reconstructed(projection: PixelProjection, x: number, y: number): number[] {
  return projection.mean.map((mean, index) => Math.max(0, Math.min(1, mean + x * projection.horizontalScale * (projection.horizontal[index] ?? 0) + y * projection.verticalScale * (projection.vertical[index] ?? 0))));
}
function category(model: PixelModel, pixels: number[]): number { const probabilities = forwardPixels(model, pixels).probabilities; return probabilities.indexOf(Math.max(...probabilities)); }

export function drawPixelLatentMap(canvas: HTMLCanvasElement, model: PixelModel, data: PixelExample[], current: number[], projection: PixelProjection, view: "decision" | "neurons" = "decision"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const margin = { left: 46, right: 15, top: 14, bottom: 38 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom; const cells = 52; const classes: number[][] = [];
  for (let gy = 0; gy < cells; gy += 1) { const row: number[] = []; classes.push(row); for (let gx = 0; gx < cells; gx += 1) { const x = gx / (cells - 1) * 2 - 1; const y = 1 - gy / (cells - 1) * 2; const result = category(model, reconstructed(projection, x, y)); row.push(result); context.fillStyle = view === "decision" ? SOFT[result % SOFT.length]! : "#f8f9fb"; context.fillRect(margin.left + gx * plotW / cells, margin.top + gy * plotH / cells, plotW / cells + 1, plotH / cells + 1); } }
  context.strokeStyle = "rgba(90,98,112,.16)"; context.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) { const x = margin.left + tick * plotW / 4; const y = margin.top + tick * plotH / 4; context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotH); context.stroke(); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(margin.left + plotW, y); context.stroke(); }
  if (view === "decision") {
    context.strokeStyle = "#252b36"; context.lineWidth = 2;
    for (let gy = 0; gy < cells - 1; gy += 1) for (let gx = 0; gx < cells - 1; gx += 1) { const here = classes[gy]![gx]; const x = margin.left + (gx + 1) * plotW / cells; const y = margin.top + (gy + 1) * plotH / cells; if (classes[gy]![gx + 1] !== here) { context.beginPath(); context.moveTo(x, y - plotH / cells); context.lineTo(x, y); context.stroke(); } if (classes[gy + 1]![gx] !== here) { context.beginPath(); context.moveTo(x - plotW / cells, y); context.lineTo(x, y); context.stroke(); } }
  } else {
    model.inputHidden.forEach((weights, h) => {
      const constant = (model.hiddenBias[h] ?? 0) + dot(weights, projection.mean); const a = projection.horizontalScale * dot(weights, projection.horizontal); const b = projection.verticalScale * dot(weights, projection.vertical);
      if (Math.abs(a) + Math.abs(b) < 1e-8) return; const points: Array<{ x: number; y: number }> = [];
      const verticalEdges: Array<[number, number]> = [[-1, (-constant + a) / b], [1, (-constant - a) / b]];
      const horizontalEdges: Array<[number, number]> = [[(-constant + b) / a, -1], [(-constant - b) / a, 1]];
      verticalEdges.forEach(([x, y]) => { if (Number.isFinite(y) && y >= -1 && y <= 1) points.push({ x, y }); });
      horizontalEdges.forEach(([x, y]) => { if (Number.isFinite(x) && x >= -1 && x <= 1) points.push({ x, y }); });
      if (points.length >= 2) { const p0 = points[0]!; const p1 = points[1]!; context.strokeStyle = HIDDEN[h % HIDDEN.length]!; context.lineWidth = 2.5; context.setLineDash([8, 5]); context.beginPath(); context.moveTo(margin.left + (p0.x + 1) / 2 * plotW, margin.top + (1 - (p0.y + 1) / 2) * plotH); context.lineTo(margin.left + (p1.x + 1) / 2 * plotW, margin.top + (1 - (p1.y + 1) / 2) * plotH); context.stroke(); context.setLineDash([]); }
    });
  }
  data.forEach((example) => { const point = projectPixels(projection, example.pixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fillStyle = STRONG[example.label % STRONG.length]!; context.fill(); context.strokeStyle = "#fff"; context.lineWidth = 1.4; context.stroke(); });
  if (current.length) { const point = projectPixels(projection, current); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.strokeStyle = "#111722"; context.lineWidth = 3; context.beginPath(); context.moveTo(x - 8, y); context.lineTo(x + 8, y); context.moveTo(x, y - 8); context.lineTo(x, y + 8); context.stroke(); }
  context.strokeStyle = "#7b8491"; context.lineWidth = 1.1; context.strokeRect(margin.left, margin.top, plotW, plotH); context.fillStyle = "#535e6d"; context.font = "12px sans-serif"; context.textAlign = "center"; context.fillText("그림의 차이 · 가로 방향", margin.left + plotW / 2, height - 8); context.save(); context.translate(14, margin.top + plotH / 2); context.rotate(-Math.PI / 2); context.fillText("그림의 차이 · 세로 방향", 0, 0); context.restore();
}
