import { describe, expect, it } from "vitest";
import { levelForXp } from "./xp.js";
import { xpForLevel } from "@dc2d/engine";

describe("levelForXp / xpForLevel", () => {
  it("level 1 costs 0 xp and stays level 1 until the level-2 threshold", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(2) - 1)).toBe(1);
  });

  it("crosses to the next level exactly at its cumulative threshold", () => {
    for (const level of [2, 3, 4, 7, 20]) {
      expect(levelForXp(xpForLevel(level))).toBe(level);
      expect(levelForXp(xpForLevel(level) - 1)).toBe(level - 1);
    }
  });

  it("has no cap — scales correctly far past early levels", () => {
    expect(levelForXp(xpForLevel(500))).toBe(500);
  });
});
