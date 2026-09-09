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

export function drawOmrInputCanvas(canvas: HTMLCanvasElement, pixels: number[]): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const cell = canvas.width / PIXEL_SIZE;
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#faf9f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(90,98,112,.12)"; context.lineWidth = Math.max(.65, canvas.width / 900);
  for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cell, 0); context.lineTo(index * cell, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cell); context.lineTo(canvas.width, index * cell); context.stroke(); }
  pixels.forEach((value, index) => {
    if (value < .4) return;
    const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE);
    context.fillStyle = `rgba(23,25,29,${Math.min(1, value)})`; context.fillRect(x * cell, y * cell, cell, cell);
  });
  OMR_CENTERS.forEach((center) => {
    const left = (center - 1) * cell; const top = 4 * cell; const width = 2 * cell; const height = 7 * cell;
    context.strokeStyle = "#17191d"; context.lineWidth = Math.max(1.5, cell * .07); context.strokeRect(left, top, width, height);
  });
}

export function drawPixelConversionFrame(canvas: HTMLCanvasElement, pixels: number[], task: PixelTaskName, progress: number): void {
  const context = canvas.getContext("2d"); if (!context) return; const amount = Math.max(0, Math.min(1, progress));
  const source = document.createElement("canvas"); source.width = canvas.width; source.height = canvas.height; if (task === "omr") drawOmrInputCanvas(source, pixels); else drawPixelCanvas(source, pixels, [], task);
  const pixelated = document.createElement("canvas"); pixelated.width = canvas.width; pixelated.height = canvas.height; drawPixelCanvas(pixelated, pixels, [], task);
  context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(source, 0, 0);
  if (amount > 0) {
    context.save(); context.beginPath(); context.rect(0, 0, canvas.width * amount, canvas.height); context.clip(); context.drawImage(pixelated, 0, 0); context.restore();
    if (amount < 1) { const scanX = canvas.width * amount; context.strokeStyle = "#1769d2"; context.lineWidth = Math.max(2, canvas.width / 80); context.beginPath(); context.moveTo(scanX, 0); context.lineTo(scanX, canvas.height); context.stroke(); }
  }
}

export function pixelIndexAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): number {
  const rect = canvas.getBoundingClientRect(); const x = Math.floor((clientX - rect.left) / rect.width * PIXEL_SIZE); const y = Math.floor((clientY - rect.top) / rect.height * PIXEL_SIZE);
  return Math.max(0, Math.min(PIXEL_SIZE * PIXEL_SIZE - 1, y * PIXEL_SIZE + x));
}

export function pixelLineIndices(from: number, to: number): number[] {
  const fromX = from % PIXEL_SIZE; const fromY = Math.floor(from / PIXEL_SIZE); const toX = to % PIXEL_SIZE; const toY = Math.floor(to / PIXEL_SIZE);
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  if (steps === 0) return [Math.max(0, Math.min(PIXEL_SIZE * PIXEL_SIZE - 1, from))];
  const result: number[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(fromX + (toX - fromX) * step / steps); const y = Math.round(fromY + (toY - fromY) * step / steps); const index = y * PIXEL_SIZE + x;
    if (result[result.length - 1] !== index) result.push(index);
  }
  return result;
}

export function drawProjectionContribution(canvas: HTMLCanvasElement, pixels: number[], projection: PixelProjection, axis: "horizontal" | "vertical"): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const details = projectionAxisDetails(projection, pixels, axis); const cellW = canvas.width / PIXEL_SIZE; const cellH = canvas.height / PIXEL_SIZE; const maximum = Math.max(1e-8, ...details.contributions.map((value) => Math.abs(value)));
  context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = "#f8f8f5"; context.fillRect(0, 0, canvas.width, canvas.height);
  details.contributions.forEach((value, index) => { const strength = Math.min(1, Math.abs(value) / maximum); if (strength < .04) return; const x = index % PIXEL_SIZE; const y = Math.floor(index / PIXEL_SIZE); context.fillStyle = value >= 0 ? `rgba(241,118,5,${.18 + strength * .82})` : `rgba(116,70,245,${.18 + strength * .82})`; context.fillRect(x * cellW, y * cellH, cellW + .2, cellH + .2); });
  context.strokeStyle = "rgba(90,98,112,.16)"; context.lineWidth = .6;
  for (let index = 0; index <= PIXEL_SIZE; index += 1) { context.beginPath(); context.moveTo(index * cellW, 0); context.lineTo(index * cellW, canvas.height); context.stroke(); context.beginPath(); context.moveTo(0, index * cellH); context.lineTo(canvas.width, index * cellH); context.stroke(); }
}
