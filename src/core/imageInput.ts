/** Shared preprocessing for capture, preview, training and prediction. Values mean darkness. */
export const IMAGE_SIDE = 14;
export const IMAGE_INPUTS = IMAGE_SIDE * IMAGE_SIDE;

export function rgbaToPixels(rgba: Uint8ClampedArray): number[] {
  const values: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = (rgba[i + 3] ?? 255) / 255;
    const brightness = (.299 * (rgba[i] ?? 255) + .587 * (rgba[i + 1] ?? 255) + .114 * (rgba[i + 2] ?? 255)) / 255;
    values.push(Math.max(0, Math.min(1, (1 - brightness) * alpha)));
  }
  return values;
}

export function captureImage(source: CanvasImageSource, mirror = false): { pixels: number[]; image: string } {
  const width = source instanceof HTMLVideoElement ? source.videoWidth : (source as HTMLCanvasElement).width;
  const height = source instanceof HTMLVideoElement ? source.videoHeight : (source as HTMLCanvasElement).height;
  if (!width || !height) throw new Error("아직 영상이 준비되지 않았습니다.");
  // The square shown on screen is the same square used for inference. Never squash a frame.
  const side = Math.min(width, height);
  const original = document.createElement("canvas"); original.width = 224; original.height = 224;
  const ctx = original.getContext("2d")!;
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, 224, 224);
  if (mirror) { ctx.translate(224, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, 224, 224);
  const reduced = document.createElement("canvas"); reduced.width = IMAGE_SIDE; reduced.height = IMAGE_SIDE;
  const small = reduced.getContext("2d")!; small.imageSmoothingEnabled = true; small.imageSmoothingQuality = "high"; small.drawImage(original, 0, 0, IMAGE_SIDE, IMAGE_SIDE);
  return { pixels: rgbaToPixels(small.getImageData(0, 0, IMAGE_SIDE, IMAGE_SIDE).data), image: original.toDataURL("image/jpeg", .8) };
}

/** The displayed preview uses the exact values sent to the ANN; no threshold or added outlines. */
export function drawImagePixels(canvas: HTMLCanvasElement, pixels: number[], grid = false, highlight = -1): void {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const side = Math.round(Math.sqrt(pixels.length)); const cell = canvas.width / side;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  pixels.forEach((value, i) => { const shade = Math.round((1 - value) * 255); ctx.fillStyle = `rgb(${shade},${shade},${shade})`; ctx.fillRect(i % side * cell, Math.floor(i / side) * cell, cell + .1, cell + .1); });
  if (grid) {
    ctx.strokeStyle = "rgba(128,128,128,.35)"; ctx.lineWidth = .65;
    for (let i = 0; i <= side; i++) { ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, canvas.height); ctx.moveTo(0, i * cell); ctx.lineTo(canvas.width, i * cell); ctx.stroke(); }
  }
  if (highlight >= 0) { ctx.strokeStyle = "#f17605"; ctx.lineWidth = 3; ctx.strokeRect(highlight % side * cell + 1, Math.floor(highlight / side) * cell + 1, cell - 2, cell - 2); }
}
