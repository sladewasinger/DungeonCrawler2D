// Headless tests for the kill-moment hit-stop window.
import { describe, expect, it } from "vitest";
import { HIT_STOP_DURATION_MS, isHitStopActive } from "./hitStop.js";

describe("isHitStopActive", () => {
  it("is active from the trigger instant", () => {
    expect(isHitStopActive(0)).toBe(true);
  });

  it("flips inactive exactly at the duration boundary", () => {
    expect(isHitStopActive(HIT_STOP_DURATION_MS - 1)).toBe(true);
    expect(isHitStopActive(HIT_STOP_DURATION_MS)).toBe(false);
  });

  it("is inactive before the trigger (negative elapsed)", () => {
    expect(isHitStopActive(-1)).toBe(false);
  });
});
