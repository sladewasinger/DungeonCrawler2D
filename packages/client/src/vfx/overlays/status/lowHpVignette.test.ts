// Headless tests for the low-hp heartbeat vignette curve.
import { describe, expect, it } from "vitest";
import { LOW_HP_RATIO, heartbeatPeriodMs, isLowHp, lowHpVignetteAlpha } from "./lowHpVignette.js";

describe("isLowHp", () => {
  it("is false at/above the threshold", () => {
    expect(isLowHp(LOW_HP_RATIO)).toBe(false);
    expect(isLowHp(0.5)).toBe(false);
  });

  it("is true strictly below the threshold and above zero", () => {
    expect(isLowHp(LOW_HP_RATIO - 0.01)).toBe(true);
    expect(isLowHp(0.01)).toBe(true);
  });

  it("is false at exactly zero (dead, not low)", () => {
    expect(isLowHp(0)).toBe(false);
  });
});

describe("heartbeatPeriodMs", () => {
  it("speeds up (shorter period) as hp drops toward zero", () => {
    const nearThreshold = heartbeatPeriodMs(LOW_HP_RATIO - 0.01);
    const nearDeath = heartbeatPeriodMs(0.01);
    expect(nearDeath).toBeLessThan(nearThreshold);
  });
});

describe("lowHpVignetteAlpha", () => {
  it("is zero when hp isn't low", () => {
    expect(lowHpVignetteAlpha(1, 0)).toBe(0);
    expect(lowHpVignetteAlpha(0, 100)).toBe(0);
  });

  it("pulses above its base alpha at a beat peak", () => {
    const base = lowHpVignetteAlpha(0.2, 500); // off-beat
    const peak = lowHpVignetteAlpha(0.2, 0); // phase 0 is always a beat peak
    expect(peak).toBeGreaterThan(base);
  });

  it("stays within a sane 0..1 range", () => {
    for (let t = 0; t < 2000; t += 37) {
      const a = lowHpVignetteAlpha(0.1, t);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
