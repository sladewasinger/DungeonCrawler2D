// Headless tests for the flicker noise curves: bounded, deterministic, seed-differentiated.
import { describe, expect, it } from "vitest";
import { flickerAlpha, flickerScale } from "./lightSource.js";

describe("flickerScale", () => {
  it("stays within a small band around 1", () => {
    for (let t = 0; t < 5000; t += 137) {
      const v = flickerScale(t, 3);
      expect(v).toBeGreaterThan(0.8);
      expect(v).toBeLessThan(1.2);
    }
  });

  it("is deterministic for the same (nowMs, seed)", () => {
    expect(flickerScale(1234, 7)).toBe(flickerScale(1234, 7));
  });

  it("differs across seeds at the same instant (no lockstep)", () => {
    expect(flickerScale(1000, 1)).not.toBe(flickerScale(1000, 2));
  });
});

describe("flickerAlpha", () => {
  it("stays within a small band around 1", () => {
    for (let t = 0; t < 5000; t += 211) {
      const v = flickerAlpha(t, 5);
      expect(v).toBeGreaterThan(0.7);
      expect(v).toBeLessThan(1.3);
    }
  });
});
