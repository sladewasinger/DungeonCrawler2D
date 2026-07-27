// Headless tests for the level-up flourish flash/text timing curve.
import { describe, expect, it } from "vitest";
import {
  LEVEL_UP_LIFETIME_MS,
  isLevelUpExpired,
  levelUpFlashAlpha,
  levelUpTextAlpha,
  levelUpTextScale,
} from "./levelUpFlourishMotion.js";

describe("isLevelUpExpired", () => {
  it("flips exactly at the lifetime boundary", () => {
    expect(isLevelUpExpired(LEVEL_UP_LIFETIME_MS - 1)).toBe(false);
    expect(isLevelUpExpired(LEVEL_UP_LIFETIME_MS)).toBe(true);
  });
});

describe("levelUpFlashAlpha", () => {
  it("starts bright and fades to zero quickly", () => {
    expect(levelUpFlashAlpha(0)).toBe(1);
    expect(levelUpFlashAlpha(1000)).toBe(0);
  });
});

describe("levelUpTextScale", () => {
  it("settles to exactly 1 once the pop finishes", () => {
    expect(levelUpTextScale(1000)).toBe(1);
  });

  it("overshoots above 1 partway through the pop", () => {
    expect(levelUpTextScale(40)).toBeGreaterThan(1);
  });
});

describe("levelUpTextAlpha", () => {
  it("fades in from zero, holds at full, fades out to zero", () => {
    expect(levelUpTextAlpha(0)).toBe(0);
    expect(levelUpTextAlpha(500)).toBe(1);
    expect(levelUpTextAlpha(LEVEL_UP_LIFETIME_MS - 1)).toBeLessThan(1);
    expect(levelUpTextAlpha(LEVEL_UP_LIFETIME_MS)).toBe(0);
  });
});
