import { describe, expect, it } from "vitest";
import { periodForPhase, sampleDayNight, wrapDayPhase } from "./dayNight.js";

describe("dayNight", () => {
  it("wraps negative and >1 phases into [0, 1)", () => {
    expect(wrapDayPhase(-0.25)).toBeCloseTo(0.75, 5);
    expect(wrapDayPhase(1.42)).toBeCloseTo(0.42, 5);
  });

  it("shifts lighting smoothly between bright day and glowing firefly night", () => {
    const day = sampleDayNight(0.45);
    const night = sampleDayNight(0.95);
    expect(periodForPhase(0.45)).toBe("Day");
    expect(periodForPhase(0.95)).toBe("Night");
    expect(day.ambientRgb[1]).toBeGreaterThan(0.85);
    expect(night.ambientRgb[2]).toBeGreaterThan(night.ambientRgb[0]);
    expect(night.fireflyStrength).toBeGreaterThan(day.fireflyStrength);
    expect(day.sunbeamStrength).toBeGreaterThan(night.sunbeamStrength);
  });
});
