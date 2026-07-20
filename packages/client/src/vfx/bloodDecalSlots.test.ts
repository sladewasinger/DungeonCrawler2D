// Headless tests for the blood-decal pool's cap/reuse index arithmetic.
import { describe, expect, it } from "vitest";
import { recycleSlotIndex, shouldGrowPool } from "./bloodDecalSlots.js";

describe("shouldGrowPool", () => {
  it("grows while under the cap", () => {
    expect(shouldGrowPool(0, 40)).toBe(true);
    expect(shouldGrowPool(39, 40)).toBe(true);
  });

  it("stops growing once the cap is reached", () => {
    expect(shouldGrowPool(40, 40)).toBe(false);
    expect(shouldGrowPool(41, 40)).toBe(false);
  });
});

describe("recycleSlotIndex", () => {
  it("cycles through every slot in order", () => {
    const cap = 4;
    const indices = [0, 1, 2, 3, 4, 5].map((cursor) => recycleSlotIndex(cursor, cap));
    expect(indices).toEqual([0, 1, 2, 3, 0, 1]);
  });
});
