import { describe, expect, it } from "vitest";
import {
  fireSparkVerticalOffset,
  oilVerticalOffset,
  particleAlpha,
  poisonGasVerticalOffset,
  statusParticleNoise,
} from "./statusParticleMotion.js";

describe("pooled entity status particle motion", () => {
  it("raises fire sparks and poison gas while oil drops land", () => {
    expect(fireSparkVerticalOffset(1, 32))
      .toBeLessThan(fireSparkVerticalOffset(0, 32));
    expect(poisonGasVerticalOffset(1, 32))
      .toBeLessThan(poisonGasVerticalOffset(0, 32));
    expect(oilVerticalOffset(0.65, 32, 20)).toBe(20);
    expect(particleAlpha("oil-drop", 0.65)).toBeGreaterThan(0);
    expect(particleAlpha("oil-drop", 1)).toBe(0);
  });

  it("uses deterministic bounded noise rather than runtime randomness", () => {
    const first = statusParticleNoise(42, 3);
    expect(statusParticleNoise(42, 3)).toBe(first);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(1);
  });
});
