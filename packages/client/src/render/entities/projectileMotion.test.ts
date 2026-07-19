// Headless tests for the projectile velocity-to-facing-angle conversion.
import { describe, expect, it } from "vitest";
import { velocityAngleDegrees } from "./projectileMotion.js";

describe("velocityAngleDegrees", () => {
  it("is 0 for a stationary projectile", () => {
    expect(velocityAngleDegrees(0, 0)).toBe(0);
  });

  it("points along the cardinal directions correctly", () => {
    expect(velocityAngleDegrees(1, 0)).toBeCloseTo(0, 5);
    expect(velocityAngleDegrees(0, 1)).toBeCloseTo(90, 5);
    expect(velocityAngleDegrees(-1, 0)).toBeCloseTo(180, 5);
    expect(velocityAngleDegrees(0, -1)).toBeCloseTo(-90, 5);
  });
});
