export type LessonPoint = [number, number];
export type LessonStroke = LessonPoint[];

/** These are the actual zero-sum / equal-output lines of neuronLessonModel. */
export function targetValue(point: LessonPoint, output: boolean): number {
  return point[0] + .5 * point[1] - (output ? .5 : 0);
}

export function lineCrossing(a: LessonPoint, b: LessonPoint, output: boolean): LessonPoint | null {
  const av = targetValue(a, output), bv = targetValue(b, output);
  if (Math.abs(av) < 1e-9) return [...a];
  if (Math.abs(bv) < 1e-9) return [...b];
  if (av * bv >= 0) return null;
  const t = av / (av - bv);
  return [a[0] + t * (b[0]-a[0]), a[1] + t * (b[1]-a[1])];
}

export function traceHits(strokes: LessonStroke[], output: boolean): LessonPoint[] {
  const hits: LessonPoint[] = [];
  for (const stroke of strokes) {
    if (stroke[0] && Math.abs(targetValue(stroke[0], output)) < 1e-9) hits.push(stroke[0]);
    for (let i=1; i<stroke.length; i++) {
      const hit = lineCrossing(stroke[i-1]!, stroke[i]!, output);
      if (hit && !hits.some(p=>Math.hypot(p[0]-hit[0],p[1]-hit[1])<.015)) hits.push(hit);
    }
  }
  return hits;
}
