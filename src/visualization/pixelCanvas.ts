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

function markedOmrChoice(pixels: number[]): number | null {
  const totals = OMR_CENTERS.map((center) => pixels.reduce((sum, value, index) => {
    if (value < .4) return sum;
    const x = index % PIXEL_SIZE + .5; const y = Math.floor(index / PIXEL_SIZE) + .5;
    return Math.abs(x - center) <= 1.6 && Math.abs(y - 7.5) <= 2.3 ? sum + value : sum;
  }, 0));
  const maximum = Math.max(...totals); return maximum > 0 ? totals.indexOf(maximum) : null;
}

export function drawOmrInputCanvas(canvas: HTMLCanvasElement, pixels: number[]): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const cell = canvas.width / PIXEL_SIZE; const selected = markedOmrChoice(pixels);
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#faf9f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(90,98,112,.12)"; context.lineWidth = Math.max(.65, canvas.width / 900);
  for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cell, 0); context.lineTo(index * cell, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cell); context.lineTo(canvas.width, index * cell); context.stroke(); }
  OMR_CENTERS.forEach((center, index) => {
    const left = (center - 1) * cell; const top = 4 * cell; const width = 2 * cell; const height = 7 * cell;
    if (index === selected) { context.fillStyle = "#17191d"; context.fillRect(left, top, width, height); }
    context.strokeStyle = "#17191d"; context.lineWidth = Math.max(1.5, cell * .07); context.strokeRect(left, top, width, height);
  });
}

export function drawPixelConversionFrame(canvas: HTMLCanvasElement, pixels: number[], task: PixelTaskName, progress: number): void {
  const context = canvas.getContext("2d"); if (!context) return; const amount = Math.max(0, Math.min(1, progress));
  const source = document.createElement("canvas"); source.width = canvas.width; source.height = canvas.height; if (task === "omr") drawOmrInputCanvas(source, pixels); else drawPixelCanvas(source, pixels, [], task);
  const pixelated = document.createElement("canvas"); pixelated.width = canvas.width; pixelated.height = canvas.height; drawPixelCanvas(pixelated, pixels, [], task);
  context.clearRect(0, 0, canvas.width, canvas.height); context.globalAlpha = 1; context.drawImage(source, 0, 0); context.globalAlpha = amount; context.drawImage(pixelated, 0, 0); context.globalAlpha = 1;
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
