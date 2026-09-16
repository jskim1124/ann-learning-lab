import { initializePixelModel, trainPixelModel, type PixelExample, type PixelModel } from "./pixelNetwork";
import { constrainPixelModelToProjection, projectPixels, type PixelProjection } from "./pixelProjection";

/** A deliberately wrong, reproducible starting model. Every later frame is an actual update. */
export function featureMovementExample(data: PixelExample[], projection: PixelProjection, classCount: number) {
  const index = data.reduce((best, row, i) => {
    const p = projectPixels(projection, row.pixels), q = projectPixels(projection, data[best]!.pixels);
    return Math.hypot(p.x, p.y) < Math.hypot(q.x, q.y) ? i : best;
  }, 0);
  const example = data[index]!;
  const model = initializePixelModel(example.pixels.length, 1, classCount, 93);
  model.inputHidden[0] = projection.horizontal.map((w, i) => .8 * w / projection.horizontalScale + .6 * projection.vertical[i]! / projection.verticalScale);
  model.hiddenBias[0] = -.4 - model.inputHidden[0].reduce((sum, w, i) => sum + w * example.pixels[i]!, 0);
  model.hiddenOutput = Array.from({ length: classCount }, (_, label) => [label === example.label ? 1.2 : -1.2 / (classCount - 1)]);
  model.outputBias = Array(classCount).fill(0);
  const frames: PixelModel[] = [model];
  // Small steps preserve the observable direction, instead of drawing a desired ending by hand.
  for (let i = 0; i < 30; i++) frames.push(constrainPixelModelToProjection(trainPixelModel(frames.at(-1)!, [example], 1, .025), projection));
  return { index, example, frames };
}
