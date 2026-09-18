export interface PlotBox { left: number; top: number; width: number; height: number; }
export const COORDINATE_TICKS = [-1, -.5, 0, .5, 1] as const;
export function coordinatePosition(box: PlotBox, x: number, y: number) {
  return { x: box.left + (x + 1) * box.width / 2, y: box.top + (1 - y) * box.height / 2 };
}

/** Shared, numerical coordinates: origin and labels refer to the values used by the model. */
export function drawCoordinateGrid(ctx: CanvasRenderingContext2D, box: PlotBox): void {
  for (const value of COORDINATE_TICKS) {
    const p = coordinatePosition(box, value, value);
    ctx.strokeStyle = value === 0 ? "#7e8796" : "rgba(73,83,98,.16)";
    ctx.lineWidth = value === 0 ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(p.x, box.top); ctx.lineTo(p.x, box.top + box.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(box.left, p.y); ctx.lineTo(box.left + box.width, p.y); ctx.stroke();
  }
}

export function drawCoordinateTicks(ctx: CanvasRenderingContext2D, box: PlotBox): void {
  const origin = coordinatePosition(box, 0, 0);
  ctx.save(); ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  const label = (value: number, x: number, y: number) => {
    const text = String(value), width = text.length * 7 + 4;
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(x - width / 2, y - 11, width, 15);
    ctx.fillStyle = "#344054"; ctx.fillText(text, x, y);
  };
  for (const value of COORDINATE_TICKS) {
    const p = coordinatePosition(box, value, value);
    label(value, Math.max(box.left + 12, Math.min(box.left + box.width - 12, p.x)) + (value === 0 ? -10 : 0), origin.y + 17);
    if (value !== 0) label(value, origin.x - 17, Math.max(box.top + 12, Math.min(box.top + box.height - 4, p.y + 4)));
  }
  ctx.restore();
}
