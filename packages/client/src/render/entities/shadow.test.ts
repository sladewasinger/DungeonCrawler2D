// Headless test for the shadow's height-scaling curve (Phaser glue itself needs a
// live scene, so only the pure math is unit-tested here).
import { describe, expect, it } from "vitest";
import { shadowScaleForHeight } from "./shadow.js";

describe("shadowScaleForHeight", () => {
  it("is full size while grounded", () => {
    expect(shadowScaleForHeight(0)).toBe(1);
  });

  it("shrinks as height above ground grows", () => {
    const low = shadowScaleForHeight(0.5);
    const high = shadowScaleForHeight(1.5);
    expect(low).toBeLessThan(1);
    expect(high).toBeLessThan(low);
  });

  it("never shrinks past the readability floor", () => {
    expect(shadowScaleForHeight(50)).toBeGreaterThan(0);
    expect(shadowScaleForHeight(50)).toBe(shadowScaleForHeight(20));
  });
});
