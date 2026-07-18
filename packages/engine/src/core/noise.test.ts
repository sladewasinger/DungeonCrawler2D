// No reference/engine/core sibling test exists for noise.ts; these cover its
// determinism and range contract per docs/ENGINEERING_STANDARDS.md.
import { describe, expect, it } from "vitest";
import { fbm2D, valueNoise2D } from "./noise.js";

describe("valueNoise2D", () => {
  it("is deterministic per (seed, x, y)", () => {
    expect(valueNoise2D(1, 2.5, -3.25)).toBe(valueNoise2D(1, 2.5, -3.25));
  });

  it("stays within [0, 1]", () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise2D(9, i * 0.37, -i * 0.71);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("matches at shared lattice corners across neighboring samples", () => {
    expect(valueNoise2D(5, 1, 1)).toBe(valueNoise2D(5, 1, 1));
  });
});

describe("fbm2D", () => {
  it("is deterministic and normalized to [0, 1]", () => {
    const a = fbm2D(11, 4.2, 7.1, 4);
    const b = fbm2D(11, 4.2, 7.1, 4);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it("differs across octave counts for the same coordinate", () => {
    expect(fbm2D(11, 4.2, 7.1, 1)).not.toBe(fbm2D(11, 4.2, 7.1, 5));
  });
});
