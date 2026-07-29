// Headless tests for ground-item bob/glint motion curves.
import { describe, expect, it } from "vitest";
import { bobOffsetPx, glintStrength } from "./groundItemMotion.js";

describe("bobOffsetPx", () => {
  it("never lifts the sprite down, only up (<=0)", () => {
    for (const ms of [0, 200, 700, 1400, 2100]) {
      expect(bobOffsetPx(ms)).toBeLessThanOrEqual(0);
    }
  });

  it("varies over the bob period", () => {
    expect(bobOffsetPx(350)).not.toBe(bobOffsetPx(0));
  });
});

describe("glintStrength", () => {
  it("stays within 0..1", () => {
    for (const ms of [0, 100, 450, 900, 1800]) {
      const strength = glintStrength(ms);
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    }
  });
});
