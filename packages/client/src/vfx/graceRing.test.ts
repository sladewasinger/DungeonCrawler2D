// Headless tests for the spawn-grace shield ring's fade math.
import { describe, expect, it } from "vitest";
import { graceRingAlpha, SELF_GRACE_DURATION_MS } from "./graceRing.js";

describe("graceRingAlpha", () => {
  it("is zero once the countdown has expired", () => {
    expect(graceRingAlpha(1000, 1000)).toBe(0);
    expect(graceRingAlpha(1000, 5000)).toBe(0);
  });

  it("is full alpha the instant the window starts", () => {
    const until = 1000 + SELF_GRACE_DURATION_MS;
    expect(graceRingAlpha(until, 1000)).toBeCloseTo(1, 10);
  });

  it("eases toward zero at the midpoint (quadratic, not linear)", () => {
    const until = 1000 + SELF_GRACE_DURATION_MS;
    const half = SELF_GRACE_DURATION_MS / 2;
    // fraction remaining = 0.5 -> alpha = 0.5^2 = 0.25, strictly below the linear 0.5.
    expect(graceRingAlpha(until, 1000 + half)).toBeCloseTo(0.25, 10);
  });

  it("reaches exactly zero once the duration fully elapses", () => {
    const until = 1000 + SELF_GRACE_DURATION_MS;
    expect(graceRingAlpha(until, until)).toBe(0);
    expect(graceRingAlpha(until, until + 5000)).toBe(0);
  });

  it("never reports a fraction above 1 even against a stale/negative timestamp", () => {
    const until = 1000 + SELF_GRACE_DURATION_MS;
    expect(graceRingAlpha(until, -1000)).toBeLessThanOrEqual(1);
  });

  it("degrades to zero for a non-positive duration instead of dividing by zero", () => {
    expect(graceRingAlpha(1000, 500, 0)).toBe(0);
  });

  it("respects a custom duration override", () => {
    const shortDuration = 500;
    const until = 1000 + shortDuration;
    expect(graceRingAlpha(until, 1000, shortDuration)).toBeCloseTo(1, 10);
    expect(graceRingAlpha(until, until, shortDuration)).toBe(0);
  });
});
