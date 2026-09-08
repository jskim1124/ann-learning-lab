export const PALETTE = {
  zero: "#3568d4", one: "#ee7b32", positive: "#2467d5", negative: "#b2456e",
  grid: "#d8dde6", ink: "#253047", test: "#111827",
};

export function canvasPoint(canvas: HTMLCanvasElement, x: number, y: number): [number, number] {
  return [((x + 1) / 2) * canvas.width, ((1 - y) / 2) * canvas.height];
}

export function clearAndGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  for (let value = -1; value <= 1.001; value += 0.25) {
    const [x] = canvasPoint(canvas, value, 0);
    const [, y] = canvasPoint(canvas, 0, value);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  const [x0, y0] = canvasPoint(canvas, 0, 0);
  ctx.strokeStyle = "#9da7b5"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, canvas.height); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(canvas.width, y0); ctx.stroke();
}

export function probabilityColor(probability: number): string {
  const low = [226, 236, 255];
  const middle = [248, 248, 250];
  const high = [255, 229, 210];
  const source = probability < 0.5 ? low : middle;
  const target = probability < 0.5 ? middle : high;
  const amount = probability < 0.5 ? probability * 2 : (probability - 0.5) * 2;
  return `rgb(${source.map((value, i) => Math.round(value + ((target[i] ?? value) - value) * amount)).join(",")})`;
}

