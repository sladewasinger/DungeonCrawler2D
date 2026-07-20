import { describe, expect, it } from "vitest";
import { floorTintMultiplier } from "./floorTint.js";

describe("floorTintMultiplier", () => {
  it("floor 1 is neutral (no tint)", () => {
    expect(floorTintMultiplier(1)).toEqual({ warm: [1, 1, 1], cool: [1, 1, 1], ambient: 1 });
  });

  it("floor 2 skews cool (blue channel boosted over red)", () => {
    const t = floorTintMultiplier(2);
    expect(t.cool[2]).toBeGreaterThan(t.cool[0]);
  });

  it("floor 3 skews green", () => {
    const t = floorTintMultiplier(3);
    expect(t.warm[1]).toBeGreaterThan(t.warm[0]);
    expect(t.warm[1]).toBeGreaterThan(t.warm[2]);
  });

  it("floor 4 skews red", () => {
    const t = floorTintMultiplier(4);
    expect(t.warm[0]).toBeGreaterThan(t.warm[1]);
    expect(t.warm[0]).toBeGreaterThan(t.warm[2]);
  });

  it("floor 5 is darker (ambient below 1) and warm-biased", () => {
    const t = floorTintMultiplier(5);
    expect(t.ambient).toBeLessThan(1);
    expect(t.warm[0]).toBeGreaterThan(t.cool[0]);
  });

  it("holds at the floor-5 tint past the authored table", () => {
    expect(floorTintMultiplier(9)).toEqual(floorTintMultiplier(5));
  });

  it("clamps below floor 1 to neutral", () => {
    expect(floorTintMultiplier(0)).toEqual(floorTintMultiplier(1));
  });
});
