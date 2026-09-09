import { forwardPixels, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import { projectPixels, reconstructProjectedPixels, type PixelProjection } from "../core/pixelProjection";

const STRONG = ["#f17605", "#df466f", "#7446f5", "#1769d2", "#247a63", "#b98700"];
const HIDDEN = ["#7457c7", "#2d8a78", "#d06c2c", "#4477c5", "#bd4e78", "#71813a"];
export type PixelMapView = "placement" | "neurons" | "decision";

function dot(left: number[], right: number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }
function mixWithWhite(hex: string, strength: number): string {
  const rgb = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)); const amount = Math.max(0, Math.min(1, strength));
  return `rgb(${rgb.map((value) => Math.round(255 + (value - 255) * amount)).join(",")})`;
}
function hiddenPlane(model: PixelModel, projection: PixelProjection, neuron: number): { constant: number; horizontal: number; vertical: number } {
  const weights = model.inputHidden[neuron] ?? [];
  return { constant: (model.hiddenBias[neuron] ?? 0) + dot(weights, projection.mean), horizontal: projection.horizontalScale * dot(weights, projection.horizontal), vertical: projection.verticalScale * dot(weights, projection.vertical) };
}
function lineEndpoints(plane: { constant: number; horizontal: number; vertical: number }): Array<{ x: number; y: number }> {
  const { constant, horizontal: a, vertical: b } = plane; const points: Array<{ x: number; y: number }> = [];
  if (Math.abs(b) > 1e-9) [-1, 1].forEach((x) => { const y = (-constant - a * x) / b; if (y >= -1 && y <= 1) points.push({ x, y }); });
  if (Math.abs(a) > 1e-9) [-1, 1].forEach((y) => { const x = (-constant - b * y) / a; if (x >= -1 && x <= 1 && !points.some((point) => Math.abs(point.x - x) < 1e-5 && Math.abs(point.y - y) < 1e-5)) points.push({ x, y }); });
  return points.slice(0, 2);
}

export interface PixelMapOptions { view?: PixelMapView; focusLabel?: string; selectedNeuron?: number; previousModel?: PixelModel; highlightAxis?: "horizontal" | "vertical"; }

