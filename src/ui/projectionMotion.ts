/** Presentation-only positions. Never write these intermediate values into a dataset. */
export type Coordinate = readonly [number, number];
export interface ProjectionPlan {
  mode: 'place' | 'shift';
  from: Coordinate[];
  to: Coordinate[];
  examples: number[];
  duration: number;
}
export interface ProjectionFrame {
  points: (Coordinate | null)[];
  sample: number;
  stage: 'read' | 'squeeze' | 'move' | 'land' | 'remaining' | 'shift' | 'done';
  progress: number;
}
const EXAMPLE_MS = 2700;
const ease = (t: number) => t * t * (3 - 2 * t);
export function representativeRows(labels: number[]): number[] {
  const picked: number[] = [], seen = new Set<number>();
  // Labels only choose which examples to explain; they never determine coordinates.
  labels.forEach((label, i) => { if (picked.length < 3 && !seen.has(label)) { picked.push(i); seen.add(label); } });
  for (let i = 0; picked.length < Math.min(3, labels.length); i++) if (!picked.includes(i)) picked.push(i);
  return picked;
}
export function projectionPlan(mode: ProjectionPlan['mode'], from: Coordinate[], to: Coordinate[], labels: number[]): ProjectionPlan {
  return { mode, from: from.map(p => [...p]), to: to.map(p => [...p]), examples: representativeRows(labels), duration: mode === 'shift' ? 1500 : Math.min(3, to.length) * EXAMPLE_MS + 900 };
}
export function projectionFrame(plan: ProjectionPlan, elapsed: number): ProjectionFrame {
  const t = Math.max(0, elapsed), sample = plan.examples[0] ?? 0;
  if (t >= plan.duration) return { points: plan.to, sample, stage: 'done', progress: 1 };
  if (plan.mode === 'shift') {
    const progress = ease(t / plan.duration);
    return { sample, stage: 'shift', progress, points: plan.to.map((p, i) => {
      const old = plan.from[i] ?? p;
      // An unchanged axis stays bit-for-bit identical throughout the animation.
      return [old[0] === p[0] ? p[0] : old[0] + (p[0] - old[0]) * progress, old[1] === p[1] ? p[1] : old[1] + (p[1] - old[1]) * progress];
    }) };
  }
  const points: (Coordinate | null)[] = plan.to.map(() => null), index = Math.floor(t / EXAMPLE_MS);
  plan.examples.slice(0, index).forEach(i => { points[i] = plan.to[i]!; });
  if (index >= plan.examples.length) {
    const rest = plan.to.map((_, i) => i).filter(i => !plan.examples.includes(i));
    const progress = (t - plan.examples.length * EXAMPLE_MS) / 900;
    rest.slice(0, Math.ceil(progress * rest.length)).forEach(i => { points[i] = plan.to[i]!; });
    return { points, sample, stage: 'remaining', progress };
  }
  const active = plan.examples[index]!, local = t % EXAMPLE_MS;
  if (local < 1000) return { points, sample: active, stage: 'read', progress: local / 1000 };
  if (local < 1600) return { points, sample: active, stage: 'squeeze', progress: ease((local - 1000) / 600) };
  if (local < 2300) return { points, sample: active, stage: 'move', progress: ease((local - 1600) / 700) };
  points[active] = plan.to[active]!;
  return { points, sample: active, stage: 'land', progress: (local - 2300) / 400 };
}
