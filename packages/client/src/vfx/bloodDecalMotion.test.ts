// Headless tests for the floor blood-decal fade curve.
import { describe, expect, it } from "vitest";
import { DECAL_LIFETIME_MS, decalAlpha, isDecalExpired } from "./bloodDecalMotion.js";

describe("isDecalExpired", () => {
  it("flips exactly at the lifetime boundary", () => {
    expect(isDecalExpired(DECAL_LIFETIME_MS - 1)).toBe(false);
    expect(isDecalExpired(DECAL_LIFETIME_MS)).toBe(true);
  });
});

describe("decalAlpha", () => {
  it("holds full alpha right after spawn", () => {
    expect(decalAlpha(0, 0.6)).toBe(0.6);
    expect(decalAlpha(500, 0.6)).toBe(0.6);
  });

  it("fades monotonically toward zero over the remaining lifetime", () => {
    const mid = decalAlpha(DECAL_LIFETIME_MS * 0.6, 0.6);
    const late = decalAlpha(DECAL_LIFETIME_MS * 0.9, 0.6);
    expect(mid).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("reaches exactly zero at and beyond the lifetime", () => {
    expect(decalAlpha(DECAL_LIFETIME_MS, 0.6)).toBe(0);
    expect(decalAlpha(DECAL_LIFETIME_MS + 5000, 0.6)).toBe(0);
  });
});
