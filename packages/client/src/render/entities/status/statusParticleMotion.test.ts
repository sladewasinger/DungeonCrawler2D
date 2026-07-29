import { describe, expect, it } from "vitest";
import {
  emberVerticalOffset,
  oilVerticalOffset,
  particleAlpha,
  statusParticleNoise,
} from "./statusParticleMotion.js";

describe("entity status particle motion", () => {
  it("raises embers while oil droplets land and briefly fade at the ground plane", () => {
    expect(emberVerticalOffset(1, 32)).toBeLessThan(emberVerticalOffset(0, 32));
    expect(oilVerticalOffset(0.65, 32, 20)).toBe(20);
    expect(oilVerticalOffset(1, 32, 20)).toBe(20);
    expect(particleAlpha("oil", 0.65)).toBeGreaterThan(0);
    expect(particleAlpha("oil", 1)).toBe(0);
  });

  it("uses deterministic bounded noise rather than runtime randomness", () => {
    const first = statusParticleNoise(42, 3);
    expect(statusParticleNoise(42, 3)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
  });
});
