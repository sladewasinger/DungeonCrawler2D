// Headless tests for the hit-flash edge-trigger and intensity curve.
import { describe, expect, it } from "vitest";
import { flashIntensity, HIT_FLASH_DURATION_MS, tookDamage } from "./hitFlash.js";

describe("tookDamage", () => {
  it("is false with no previous sample (first snapshot)", () => {
    expect(tookDamage(undefined, 10)).toBe(false);
  });

  it("is true only when hp strictly dropped", () => {
    expect(tookDamage(10, 8)).toBe(true);
    expect(tookDamage(10, 10)).toBe(false);
    expect(tookDamage(10, 12)).toBe(false);
  });
});

describe("flashIntensity", () => {
  it("is full strength right at the trigger and fades to 0 by the duration", () => {
    expect(flashIntensity(0)).toBe(1);
    expect(flashIntensity(HIT_FLASH_DURATION_MS)).toBe(0);
    expect(flashIntensity(HIT_FLASH_DURATION_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it("is 0 outside the active window", () => {
    expect(flashIntensity(-5)).toBe(0);
    expect(flashIntensity(HIT_FLASH_DURATION_MS + 50)).toBe(0);
  });
});
