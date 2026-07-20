// Headless tests for the xp-bar progress ratio math.
import { describe, expect, it } from "vitest";
import { xpProgressRatio } from "./xpBarView.js";

describe("xpProgressRatio", () => {
  it("is 0 right at a level's start", () => {
    // xpForLevel(2) = 100 — a level-2 character with exactly 100 xp just leveled up.
    expect(xpProgressRatio({ xp: 100, level: 2, xpForNext: 200 })).toBeCloseTo(0, 10);
  });

  it("is 1 right at a level's end", () => {
    // xpForLevel(3) = 300 — level 2 ends there, so xpForNext is 0 at the boundary.
    expect(xpProgressRatio({ xp: 300, level: 2, xpForNext: 0 })).toBeCloseTo(1, 10);
  });

  it("is 0.5 halfway through a level", () => {
    // Level 2 spans xp 100..300 (span 200); 200 is the midpoint, 100 still needed.
    expect(xpProgressRatio({ xp: 200, level: 2, xpForNext: 100 })).toBeCloseTo(0.5, 10);
  });

  it("clamps into 0..1 even given inconsistent inputs", () => {
    expect(xpProgressRatio({ xp: 0, level: 1, xpForNext: 100 })).toBeGreaterThanOrEqual(0);
    expect(xpProgressRatio({ xp: 99999, level: 1, xpForNext: 0 })).toBeLessThanOrEqual(1);
  });
});
