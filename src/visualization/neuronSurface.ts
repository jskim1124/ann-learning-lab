import { activate } from "../core/neuralNetwork";
import type { NetworkModel } from "../types";
import { probabilityColor } from "./canvasUtils";

export function drawNeuronSurface(canvas: HTMLCanvasElement, model: NetworkModel, index: number): void {
  const ctx = canvas.getContext("2d");
  const weights = model.parameters.inputHidden[index];
  if (!ctx || !weights) return;
  const bias = model.parameters.hiddenBias[index] ?? 0;
  const grid = 42;
  const width = canvas.width / grid;
  const height = canvas.height / grid;
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const x = -1 + ((col + 0.5) / grid) * 2;
      const y = 1 - ((row + 0.5) / grid) * 2;
      const a = activate(weights[0] * x + weights[1] * y + bias, model.config.activation);
      const normalized = model.config.activation === "tanh" ? (a + 1) / 2 : model.config.activation === "relu" ? Math.min(1, a / 2) : a;
      ctx.fillStyle = probabilityColor(normalized);
      ctx.fillRect(col * width, row * height, width + 1, height + 1);
    }
  }
  ctx.strokeStyle = "#242d3d"; ctx.lineWidth = 2;
  const intersections: [number, number][] = [];
  const candidates: [number, number][] = [
    [-1, (-bias + weights[0]) / weights[1]], [1, (-bias - weights[0]) / weights[1]],
    [(-bias + weights[1]) / weights[0], -1], [(-bias - weights[1]) / weights[0], 1],
  ];
  for (const [x, y] of candidates) if (Number.isFinite(x) && Number.isFinite(y) && x >= -1 && x <= 1 && y >= -1 && y <= 1) intersections.push([x, y]);
  if (intersections.length >= 2) {
    const first = intersections[0]; const second = intersections[1];
    if (first && second) {
      ctx.beginPath(); ctx.moveTo(((first[0] + 1) / 2) * canvas.width, ((1 - first[1]) / 2) * canvas.height);
      ctx.lineTo(((second[0] + 1) / 2) * canvas.width, ((1 - second[1]) / 2) * canvas.height); ctx.stroke();
    }
  }
}
