import type { PixelExample } from "../core/pixelNetwork";

export type PixelTaskName = "digits" | "omr";
export const PIXEL_SIZE = 14;
export const PIXEL_INPUTS = PIXEL_SIZE * PIXEL_SIZE;
export const OMR_CENTERS = [1, 4, 7, 10, 13] as const;

export const PIXEL_TASKS = {
  digits: { title: "내가 그린 숫자를 읽을까?", question: "친구마다 다르게 쓴 0·1·2를 그림 그대로 보고 구별할 수 있을까요?", story: "종이에 쓴 숫자는 크기와 기울기, 선 굵기가 모두 달라요. 숫자를 몇 가지 말로 바꾸지 않고 14×14칸의 밝기 196개를 그대로 보여 주면, 신경망은 여러 그림에서 되풀이되는 무늬를 찾습니다.", classes: ["0", "1", "2"], hiddenUnits: 2 },
  omr: { title: "OMR 답을 읽을 수 있을까?", question: "다섯 답 칸 중 진하게 칠한 칸을 그림만 보고 읽을 수 있을까요?", story: "OMR 답 칸은 같은 모양으로 나란히 있지만, 연필 자국은 위치와 진하기가 조금씩 달라요. 한 문항의 칸 그림 전체를 196개 밝기로 바꾸어 신경망에 보여 줍니다.", classes: ["①", "②", "③", "④", "⑤"], hiddenUnits: 4 },
} as const;

function randomSource(seed: number): () => number { let value = seed >>> 0; return () => { value = Math.imul(1664525, value) + 1013904223 >>> 0; return value / 4294967296; }; }
function blank(): number[] { return Array<number>(PIXEL_INPUTS).fill(0); }
function put(pixels: number[], x: number, y: number, value = 1, radius = 0): void {
  for (let dy = -radius; dy <= radius; dy += 1) for (let dx = -radius; dx <= radius; dx += 1) {
    const px = x + dx; const py = y + dy;
    if (px >= 0 && px < PIXEL_SIZE && py >= 0 && py < PIXEL_SIZE) { const index = py * PIXEL_SIZE + px; pixels[index] = Math.max(pixels[index] ?? 0, value); }
  }
}
function line(pixels: number[], x0: number, y0: number, x1: number, y1: number, radius = 0): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step += 1) put(pixels, Math.round(x0 + (x1 - x0) * step / steps), Math.round(y0 + (y1 - y0) * step / steps), 1, radius);
}
function digit(label: number, dx = 0, dy = 0, thick = 0): number[] {
  const p = blank();
  if (label === 0) { line(p, 4 + dx, 2 + dy, 9 + dx, 2 + dy, thick); line(p, 3 + dx, 3 + dy, 3 + dx, 10 + dy, thick); line(p, 10 + dx, 3 + dy, 10 + dx, 10 + dy, thick); line(p, 4 + dx, 11 + dy, 9 + dx, 11 + dy, thick); }
  if (label === 1) { line(p, 5 + dx, 4 + dy, 7 + dx, 2 + dy, thick); line(p, 7 + dx, 2 + dy, 7 + dx, 11 + dy, thick); line(p, 5 + dx, 11 + dy, 9 + dx, 11 + dy, thick); }
  if (label === 2) { line(p, 3 + dx, 3 + dy, 5 + dx, 2 + dy, thick); line(p, 5 + dx, 2 + dy, 9 + dx, 2 + dy, thick); line(p, 10 + dx, 3 + dy, 10 + dx, 5 + dy, thick); line(p, 10 + dx, 5 + dy, 3 + dx, 11 + dy, thick); line(p, 3 + dx, 11 + dy, 10 + dx, 11 + dy, thick); }
  return p;
}
function omrBox(pixels: number[], centerX: number, centerY: number, value: number, filled: boolean): void {
  for (let y = 4; y <= 10; y += 1) for (let x = 0; x < PIXEL_SIZE; x += 1) {
    const insideX = Math.abs(x + .5 - centerX) <= 1.05; const insideY = Math.abs(y + .5 - centerY) <= 3.5;
    const edge = Math.abs(x + .5 - centerX) >= .72 || Math.abs(y + .5 - centerY) >= 2.9;
    if (insideX && insideY && (filled || edge)) put(pixels, x, y, value);
  }
}
function emptyOmr(): number[] {
  const pixels = blank(); OMR_CENTERS.forEach((center) => omrBox(pixels, center, 7.5, .22, false)); return pixels;
}
function omr(label: number, variation = 0): number[] {
  const pixels = emptyOmr(); const selected = OMR_CENTERS[label];
  if (selected === undefined) return pixels;
  const left = selected - 1; const right = selected; const top = 4 + variation % 3 - 1; const bottom = 10 + Math.floor(variation / 3) % 3 - 1;
  line(pixels, left, top, right, bottom);
  if (variation % 2 === 0) line(pixels, right, top, left, bottom);
  if (variation % 5 === 0) {
    const overflowX = Math.max(0, Math.min(PIXEL_SIZE - 1, left + (label % 2 === 0 ? -1 : 2)));
    line(pixels, overflowX, 6, overflowX, 8);
  }
  return pixels;
}
function vary(pixels: number[], random: () => number): number[] {
  return pixels.map((value) => {
    if (value > 0 && value < .4) return Math.max(.16, value + (random() - .5) * .08);
    if (value > 0 && random() < .06) return .25;
    if (value === 0 && random() < .008) return .2;
    return value > 0 ? Math.max(.45, value - random() * .18) : 0;
  });
}

export function sampleForClass(task: PixelTaskName, label: number, variation = 0): number[] {
  const dx = variation % 3 - 1; const dy = Math.floor(variation / 3) % 3 - 1;
  return task === "digits" ? digit(label, dx, dy, variation % 4 === 0 ? 1 : 0) : omr(label, variation);
}
export function createPixelDataset(task: PixelTaskName): PixelExample[] {
  const random = randomSource(task === "digits" ? 2048 : 4096); const count = task === "digits" ? 24 : 18; const result: PixelExample[] = [];
  PIXEL_TASKS[task].classes.forEach((_, label) => { for (let index = 0; index < count; index += 1) result.push({ pixels: vary(sampleForClass(task, label, index), random), label }); });
  return result;
}
export function emptyDrawing(task: PixelTaskName): number[] { return task === "omr" ? emptyOmr() : blank(); }
