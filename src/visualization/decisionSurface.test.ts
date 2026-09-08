import { describe, expect, it } from "vitest";
import { contourCell, hiddenBoundarySegment } from "./decisionSurface";

describe("causal decision-boundary geometry", () => {
  it("clips a hidden neuron's z=0 line to the input square", () => {
    expect(hiddenBoundarySegment(1, 1, 0)).toEqual([[-1, 1], [1, -1]]);
    expect(hiddenBoundarySegment(1, 0, -.25)).toEqual([[.25, -1], [.25, 1]]);
    expect(hiddenBoundarySegment(0, 0, 1)).toBeNull();
  });

  it("interpolates the final probability=0.5 contour inside a cell", () => {
    const segments = contourCell([[0, 0, .2], [1, 0, .8], [1, 1, .8], [0, 1, .2]]);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.[0][0]).toBeCloseTo(.5);
    expect(segments[0]?.[1][0]).toBeCloseTo(.5);
  });
});
