import { describe, expect, it } from "vitest";
import { whiffAlpha, WHIFF_FADE_MS, WHIFF_PEAK_ALPHA } from "./whiffFadeMotion.js";

describe("whiffAlpha", () => {
  it("starts at the faint peak alpha (0.5) at spawn", () => {
    expect(whiffAlpha(0)).toBe(WHIFF_PEAK_ALPHA);
  });

  it("is at half the peak alpha (0.25) halfway through the fade", () => {
    expect(whiffAlpha(WHIFF_FADE_MS / 2)).toBeCloseTo(WHIFF_PEAK_ALPHA / 2);
  });

  it("reaches exactly 0 at WHIFF_FADE_MS", () => {
    expect(whiffAlpha(WHIFF_FADE_MS)).toBe(0);
  });

  it("is 0 outside the [0, WHIFF_FADE_MS) window", () => {
    expect(whiffAlpha(-1)).toBe(0);
    expect(whiffAlpha(WHIFF_FADE_MS + 50)).toBe(0);
  });

  it("never exceeds the connect wedge's full-bright peak (stays a fainter, distinct cue)", () => {
    expect(WHIFF_PEAK_ALPHA).toBeLessThan(1);
  });
});
