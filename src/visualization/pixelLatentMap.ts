import { forwardPixels, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import { projectPixels, reconstructProjectedPixels, type PixelProjection, type PixelProjectionMode } from "../core/pixelProjection";
import type { PixelTaskName } from "../data/pixelDatasets";

const STRONG = ["#f17605", "#df466f", "#7446f5", "#1769d2", "#247a63", "#b98700"];
const HIDDEN = ["#7457c7", "#2d8a78", "#d06c2c", "#4477c5", "#bd4e78", "#71813a"];
export type PixelMapView = "placement" | "decision";
export type PixelFeatureView = PixelProjectionMode;

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

export interface PixelMapOptions { view?: PixelMapView; focusLabel?: string; previousModel?: PixelModel; highlightAxis?: "horizontal" | "vertical"; showNeuronBoundaries?: boolean; showDecisionBoundary?: boolean; }

export function drawPixelLatentMap(canvas: HTMLCanvasElement, model: PixelModel, data: PixelExample[], focusPixels: number[], projection: PixelProjection, options: PixelMapOptions = {}): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const view = options.view ?? "decision";
  const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
  const margin = { left: 50, right: 14, top: 13, bottom: 39 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom; const cells = 62; const classes: number[][] = []; const previousClasses: number[][] = [];
  for (let gy = 0; gy < cells; gy += 1) {
    const row: number[] = []; classes.push(row); const previousRow: number[] = []; previousClasses.push(previousRow);
    for (let gx = 0; gx < cells; gx += 1) {
      const x = gx / (cells - 1) * 2 - 1; const y = 1 - gy / (cells - 1) * 2;
      if (view === "placement") {
        context.fillStyle = "#fafafa";
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
  const drawLine = (source: PixelModel, neuron: number, color: string, dashed: boolean, lineWidth: number) => {
    const plane = hiddenPlane(source, projection, neuron); const points = lineEndpoints(plane); if (points.length < 2) return;
    context.strokeStyle = color; context.lineWidth = lineWidth; context.setLineDash(dashed ? [7, 5] : []); context.beginPath();
    points.forEach((point, index) => { const px = margin.left + (point.x + 1) / 2 * plotW; const py = margin.top + (1 - (point.y + 1) / 2) * plotH; if (index === 0) context.moveTo(px, py); else context.lineTo(px, py); }); context.stroke(); context.setLineDash([]);
    if (!dashed) {
      const first = points[0]!; const second = points[1]!; const place = .22 + neuron % 4 * .18; const x = first.x + (second.x - first.x) * place; const y = first.y + (second.y - first.y) * place;
      const length = Math.hypot(plane.horizontal, plane.vertical) || 1; const dx = plane.horizontal / length * 22; const dy = -plane.vertical / length * 22; const px = margin.left + (x + 1) / 2 * plotW; const py = margin.top + (1 - (y + 1) / 2) * plotH;
      context.strokeStyle = color; context.fillStyle = color; context.lineWidth = 2; context.beginPath(); context.moveTo(px, py); context.lineTo(px + dx, py + dy); context.stroke(); const angle = Math.atan2(dy, dx); context.beginPath(); context.moveTo(px + dx, py + dy); context.lineTo(px + dx - 7 * Math.cos(angle - .5), py + dy - 7 * Math.sin(angle - .5)); context.lineTo(px + dx - 7 * Math.cos(angle + .5), py + dy - 7 * Math.sin(angle + .5)); context.closePath(); context.fill();
    }
  };
  if (view === "decision") {
    if (options.previousModel) {
      context.strokeStyle = "#68717e"; context.lineWidth = 1.8; context.setLineDash([7, 5]);
      for (let gy = 0; gy < cells - 1; gy += 1) for (let gx = 0; gx < cells - 1; gx += 1) { const here = previousClasses[gy]![gx]; const x = margin.left + (gx + 1) * plotW / cells; const y = margin.top + (gy + 1) * plotH / cells; if (previousClasses[gy]![gx + 1] !== here) { context.beginPath(); context.moveTo(x, y - plotH / cells); context.lineTo(x, y); context.stroke(); } if (previousClasses[gy + 1]![gx] !== here) { context.beginPath(); context.moveTo(x - plotW / cells, y); context.lineTo(x, y); context.stroke(); } }
      context.setLineDash([]);
    }
    if (options.showNeuronBoundaries !== false) model.inputHidden.forEach((_, neuron) => drawLine(model, neuron, HIDDEN[neuron % HIDDEN.length]!, false, 2.6));
    if (options.showDecisionBoundary !== false) { context.strokeStyle = "#202633"; context.lineWidth = 2.2;
      for (let gy = 0; gy < cells - 1; gy += 1) for (let gx = 0; gx < cells - 1; gx += 1) { const here = classes[gy]![gx]; const x = margin.left + (gx + 1) * plotW / cells; const y = margin.top + (gy + 1) * plotH / cells; if (classes[gy]![gx + 1] !== here) { context.beginPath(); context.moveTo(x, y - plotH / cells); context.lineTo(x, y); context.stroke(); } if (classes[gy + 1]![gx] !== here) { context.beginPath(); context.moveTo(x - plotW / cells, y); context.lineTo(x, y); context.stroke(); } }
    }
  }
  data.forEach((example) => { const point = projectPixels(projection, example.pixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 4.7, 0, Math.PI * 2); context.fillStyle = STRONG[example.label % STRONG.length]!; context.globalAlpha = view === "placement" ? .65 : 1; context.fill(); context.globalAlpha = 1; context.strokeStyle = "#fff"; context.lineWidth = 1.2; context.stroke(); });
  if (focusPixels.length) { const point = projectPixels(projection, focusPixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.fillStyle = "rgba(255,255,255,.9)"; context.fill(); context.strokeStyle = "#111722"; context.lineWidth = 3; context.stroke(); context.fillStyle = "#111722"; context.font = "700 11px sans-serif"; context.textAlign = x > margin.left + plotW * .76 ? "right" : "left"; context.fillText(options.focusLabel ?? "이 그림", x + (context.textAlign === "right" ? -12 : 12), y - 10); }
  context.strokeStyle = "#7b8491"; context.lineWidth = 1.1; context.strokeRect(margin.left, margin.top, plotW, plotH); context.fillStyle = "#535e6d"; context.font = "12px sans-serif"; context.textAlign = "center"; context.fillText("가로 점수   −1  ←   0   →  +1", margin.left + plotW / 2, height - 8); context.save(); context.translate(15, margin.top + plotH / 2); context.rotate(-Math.PI / 2); context.fillText("세로 점수   −1  ←   0   →  +1", 0, 0); context.restore();
}

export function drawPixelNeuronMovement(canvas: HTMLCanvasElement, before: PixelModel, after: PixelModel, data: PixelExample[], focusPixels: number[], projection: PixelProjection, focusLabel = "이 그림"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height); context.fillStyle = "#fafafa"; context.fillRect(0, 0, width, height);
  const margin = { left: 50, right: 16, top: 18, bottom: 41 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom;
  const toCanvas = (point: { x: number; y: number }) => ({ x: margin.left + (point.x + 1) / 2 * plotW, y: margin.top + (1 - (point.y + 1) / 2) * plotH });
  context.strokeStyle = "rgba(73,83,98,.16)"; context.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) { const x = margin.left + tick * plotW / 4; const y = margin.top + tick * plotH / 4; context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotH); context.stroke(); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(margin.left + plotW, y); context.stroke(); }
  data.forEach((example) => { const p = toCanvas(projectPixels(projection, example.pixels)); context.beginPath(); context.arc(p.x, p.y, 4.5, 0, Math.PI * 2); context.fillStyle = STRONG[example.label % STRONG.length]!; context.globalAlpha = .72; context.fill(); context.globalAlpha = 1; context.strokeStyle = "white"; context.stroke(); });
  const oldPlane = hiddenPlane(before, projection, 0); const newPlane = hiddenPlane(after, projection, 0); const draw = (plane: ReturnType<typeof hiddenPlane>, color: string, dashed: boolean, widthValue: number) => { const endpoints = lineEndpoints(plane); if (endpoints.length < 2) return; const a = toCanvas(endpoints[0]!); const b = toCanvas(endpoints[1]!); context.strokeStyle = color; context.lineWidth = widthValue; context.setLineDash(dashed ? [8, 6] : []); context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke(); context.setLineDash([]); };
  draw(oldPlane, "#7a828e", true, 2); draw(newPlane, HIDDEN[0]!, false, 3);
  const nearest = (plane: ReturnType<typeof hiddenPlane>) => { const divisor = plane.horizontal ** 2 + plane.vertical ** 2 || 1; return { x: -plane.constant * plane.horizontal / divisor, y: -plane.constant * plane.vertical / divisor }; };
  const start = toCanvas(nearest(oldPlane)); const end = toCanvas(nearest(newPlane)); context.strokeStyle = "#d08700"; context.fillStyle = "#d08700"; context.lineWidth = 3; context.beginPath(); context.moveTo(start.x, start.y); context.lineTo(end.x, end.y); context.stroke(); const angle = Math.atan2(end.y - start.y, end.x - start.x); context.beginPath(); context.moveTo(end.x, end.y); context.lineTo(end.x - 10 * Math.cos(angle - .48), end.y - 10 * Math.sin(angle - .48)); context.lineTo(end.x - 10 * Math.cos(angle + .48), end.y - 10 * Math.sin(angle + .48)); context.closePath(); context.fill();
  const focus = toCanvas(projectPixels(projection, focusPixels)); context.beginPath(); context.arc(focus.x, focus.y, 9, 0, Math.PI * 2); context.fillStyle = "rgba(255,255,255,.9)"; context.fill(); context.strokeStyle = "#111722"; context.lineWidth = 3; context.stroke(); context.fillStyle = "#111722"; context.font = "700 11px sans-serif"; context.textAlign = focus.x > margin.left + plotW * .72 ? "right" : "left"; context.fillText(focusLabel, focus.x + (context.textAlign === "right" ? -12 : 12), focus.y - 10);
  context.fillStyle = HIDDEN[0]!; context.font = "700 12px sans-serif"; context.textAlign = "left"; context.fillText("대표 분류선 1개", Math.min(width - 125, end.x + 10), Math.max(28, end.y - 10)); context.strokeStyle = "#7b8491"; context.lineWidth = 1.1; context.strokeRect(margin.left, margin.top, plotW, plotH); context.fillStyle = "#535e6d"; context.font = "12px sans-serif"; context.textAlign = "center"; context.fillText("가로 점수", margin.left + plotW / 2, height - 9); context.save(); context.translate(15, margin.top + plotH / 2); context.rotate(-Math.PI / 2); context.fillText("세로 점수", 0, 0); context.restore();
}

function rawFeature(pixels: number[], task: PixelTaskName, mode: Exclude<PixelFeatureView, "learned">): { x: number; y: number } {
  const weights = pixels.map((value) => task === "omr" ? Math.max(0, value - .38) : Math.max(0, value)); const total = weights.reduce((sum, value) => sum + value, 0);
  if (mode === "ink") { const spread = total <= 1e-8 ? 0 : weights.reduce((sum, value, index) => { const x = index % 14 - 6.5; const y = Math.floor(index / 14) - 6.5; return sum + value * Math.hypot(x, y); }, 0) / total; return { x: pixels.reduce((sum, value) => sum + value, 0), y: spread }; }
  if (total <= 1e-8) return { x: 6.5, y: 6.5 };
  return { x: weights.reduce((sum, value, index) => sum + (index % 14 + .5) * value, 0) / total, y: weights.reduce((sum, value, index) => sum + (Math.floor(index / 14) + .5) * value, 0) / total };
}

export function pixelFeatureAccuracy(data: PixelExample[], projection: PixelProjection, task: PixelTaskName, mode: PixelFeatureView): number {
  const coordinates = pixelFeatureCoordinates(data, projection, task, mode); const labels = [...new Set(data.map((example) => example.label))]; const centers = new Map(labels.map((label) => { const points = coordinates.filter((_, index) => data[index]?.label === label); return [label, { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length }] as const; }));
  const correct = coordinates.filter((point, index) => { const nearest = labels.reduce((best, label) => { const center = centers.get(label)!; const distance = (point.x - center.x) ** 2 + (point.y - center.y) ** 2; return distance < best.distance ? { label, distance } : best; }, { label: labels[0] ?? 0, distance: Number.POSITIVE_INFINITY }); return nearest.label === data[index]?.label; }).length;
  return correct / Math.max(1, data.length);
}

export function pixelFeatureCoordinates(data: PixelExample[], projection: PixelProjection, task: PixelTaskName, mode: PixelFeatureView): Array<{ x: number; y: number }> {
  if (mode === "learned") return data.map((example) => projectPixels(projection, example.pixels));
  const raw = data.map((example) => rawFeature(example.pixels, task, mode)); const xs = raw.map((point) => point.x); const ys = raw.map((point) => point.y); const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const scale = (value: number, minimum: number, maximum: number) => maximum - minimum < 1e-8 ? 0 : ((value - minimum) / (maximum - minimum)) * 1.7 - .85;
  return raw.map((point) => ({ x: scale(point.x, minX, maxX), y: scale(point.y, minY, maxY) }));
}

export function drawPixelFeatureMap(canvas: HTMLCanvasElement, data: PixelExample[], focusPixels: number[], projection: PixelProjection, task: PixelTaskName, mode: PixelFeatureView): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const ratio = window.devicePixelRatio || 1; const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420));
  if (canvas.width !== width * ratio || canvas.height !== height * ratio) { canvas.width = width * ratio; canvas.height = height * ratio; }
  context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height); context.fillStyle = "#fafafa"; context.fillRect(0, 0, width, height);
  const margin = { left: 58, right: 16, top: 18, bottom: 43 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom;
  context.strokeStyle = "rgba(73,83,98,.16)"; context.lineWidth = 1;
  for (let tick = 0; tick <= 4; tick += 1) { const x = margin.left + tick * plotW / 4; const y = margin.top + tick * plotH / 4; context.beginPath(); context.moveTo(x, margin.top); context.lineTo(x, margin.top + plotH); context.stroke(); context.beginPath(); context.moveTo(margin.left, y); context.lineTo(margin.left + plotW, y); context.stroke(); }
  const combined = focusPixels.length ? [...data, { pixels: focusPixels, label: 0 }] : data; const coordinates = pixelFeatureCoordinates(combined, projection, task, mode); const points = coordinates.slice(0, data.length); points.forEach((point, index) => { const example = data[index]!; const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fillStyle = STRONG[example.label % STRONG.length]!; context.globalAlpha = .72; context.fill(); context.globalAlpha = 1; context.strokeStyle = "white"; context.lineWidth = 1; context.stroke(); });
  if (focusPixels.length) { const focus = coordinates.at(-1)!; const x = margin.left + (focus.x + 1) / 2 * plotW; const y = margin.top + (1 - (focus.y + 1) / 2) * plotH; context.beginPath(); context.arc(x, y, 9, 0, Math.PI * 2); context.fillStyle = "rgba(255,255,255,.9)"; context.fill(); context.strokeStyle = "#111722"; context.lineWidth = 3; context.stroke(); }
  const labels = mode === "position" ? ["가로: 진한 부분의 좌우 위치", "세로: 진한 부분의 위아래 위치"] : mode === "ink" ? ["가로: 진한 정도를 모두 더한 값", "세로: 진한 부분이 퍼진 정도"] : ["가로: 자료에서 찾은 차이 1", "세로: 자료에서 찾은 차이 2"];
  context.strokeStyle = "#7b8491"; context.lineWidth = 1.1; context.strokeRect(margin.left, margin.top, plotW, plotH); context.fillStyle = "#535e6d"; context.font = "12px sans-serif"; context.textAlign = "center"; context.fillText(labels[0]!, margin.left + plotW / 2, height - 9); context.save(); context.translate(15, margin.top + plotH / 2); context.rotate(-Math.PI / 2); context.fillText(labels[1]!, 0, 0); context.restore();
}

export function pixelMapExampleAt(canvas: HTMLCanvasElement, clientX: number, clientY: number, projection: PixelProjection, data: PixelExample[]): number | null {
  const rect = canvas.getBoundingClientRect(); const width = Math.max(520, Math.round(rect.width || 700)); const height = Math.max(300, Math.round(rect.height || 420)); const margin = { left: 50, right: 14, top: 13, bottom: 39 }; const plotW = width - margin.left - margin.right; const plotH = height - margin.top - margin.bottom; const clickX = (clientX - rect.left) / Math.max(1, rect.width) * width; const clickY = (clientY - rect.top) / Math.max(1, rect.height) * height; let nearest: number | null = null; let best = Number.POSITIVE_INFINITY;
  data.forEach((example, index) => { const point = projectPixels(projection, example.pixels); const x = margin.left + (point.x + 1) / 2 * plotW; const y = margin.top + (1 - (point.y + 1) / 2) * plotH; const distance = (x - clickX) ** 2 + (y - clickY) ** 2; if (distance < best) { best = distance; nearest = index; } }); return nearest;
}
