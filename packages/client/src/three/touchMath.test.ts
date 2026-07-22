import { describe, expect, it } from "vitest";
import { touchLookDelta, touchVector } from "./touchMath.js";

describe("touchVector", () => {
  it("normalizes a full-radius drag", () => {
    expect(touchVector(40, 0, 40)).toEqual({ x: 1, z: 0 });
  });

  it("preserves analog magnitude below the control radius", () => {
    expect(touchVector(0, -20, 40)).toEqual({ x: 0, z: 0.5 });
  });

  it("caps a drag outside the control radius", () => {
    expect(touchVector(0, 80, 40)).toEqual({ x: 0, z: -1 });
  });
});

describe("touchLookDelta", () => {
  it("converts a drag to yaw and pitch deltas", () => {
    expect(touchLookDelta(10, -5, 0.01)).toEqual({ yaw: -0.1, pitch: 0.05 });
  });
});
