// Hand-derived tests for the wall-bump nudge curve/state (panel round 3b item 4).
// NUDGE_OUT_MS=40, NUDGE_TOTAL_MS=90, NUDGE_PEAK_TILES=0.055 (module-internal, re-derived
// here from the ratios rather than imported, to avoid the test just echoing the constant).
import { describe, expect, it } from "vitest";
import { nudgeMagnitude, WallBumpNudge } from "./wallBumpNudge.js";

const PEAK = 0.055;
const OUT_MS = 40;
const TOTAL_MS = 90;

describe("nudgeMagnitude", () => {
  it("is 0 at the exact moment of trigger... ramping starts from 0", () => {
    expect(nudgeMagnitude(0)).toBe(0);
  });

  it("is at the full peak at the out-phase boundary (40ms)", () => {
    expect(nudgeMagnitude(OUT_MS)).toBeCloseTo(PEAK);
  });

  it("is at half the peak halfway through the push-out phase (20ms)", () => {
    expect(nudgeMagnitude(OUT_MS / 2)).toBeCloseTo(PEAK / 2);
  });

  it("is back to 0 by the total window (90ms) — the instant return", () => {
    expect(nudgeMagnitude(TOTAL_MS)).toBe(0);
  });

  it("is at half the peak halfway through the return phase (65ms = 40 + 25 of 50)", () => {
    // return phase spans 40..90 (50ms); halfway is 40+25=65, expected magnitude = PEAK * 0.5
    expect(nudgeMagnitude(65)).toBeCloseTo(PEAK / 2);
  });

  it("is 0 outside the [0, 90) window", () => {
    expect(nudgeMagnitude(-1)).toBe(0);
    expect(nudgeMagnitude(TOTAL_MS + 5)).toBe(0);
  });
});

describe("WallBumpNudge", () => {
  it("reports zero offset before any trigger", () => {
    const nudge = new WallBumpNudge();
    expect(nudge.offset(0)).toEqual({ x: 0, y: 0 });
  });

  it("normalizes a diagonal direction before scaling by the magnitude curve", () => {
    const nudge = new WallBumpNudge();
    nudge.trigger(1, 1, 100);
    const { x, y } = nudge.offset(100 + OUT_MS); // at peak magnitude
    const invSqrt2 = 1 / Math.sqrt(2);
    expect(x).toBeCloseTo(PEAK * invSqrt2);
    expect(y).toBeCloseTo(PEAK * invSqrt2);
  });

  it("returns to zero offset once the nudge window has fully elapsed", () => {
    const nudge = new WallBumpNudge();
    nudge.trigger(1, 0, 100);
    expect(nudge.offset(100 + TOTAL_MS)).toEqual({ x: 0, y: 0 });
  });

  it("a zero-length direction trigger produces zero offset even mid-window", () => {
    const nudge = new WallBumpNudge();
    nudge.trigger(0, 0, 100);
    expect(nudge.offset(120)).toEqual({ x: 0, y: 0 });
  });
});
