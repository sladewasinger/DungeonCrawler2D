import { describe, expect, it } from "vitest";
import { floorBannerAlpha, floorBannerScale, isFloorBannerExpired } from "./floorBannerMotion.js";

describe("isFloorBannerExpired", () => {
  it("is false through the lifetime and true at/after it", () => {
    expect(isFloorBannerExpired(0)).toBe(false);
    expect(isFloorBannerExpired(2999)).toBe(false);
    expect(isFloorBannerExpired(3000)).toBe(true);
  });
});

describe("floorBannerAlpha", () => {
  it("fades in, holds at 1, then fades out to 0", () => {
    expect(floorBannerAlpha(-1)).toBe(0);
    expect(floorBannerAlpha(0)).toBe(0);
    expect(floorBannerAlpha(90)).toBeCloseTo(0.5, 1);
    expect(floorBannerAlpha(1000)).toBe(1);
    expect(floorBannerAlpha(2999)).toBeGreaterThan(0);
    expect(floorBannerAlpha(3000)).toBe(0);
  });
});

describe("floorBannerScale", () => {
  it("overshoots past 1 during the pop then settles to exactly 1", () => {
    expect(floorBannerScale(-5)).toBe(0);
    expect(floorBannerScale(90)).toBeGreaterThan(1);
    expect(floorBannerScale(180)).toBe(1);
    expect(floorBannerScale(2000)).toBe(1);
  });
});
