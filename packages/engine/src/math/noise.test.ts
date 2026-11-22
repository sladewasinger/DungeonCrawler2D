import { describe, expect, it } from "vitest";
import { clamp, fbm2d, hash2d, hashUnit2d, lerp, ridgeNoise2d, smoothstep, valueNoise2d } from "./noise.js";

describe("noise", () => {
  it("hashes deterministically across repeated calls", () => {
    const a = hash2d(1337, -19, 42);
    const b = hash2d(1337, -19, 42);
    const c = hash2d(1337, -18, 42);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("keeps unit hashes and noise within [0, 1]", () => {
    for (let x = -8; x <= 8; x++) {
      for (let y = -8; y <= 8; y++) {
        expect(hashUnit2d(99, x, y)).toBeGreaterThanOrEqual(0);
        expect(hashUnit2d(99, x, y)).toBeLessThan(1);
        const v = valueNoise2d({ seed: 99, x: x * 0.37, y: y * 0.37 });
        const f = fbm2d({ seed: 99, x: x * 0.25, y: y * 0.25, octaves: 4 });
        const r = ridgeNoise2d({ seed: 99, x: x * 0.25, y: y * 0.25, octaves: 3 });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    }
  });

  it("interpolates and clamps math helpers accurately", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});
