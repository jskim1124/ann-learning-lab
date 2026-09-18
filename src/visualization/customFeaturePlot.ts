import type { CustomRow } from "../data/customDataset";
import type { DataPoint } from "../types";
import { canvasPoint, PALETTE } from "./canvasUtils";
import { CLASS_COLORS } from "./featureSurface";
import { drawCoordinateGrid, drawCoordinateTicks } from "./coordinateGrid";

export function drawCustomFeaturePlot(canvas: HTMLCanvasElement, points: DataPoint[], rows: CustomRow[]): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#f7f8fa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCoordinateGrid(ctx, {left:0, top:0, width:canvas.width, height:canvas.height});
  points.forEach((point, index) => {
    const [x, y] = canvasPoint(canvas, point.x, point.y);
    ctx.fillStyle = CLASS_COLORS[point.label % CLASS_COLORS.length] ?? PALETTE.zero; ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#394658"; ctx.font = "700 13px system-ui"; ctx.fillText(rows[index]?.name ?? `사례 ${index + 1}`, x + 12, y - 10);
  });
  drawCoordinateTicks(ctx, {left:0, top:0, width:canvas.width, height:canvas.height});
}
