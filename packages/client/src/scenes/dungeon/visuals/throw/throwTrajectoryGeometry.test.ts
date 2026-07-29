/** Focused checks for the pure trajectory sampler. */
import { describe, expect, it } from "vitest";
import { parabolicThrowArc } from "./throwTrajectoryGeometry.js";

describe("parabolic throw trajectory", () => {
  it("starts and lands exactly while rising above both endpoints", () => {
    const points = parabolicThrowArc({
      origin: { x: 1, y: 2, z: 0.75 },
      target: { x: 5, y: 2, z: 0.1 },
      segments: 4,
    });
    expect(points[0]).toEqual({ x: 1, y: 2, z: 0.75 });
    expect(points[4]).toEqual({ x: 5, y: 2, z: 0.1 });
    expect(points[2]!.z).toBeGreaterThan(0.75);
  });
});
