// Headless tests for the airborne sprite-lift conversion.
import { describe, expect, it } from "vitest";
import { spriteLiftPx } from "./lift.js";

describe("spriteLiftPx", () => {
  it("is zero while grounded, no matter what z says", () => {
    expect(spriteLiftPx(5, 0, false)).toBe(0);
  });

  it("scales the height-above-ground into pixels while airborne", () => {
    expect(spriteLiftPx(3, 1, true)).toBe(2 * 48);
  });

  it("never lifts negative when z sits at or below ground", () => {
    expect(spriteLiftPx(1, 1, true)).toBe(0);
    expect(spriteLiftPx(0, 1, true)).toBe(0);
  });
});
