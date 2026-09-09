import { PIXEL_SIZE, type PixelTaskName } from "../data/pixelDatasets";
import { projectionAxisDetails, type PixelProjection } from "../core/pixelProjection";

function drawOmrGuide(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  const centers = [1.5, 4.25, 7, 9.75, 12.5]; const cell = canvas.width / PIXEL_SIZE; context.strokeStyle = "#303842"; context.lineWidth = Math.max(1.6, canvas.width * .007);
  centers.forEach((center) => { context.beginPath(); context.ellipse(center * cell, 7.5 * cell, cell * .92, cell * 1.12, 0, 0, Math.PI * 2); context.stroke(); });
}

export function drawPixelCanvas(canvas: HTMLCanvasElement, pixels: number[], highlight: number[] = [], task: PixelTaskName = "digits"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const cell = canvas.width / PIXEL_SIZE; context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#faf9f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  if (task === "omr") drawOmrGuide(context, canvas);
  if (task === "omr") {
    const ink = pixels.map((value, index) => ({ value, x: index % PIXEL_SIZE + .5, y: Math.floor(index / PIXEL_SIZE) + .5 })).filter(({ value, y }) => value >= .4 && y >= 5.5 && y <= 10.5); const total = ink.reduce((sum, point) => sum + point.value, 0);
    if (total > 0) { const x = ink.reduce((sum, point) => sum + point.x * point.value, 0) / total * cell; const y = ink.reduce((sum, point) => sum + point.y * point.value, 0) / total * cell; context.fillStyle = "rgba(35,45,58,.92)"; context.beginPath(); context.ellipse(x, y, cell * .78, cell * 1.02, -.08, 0, Math.PI * 2); context.fill(); context.strokeStyle = "rgba(255,255,255,.18)"; context.lineWidth = Math.max(1, cell * .08); [-.35, 0, .35].forEach((offset) => { context.beginPath(); context.moveTo(x - cell * .5, y + cell * offset); context.lineTo(x + cell * .48, y + cell * (offset - .15)); context.stroke(); }); }
  } else pixels.forEach((value, index) => { const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); if (value > 0) { context.fillStyle = `rgba(35, 45, 58, ${Math.min(1, value)})`; context.fillRect(x * cell, y * cell, cell, cell); } });
  if (task === "omr") drawOmrGuide(context, canvas); else { context.strokeStyle = "#d8d7d2"; context.lineWidth = 1; for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cell, 0); context.lineTo(index * cell, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cell); context.lineTo(canvas.width, index * cell); context.stroke(); } }
  highlight.forEach((index) => { const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); context.strokeStyle = "#e0a900"; context.lineWidth = Math.max(3, cell * .12); context.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4); });
}

export function omrChoiceAt(canvas: HTMLCanvasElement, clientX: number): number {
  const rect = canvas.getBoundingClientRect(); const normalized = (clientX - rect.left) / Math.max(1, rect.width) * PIXEL_SIZE; const centers = [1.5, 4.25, 7, 9.75, 12.5];
  return centers.reduce((best, center, index) => Math.abs(center - normalized) < Math.abs(centers[best]! - normalized) ? index : best, 0);
}

export function pixelIndexAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): number {
  const rect = canvas.getBoundingClientRect(); const x = Math.floor((clientX - rect.left) / rect.width * PIXEL_SIZE); const y = Math.floor((clientY - rect.top) / rect.height * PIXEL_SIZE);
  return Math.max(0, Math.min(PIXEL_SIZE * PIXEL_SIZE - 1, y * PIXEL_SIZE + x));
}

export function drawProjectionContribution(canvas: HTMLCanvasElement, pixels: number[], projection: PixelProjection, axis: "horizontal" | "vertical"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const details = projectionAxisDetails(projection, pixels, axis); const cellW = canvas.width / PIXEL_SIZE; const cellH = canvas.height / PIXEL_SIZE; const maximum = Math.max(1e-8, ...details.contributions.map((value) => Math.abs(value)));
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#f8f8f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  details.contributions.forEach((value, index) => { const strength = Math.min(1, Math.abs(value) / maximum); if (strength < .04) return; const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); context.fillStyle = value >= 0 ? `rgba(241,118,5,${.18 + strength * .82})` : `rgba(116,70,245,${.18 + strength * .82})`; context.fillRect(x * cellW, y * cellH, cellW + .2, cellH + .2); });
  context.strokeStyle = "rgba(90,98,112,.16)"; context.lineWidth = .6;
  for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cellW, 0); context.lineTo(index * cellW, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cellH); context.lineTo(canvas.width, index * cellH); context.stroke(); }
}