export function drawPixelLatentMap(canvas: HTMLCanvasElement, model: PixelModel, data: PixelExample[], focusPixels: number[], projection: PixelProjection, options: PixelMapOptions = {}): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const view = options.view ?? "decision"; const selectedNeuron = Math.max(0, Math.min(model.hiddenUnits - 1, options.selectedNeuron ?? 0));
  const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const margin = { left: 50, right: 14, top: 13, bottom: 39 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom; const cells = 62; const classes: number[][] = []; const previousClasses: number[][] = [];
  const plane = hiddenPlane(model, projection, selectedNeuron);
  for (let gy = 0; gy < cells; gy += 1) {
    const row: number[] = []; classes.push(row); const previousRow: number[] = []; previousClasses.push(previousRow);
    for (let gx = 0; gx < cells; gx += 1) {
      const x = gx / (cells - 1) * 2 - 1; const y = 1 - gy / (cells - 1) * 2;
      if (view === "placement") {
        context.fillStyle = "#fafafa";
      } else if (view === "neurons") {
        const signal = Math.tanh(plane.constant + plane.horizontal * x + plane.vertical * y); const color = signal >= 0 ? "#f17605" : "#7446f5";
        context.fillStyle = mixWithWhite(color, .08 + Math.abs(signal) * .42);
      } else {
        const probabilities = forwardPixels(model, reconstructProjectedPixels(projection, x, y)).probabilities; const winner = probabilities.indexOf(Math.max(...probabilities)); row.push(winner);
        if (options.previousModel) { const oldProbabilities = forwardPixels(options.previousModel, reconstructProjectedPixels(projection, x, y)).probabilities; previousRow.push(oldProbabilities.indexOf(Math.max(...oldProbabilities))); }
        const confidence = probabilities[winner] ?? 0; const base = 1 / Math.max(2, probabilities.length); const certainty = Math.max(0, Math.min(1, (confidence - base) / (1 - base)));
        context.fillStyle = mixWithWhite(STRONG[winner % STRONG.length]!, .08 + certainty * .48);
      }
      context.fillRect(margin.left + gx * plotW / cells, margin.top + gy * plotH / cells, plotW / cells + 1, plotH / cells + 1);
    }
  }
  context.strokeStyle = "rgba(73,83,98,.16)"; context.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) { const x = margin.left + tick * plotW / 4; const y = margin.top + tick * plotH / 4; context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotH); context.stroke(); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(margin.left + plotW, y); context.stroke(); }
  if (view === "placement" && focusPixels.length && options.highlightAxis) {
    const point = projectPixels(projection, focusPixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH;
    context.fillStyle = "rgba(23,105,210,.09)"; if (options.highlightAxis === "horizontal") context.fillRect(x - 11, margin.top, 22, plotH); else context.fillRect(margin.left, y - 11, plotW, 22);
    context.strokeStyle = "#1769d2"; context.lineWidth = 2; context.setLineDash([6, 4]); context.beginPath(); if (options.highlightAxis === "horizontal") { context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotH); } else { context.moveTo(margin.left, y); context.lineTo(margin.left + plotW, y); } context.stroke(); context.setLineDash([]);
  }
  const drawLine = (source: PixelModel, color: string, dashed: boolean, lineWidth: number) => {
    const points = lineEndpoints(hiddenPlane(source, projection, selectedNeuron)); if (points.length < 2) return;
    context.strokeStyle = color; context.lineWidth = lineWidth; context.setLineDash(dashed ? [7, 5] : []); context.beginPath();
    points.forEach((point, index) => { const px = margin.left + (point.x + 1) / 2 * plotW; const py = margin.top + (1 - (point.y + 1) / 2) * plotH; if (index === 0) context.moveTo(px, py); else context.lineTo(px, py); }); context.stroke(); context.setLineDash([]);
  };
  if (view === "decision") {
    if (options.previousModel) {
      context.strokeStyle = "#68717e"; context.lineWidth = 1.8; context.setLineDash([7, 5]);
      for (let gy = 0; gy < cells - 1; gy += 1) for (let gx = 0; gx < cells - 1; gx += 1) { const here = previousClasses[gy]![gx]; const x = margin.left + (gx + 1) * plotW / cells; const y = margin.top + (gy + 1) * plotH / cells; if (previousClasses[gy]![gx + 1] !== here) { context.beginPath(); context.moveTo(x, y - plotH / cells); context.lineTo(x, y); context.stroke(); } if (previousClasses[gy + 1]![gx] !== here) { context.beginPath(); context.moveTo(x - plotW / cells, y); context.lineTo(x, y); context.stroke(); } }
      context.setLineDash([]);
    }
    context.strokeStyle = "#202633"; context.lineWidth = 2.2;
    for (let gy = 0; gy < cells - 1; gy += 1) for (let gx = 0; gx < cells - 1; gx += 1) { const here = classes[gy]![gx]; const x = margin.left + (gx + 1) * plotW / cells; const y = margin.top + (gy + 1) * plotH / cells; if (classes[gy]![gx + 1] !== here) { context.beginPath(); context.moveTo(x, y - plotH / cells); context.lineTo(x, y); context.stroke(); } if (classes[gy + 1]![gx] !== here) { context.beginPath(); context.moveTo(x - plotW / cells, y); context.lineTo(x, y); context.stroke(); } }
  } else if (view === "neurons") {
    if (options.previousModel) drawLine(options.previousModel, "#68717e", true, 2); drawLine(model, HIDDEN[selectedNeuron % HIDDEN.length]!, false, 3);
  }
  data.forEach((example) => { const point = projectPixels(projection, example.pixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 4.7, 0, Math.PI * 2); context.fillStyle = STRONG[example.label % STRONG.length]!; context.globalAlpha = view === "placement" ? .65 : 1; context.fill(); context.globalAlpha = 1; context.strokeStyle = "#fff"; context.lineWidth = 1.2; context.stroke(); });
  if (focusPixels.length) { const point = projectPixels(projection, focusPixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.fillStyle = "rgba(255,255,255,.9)"; context.fill(); context.strokeStyle = "#111722"; context.lineWidth = 3; context.stroke(); context.fillStyle = "#111722"; context.font = "700 11px sans-serif"; context.textAlign = x > margin.left + plotW * .76 ? "right" : "left"; context.fillText(options.focusLabel ?? "이 그림", x + (context.textAlign === "right" ? -12 : 12), y - 10); }
  context.strokeStyle = "#7b8491"; context.lineWidth = 1.1; context.strokeRect(margin.left, margin.top, plotW, plotH); context.fillStyle = "#535e6d"; context.font = "12px sans-serif"; context.textAlign = "center"; context.fillText("가로 점수   −1  ←   0   →  +1", margin.left + plotW / 2, height - 8); context.save(); context.translate(15, margin.top + plotH / 2); context.rotate(-Math.PI / 2); context.fillText("세로 점수   −1  ←   0   →  +1", 0, 0); context.restore();
}

export function pixelMapExampleAt(canvas: HTMLCanvasElement, clientX: number, clientY: number, projection: PixelProjection, data: PixelExample[]): number | null {
  const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420)); const margin = { left: 50, right: 14, top: 13, bottom: 39 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom; const clickX = (clientX - rect.left) / Math.max(1, rect.width) * width; const clickY = (clientY - rect.top) / Math.max(1, rect.height) * height; let nearest: number | null = null; let best = 18 ** 2;
  data.forEach((example, index) => { const point = projectPixels(projection, example.pixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; const distance = (x - clickX) ** 2 + (y - clickY) ** 2; if (distance < best) { best = distance; nearest = index; } }); return nearest;
}
