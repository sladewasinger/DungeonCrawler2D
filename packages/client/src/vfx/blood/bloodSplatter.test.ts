import { describe, expect, it } from "vitest";
import { bloodDropQuantity } from "./bloodSplatter.js";

describe("blood drop intensity", () => {
  it("scales particle counts across the full settings range", () => {
    expect(bloodDropQuantity(28, 1)).toBe(28);
    expect(bloodDropQuantity(28, 0.5)).toBe(14);
    expect(bloodDropQuantity(28, 0)).toBe(0);
  });

  it("clamps values loaded outside the supported range", () => {
    expect(bloodDropQuantity(12, 2)).toBe(12);
    expect(bloodDropQuantity(12, -1)).toBe(0);
  });
});
