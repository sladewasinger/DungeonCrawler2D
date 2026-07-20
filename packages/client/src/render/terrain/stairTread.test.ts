import { describe, expect, it } from "vitest";
import { stacksVertically, treadRisers } from "./stairTread.js";

describe("stacksVertically", () => {
  it("stacks N/S climbs vertically (horizontal tread lines) and E/W climbs horizontally", () => {
    expect(stacksVertically(0)).toBe(true); // north
    expect(stacksVertically(2)).toBe(true); // south
    expect(stacksVertically(1)).toBe(false); // east
    expect(stacksVertically(3)).toBe(false); // west
  });
});

describe("treadRisers", () => {
  it("returns TREAD_COUNT - 1 evenly spaced interior risers", () => {
    const risers = treadRisers(0, 0.5);
    expect(risers.map((r) => r.axisFrac)).toEqual([1 / 3, 2 / 3]);
  });

  it("north climb: the riser nearer axisFrac 0 (the high/north edge) is brighter", () => {
    const [lo, hi] = treadRisers(0, 0.5);
    expect(lo).toBeDefined();
    expect(hi).toBeDefined();
    // axisFrac 1/3 is closer to the north (high) edge than 2/3 is.
    expect(lo!.brightness).toBeGreaterThan(hi!.brightness);
  });

  it("south climb: the riser nearer axisFrac 1 (the high/south edge) is brighter — mirrors north", () => {
    const [lo, hi] = treadRisers(2, 0.5);
    expect(hi!.brightness).toBeGreaterThan(lo!.brightness);
  });

  it("brightness rises with the run-wide t, clamped to [0, 1]", () => {
    const low = treadRisers(1, 0)[0]!;
    const high = treadRisers(1, 1)[0]!;
    expect(low.brightness).toBeGreaterThanOrEqual(0);
    expect(high.brightness).toBeLessThanOrEqual(1);
    expect(high.brightness).toBeGreaterThan(low.brightness);
  });
});
