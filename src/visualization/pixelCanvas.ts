import { OMR_CENTERS, PIXEL_SIZE, type PixelTaskName } from "../data/pixelDatasets";
import { projectionAxisDetails, type PixelProjection } from "../core/pixelProjection";

export function drawPixelCanvas(canvas: HTMLCanvasElement, pixels: number[], highlight: number[] = [], task: PixelTaskName = "digits"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const cell = canvas.width / PIXEL_SIZE; context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#faf9f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  pixels.forEach((value, index) => {
    if (value <= 0) return;
    const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); const inset = task === "omr" ? Math.max(1, cell * .13) : 0;
    context.fillStyle = `rgba(35, 45, 58, ${Math.min(1, value)})`; context.fillRect(x * cell + inset, y * cell + inset, Math.max(1, cell - inset * 2), Math.max(1, cell - inset * 2));
  });
  context.strokeStyle = "#d8d7d2"; context.lineWidth = Math.max(.65, canvas.width / 700);
  for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cell, 0); context.lineTo(index * cell, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cell); context.lineTo(canvas.width, index * cell); context.stroke(); }
  highlight.forEach((index) => { const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); context.strokeStyle = "#e0a900"; context.lineWidth = Math.max(3, cell * .12); context.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4); });
}

export function omrChoiceAt(canvas: HTMLCanvasElement, clientX: number): number {
  const rect = canvas.getBoundingClientRect(); const normalized = (clientX - rect.left) / Math.max(1, rect.width) * PIXEL_SIZE;
  return OMR_CENTERS.reduce((best, center, index) => Math.abs(center - normalized) < Math.abs(OMR_CENTERS[best]! - normalized) ? index : best, 0);
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
