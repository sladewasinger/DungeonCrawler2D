// Headless tests for the corpse/bone decal fade curve.
import { describe, expect, it } from "vitest";
import { CORPSE_DECAL_LIFETIME_MS, corpseDecalAlpha, isCorpseDecalExpired } from "./corpseDecalMotion.js";

describe("isCorpseDecalExpired", () => {
  it("flips exactly at the lifetime boundary", () => {
    expect(isCorpseDecalExpired(CORPSE_DECAL_LIFETIME_MS - 1)).toBe(false);
    expect(isCorpseDecalExpired(CORPSE_DECAL_LIFETIME_MS)).toBe(true);
  });
});

describe("corpseDecalAlpha", () => {
  it("holds full alpha right after spawn", () => {
    expect(corpseDecalAlpha(0, 0.8)).toBe(0.8);
  });

  it("fades monotonically toward zero over the remaining lifetime", () => {
    const mid = corpseDecalAlpha(CORPSE_DECAL_LIFETIME_MS * 0.6, 0.8);
    const late = corpseDecalAlpha(CORPSE_DECAL_LIFETIME_MS * 0.9, 0.8);
    expect(mid).toBeGreaterThan(late);
    expect(late).toBeGreaterThan(0);
  });

  it("reaches exactly zero at and beyond the lifetime", () => {
    expect(corpseDecalAlpha(CORPSE_DECAL_LIFETIME_MS, 0.8)).toBe(0);
  });
});
