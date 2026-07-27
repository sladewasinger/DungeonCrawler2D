// Headless tests for the floating damage-number rise/fade curve.
import { describe, expect, it } from "vitest";
import { DAMAGE_NUMBER_LIFETIME_MS, damageNumberPose, isExpired } from "./damageNumberMotion.js";

describe("isExpired", () => {
  it("flips exactly at the lifetime boundary", () => {
    expect(isExpired(DAMAGE_NUMBER_LIFETIME_MS - 1)).toBe(false);
    expect(isExpired(DAMAGE_NUMBER_LIFETIME_MS)).toBe(true);
  });
});

describe("damageNumberPose", () => {
  it("starts at no offset, full alpha", () => {
    const pose = damageNumberPose(0);
    expect(pose.offsetY).toBeCloseTo(0, 10);
    expect(pose.alpha).toBe(1);
  });

  it("rises (more negative offset) and fades toward the end of its lifetime", () => {
    const early = damageNumberPose(50);
    const late = damageNumberPose(DAMAGE_NUMBER_LIFETIME_MS - 10);
    expect(late.offsetY).toBeLessThan(early.offsetY);
    expect(late.alpha).toBeLessThan(early.alpha);
  });

  it("clamps outside the lifetime instead of overshooting", () => {
    const pose = damageNumberPose(DAMAGE_NUMBER_LIFETIME_MS + 500);
    expect(pose.alpha).toBe(0);
  });
});
