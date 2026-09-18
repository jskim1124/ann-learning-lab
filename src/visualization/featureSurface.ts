import { forwardPixels, type PixelExample, type PixelModel } from "../core/pixelNetwork";
import { classContours, type ScorePoint } from "./classContours";
import { canvasPoint } from "./canvasUtils";
import { drawCoordinateGrid, drawCoordinateTicks } from "./coordinateGrid";
import { hiddenBoundarySegment, HIDDEN_COLORS } from "./decisionSurface";

export const CLASS_COLORS = ["#f17605", "#df466f", "#7446f5", "#1f6bd6", "#1558b7", "#a93658"];

function winningClass(model: PixelModel, x: number, y: number): { label: number; confidence: number } {
  const values = forwardPixels(model, [x, y]).probabilities; const confidence = Math.max(...values);
  return { label: values.indexOf(confidence), confidence };
}

function softColor(hex: string, confidence: number): string {
  const value = hex.replace("#", ""); const red = Number.parseInt(value.slice(0, 2), 16); const green = Number.parseInt(value.slice(2, 4), 16); const blue = Number.parseInt(value.slice(4, 6), 16);
  const amount = .09 + Math.max(0, confidence - .5) * .2;
  return `rgb(${Math.round(255 + (red - 255) * amount)},${Math.round(255 + (green - 255) * amount)},${Math.round(255 + (blue - 255) * amount)})`;
}

export function drawFeatureSurface(canvas: HTMLCanvasElement, model: PixelModel, data: PixelExample[], testInput: { x: number; y: number }, options: { showNeuronBoundaries?: boolean; showDecisionBoundary?: boolean; showProbe?: boolean; selectedPoint?: number | null } = {}): void {
  const context = canvas.getContext("2d"); if (!context) return;
  const grid = 120; const cellWidth = canvas.width / grid; const cellHeight = canvas.height / grid;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const x = -1 + (column + .5) / grid * 2; const y = 1 - (row + .5) / grid * 2; const winner = winningClass(model, x, y);
      context.fillStyle = softColor(CLASS_COLORS[winner.label % CLASS_COLORS.length]!, winner.confidence); context.fillRect(column * cellWidth, row * cellHeight, Math.ceil(cellWidth) + 1, Math.ceil(cellHeight) + 1);
    }
  }
  context.strokeStyle = "rgba(66,75,90,.16)"; context.lineWidth = 1;
  drawCoordinateGrid(context, {left:0, top:0, width:canvas.width, height:canvas.height});
  if (options.showNeuronBoundaries !== false) model.inputHidden.forEach((weights, neuron) => {
    const segment = hiddenBoundarySegment(weights[0] ?? 0, weights[1] ?? 0, model.hiddenBias[neuron] ?? 0); if (!segment) return;
    const start = canvasPoint(canvas, ...segment[0]); const end = canvasPoint(canvas, ...segment[1]); const color = HIDDEN_COLORS[neuron % HIDDEN_COLORS.length]!;
    context.save(); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = 2.5; context.globalAlpha = .82; context.beginPath(); context.moveTo(...start); context.lineTo(...end); context.stroke();
    const middleX = (start[0] + end[0]) / 2; const middleY = (start[1] + end[1]) / 2; const length = Math.hypot(weights[0] ?? 0, weights[1] ?? 0) || 1; const dx = (weights[0] ?? 0) / length * 22; const dy = -(weights[1] ?? 0) / length * 22;
    context.beginPath(); context.moveTo(middleX, middleY); context.lineTo(middleX + dx, middleY + dy); context.stroke(); context.beginPath(); context.moveTo(middleX+dx,middleY+dy); context.lineTo(middleX+dx*.65-dy*.22,middleY+dy*.65+dx*.22); context.lineTo(middleX+dx*.65+dy*.22,middleY+dy*.65-dx*.22); context.closePath(); context.fill(); context.restore();
  });
  if (options.showDecisionBoundary !== false) {
    context.strokeStyle = "#111827"; context.lineWidth = 2.8; context.lineCap = "round"; context.lineJoin = "round"; context.beginPath();
    const vertices:ScorePoint[][]=Array.from({length:grid+1},(_,r)=>Array.from({length:grid+1},(_,c)=>({x:c*cellWidth,y:r*cellHeight,scores:forwardPixels(model,[-1+c/grid*2,1-r/grid*2]).logits})));
    for(let r=0;r<grid;r++)for(let c=0;c<grid;c++)for(const [a,b] of classContours([vertices[r]![c]!,vertices[r]![c+1]!,vertices[r+1]![c+1]!,vertices[r+1]![c]!])){context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);}
    context.stroke();
  }
  data.forEach((example, index) => {
    const [x, y] = canvasPoint(canvas, example.pixels[0] ?? 0, example.pixels[1] ?? 0); const color = CLASS_COLORS[example.label % CLASS_COLORS.length]!;
    context.beginPath(); context.arc(x, y, 8, 0, Math.PI * 2); context.fillStyle = color; context.fill(); context.strokeStyle = "white"; context.lineWidth = 2.5; context.stroke(); context.fillStyle = "#303b4a"; context.font = "700 11px system-ui"; context.fillText(String(index + 1), x + 10, y - 9);
  });
  if (options.selectedPoint !== undefined && options.selectedPoint !== null && data[options.selectedPoint]) {
    const p=data[options.selectedPoint]!.pixels;const [x,y]=canvasPoint(canvas,p[0]!,p[1]!);context.strokeStyle="#202633";context.lineWidth=3;context.beginPath();context.arc(x,y,12,0,Math.PI*2);context.stroke();
  }
  drawCoordinateTicks(context, {left:0, top:0, width:canvas.width, height:canvas.height});
  if(options.showProbe===false)return;
  const [testX, testY] = canvasPoint(canvas, testInput.x, testInput.y); context.strokeStyle = "#111827"; context.lineWidth = 3; context.beginPath(); context.arc(testX, testY, 8, 0, Math.PI * 2); context.stroke();
}
