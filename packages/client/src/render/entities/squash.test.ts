// Headless tests for the landing-squash curve.
import { describe, expect, it } from "vitest";
import { SQUASH_DURATION_MS, squashScale } from "./squash.js";

describe("squashScale", () => {
  it("is neutral before and at/after the active window", () => {
    expect(squashScale(-5)).toEqual({ scaleX: 1, scaleY: 1 });
    expect(squashScale(SQUASH_DURATION_MS)).toEqual({ scaleX: 1, scaleY: 1 });
  });

  it("peaks widest/flattest right at elapsed 0", () => {
    const pose = squashScale(0);
    expect(pose.scaleX).toBeGreaterThan(1);
    expect(pose.scaleY).toBeLessThan(1);
  });

  it("eases monotonically back toward neutral", () => {
    const early = squashScale(20);
    const late = squashScale(SQUASH_DURATION_MS - 20);
    expect(late.scaleX).toBeLessThan(early.scaleX);
    expect(late.scaleY).toBeGreaterThan(early.scaleY);
  });
});
