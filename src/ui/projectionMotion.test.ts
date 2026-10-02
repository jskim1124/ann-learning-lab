import { describe, expect, it } from 'vitest';
import { projectionFrame, projectionPlan, representativeRows, type Coordinate } from './projectionMotion';
describe('data-to-point presentation timeline', () => {
  const points: Coordinate[] = [[-.75,.6],[.1,-.5],[.9,.1],[-.3,.8]];
  it('explains at most three real rows, including distinct classes when present', () => {
    expect(representativeRows([0,0,0,1,1,2,2])).toEqual([0,3,5]);
    expect(representativeRows([0,0,0,0])).toEqual([0,1,2]);
    expect(representativeRows([])).toEqual([]);
    expect(representativeRows([1])).toEqual([0]);
  });
  it('reveals representative rows in order, then every remaining row exactly once', () => {
    const plan = projectionPlan('place', [], points, [0,1,2,2]);
    expect(projectionFrame(plan, 0).points.every(p => p === null)).toBe(true);
    expect(projectionFrame(plan, 1200).stage).toBe('squeeze');
    expect(projectionFrame(plan, 2000).stage).toBe('move');
    expect(projectionFrame(plan, 2600).points).toEqual([points[0],null,null,null]);
    expect(projectionFrame(plan, 2800).sample).toBe(1);
    expect(projectionFrame(plan, 8500).stage).toBe('remaining');
    expect(projectionFrame(plan, plan.duration).points).toEqual(points);
    expect(projectionFrame(plan, 1e8).points).toEqual(points);
  });
  it.each([0,1] as const)('axis %i moves continuously without changing the other coordinate', axis => {
    const to = points.map(p => p.map((v, i) => i === axis ? -v : v) as [number,number]);
    const original = JSON.stringify(points), plan = projectionPlan('shift', points, to, [0,1,2,2]);
    for (const t of [0,16,300,700,1200,1499,1500]) {
      projectionFrame(plan,t).points.forEach((p, i) => expect(p![1-axis]).toBe(points[i]![1-axis]));
    }
    const middle=projectionFrame(plan,750).points;
    middle.forEach(p => expect(p![axis]).toBeCloseTo(0,12));
    expect(projectionFrame(plan,1500).points).toEqual(to);expect(JSON.stringify(points)).toBe(original);
  });
  it('a one-axis view unfolds vertically into the actual two-feature coordinates', () => {
    const flat=points.map(p=>[p[0],0] as Coordinate),plan=projectionPlan('shift',flat,points,[0,1,2,2]);
    expect(projectionFrame(plan,0).points).toEqual(flat);
    expect(projectionFrame(plan,750).points).toEqual(points.map(p=>[p[0],p[1]/2]));
    expect(projectionFrame(plan,1500).points).toEqual(points);
  });
});
