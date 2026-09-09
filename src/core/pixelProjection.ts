import type { PixelExample, PixelModel } from "./pixelNetwork";
import type { PixelTaskName } from "../data/pixelDatasets";

export type PixelProjectionMode = "position" | "ink" | "learned";
export interface PixelProjection { mean: number[]; horizontal: number[]; vertical: number[]; horizontalScale: number; verticalScale: number; }
export interface ProjectionAxisDetails { contributions: number[]; rawScore: number; mapScore: number; }

function normalize(vector: number[]): number[] { const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1; return vector.map((value) => value / length); }
function dot(left: number[], right: number[]): number { return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0); }
function projectionFromAxes(data: PixelExample[], horizontalSeed: number[], verticalSeed: number[]): PixelProjection {
  const inputSize = data[0]?.pixels.length ?? 196; const mean = Array.from({ length: inputSize }, (_, index) => data.reduce((sum, example) => sum + (example.pixels[index] ?? 0), 0) / Math.max(1, data.length));
  const horizontal = normalize(horizontalSeed); const overlap = dot(verticalSeed, horizontal); const vertical = normalize(verticalSeed.map((value, index) => value - overlap * (horizontal[index] ?? 0)));
  const centered = data.map((example) => example.pixels.map((value, index) => value - (mean[index] ?? 0))); const horizontalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, horizontal)))); const verticalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, vertical))));
  return { mean, horizontal, vertical, horizontalScale, verticalScale };
}

export function createPixelProjection(data: PixelExample[]): PixelProjection {
  const inputSize = data[0]?.pixels.length ?? 196; const labels = [...new Set(data.map((example) => example.label))];
  const mean = Array.from({ length: inputSize }, (_, index) => data.reduce((sum, example) => sum + (example.pixels[index] ?? 0), 0) / Math.max(1, data.length));
  const classDirections = labels.map((label) => { const examples = data.filter((example) => example.label === label); return Array.from({ length: inputSize }, (_, index) => examples.reduce((sum, example) => sum + (example.pixels[index] ?? 0), 0) / Math.max(1, examples.length) - (mean[index] ?? 0)); });
  const middle = (labels.length - 1) / 2; const squaredMean = labels.reduce((sum, _, index) => sum + (index - middle) ** 2, 0) / Math.max(1, labels.length);
  const horizontal = normalize(Array.from({ length: inputSize }, (_, pixel) => classDirections.reduce((sum, direction, index) => sum + (direction[pixel] ?? 0) * (index - middle), 0)));
  const verticalSeed = Array.from({ length: inputSize }, (_, pixel) => classDirections.reduce((sum, direction, index) => sum + (direction[pixel] ?? 0) * ((index - middle) ** 2 - squaredMean), 0)); const overlap = dot(verticalSeed, horizontal); const vertical = normalize(verticalSeed.map((value, index) => value - overlap * (horizontal[index] ?? 0)));
  const centered = data.map((example) => example.pixels.map((value, index) => value - (mean[index] ?? 0))); const horizontalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, horizontal)))); const verticalScale = Math.max(.001, ...centered.map((row) => Math.abs(dot(row, vertical))));
  return { mean, horizontal, vertical, horizontalScale, verticalScale };
}

export function createPixelFeatureProjection(data: PixelExample[], task: PixelTaskName, mode: PixelProjectionMode): PixelProjection {
  if (mode === "learned") return createPixelProjection(data);
  const size = Math.round(Math.sqrt(data[0]?.pixels.length ?? 196)); const middle = (size - 1) / 2;
  if (mode === "position") {
    const horizontal = Array.from({ length: size * size }, (_, index) => index % size - middle); const vertical = Array.from({ length: size * size }, (_, index) => Math.floor(index / size) - middle);
    return projectionFromAxes(data, horizontal, vertical);
  }
  const amount = Array<number>(size * size).fill(1); const spread = Array.from({ length: size * size }, (_, index) => { const x = index % size - middle; const y = Math.floor(index / size) - middle; return Math.hypot(x, y); }); const averageSpread = spread.reduce((sum, value) => sum + value, 0) / spread.length;
  return projectionFromAxes(data, amount, spread.map((value) => value - averageSpread + (task === "omr" ? Math.abs(value - averageSpread) * .02 : 0)));
}

export function projectionAxisDetails(projection: PixelProjection, pixels: number[], axis: "horizontal" | "vertical"): ProjectionAxisDetails {
  const direction = projection[axis]; const scale = axis === "horizontal" ? projection.horizontalScale : projection.verticalScale; const contributions = pixels.map((value, index) => (value - (projection.mean[index] ?? 0)) * (direction[index] ?? 0)); const rawScore = contributions.reduce((sum, value) => sum + value, 0);
  return { contributions, rawScore, mapScore: Math.max(-1, Math.min(1, rawScore / scale)) };
}

export function projectPixels(projection: PixelProjection, pixels: number[]): { x: number; y: number } { return { x: projectionAxisDetails(projection, pixels, "horizontal").mapScore, y: projectionAxisDetails(projection, pixels, "vertical").mapScore }; }

export function reconstructProjectedPixels(projection: PixelProjection, x: number, y: number): number[] {
  return projection.mean.map((mean, index) => mean + x * projection.horizontalScale * (projection.horizontal[index] ?? 0) + y * projection.verticalScale * (projection.vertical[index] ?? 0));
}

export function constrainPixelModelToProjection(model: PixelModel, projection: PixelProjection): PixelModel {
  const inputHidden = model.inputHidden.map((weights) => { const horizontalAmount = projection.horizontalScale * dot(weights, projection.horizontal); const verticalAmount = projection.verticalScale * dot(weights, projection.vertical); return weights.map((_, index) => horizontalAmount * (projection.horizontal[index] ?? 0) / projection.horizontalScale + verticalAmount * (projection.vertical[index] ?? 0) / projection.verticalScale); });
  return { ...model, inputHidden };
}

export function projectionExtremes(projection: PixelProjection, data: PixelExample[], axis: "horizontal" | "vertical"): { negative: PixelExample; positive: PixelExample } {
  const sorted = [...data].sort((left, right) => (axis === "horizontal" ? projectPixels(projection, left.pixels).x - projectPixels(projection, right.pixels).x : projectPixels(projection, left.pixels).y - projectPixels(projection, right.pixels).y));
  return { negative: sorted[0]!, positive: sorted[sorted.length - 1]! };
}
