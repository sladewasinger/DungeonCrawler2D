import { describe, expect, it } from "vitest";
import { ROTATION_TWEEN_MS, startRotationTween } from "../../render/view/rotationTween.js";
import { compassBearingDeg } from "./compassBearing.js";

describe("compassBearingDeg", () => {
  it("points straight up (0deg) at the settled identity orientation", () => {
    expect(compassBearingDeg(0, null)).toBe(0);
  });

  it("points screen-left (270deg) at orientation 90 (east-up) — world-north renders screen-west there", () => {
    expect(compassBearingDeg(90, null)).toBe(270);
  });

  it("points down (180deg) at orientation 180", () => {
    expect(compassBearingDeg(180, null)).toBe(180);
  });

  it("points screen-right (90deg) at orientation 270", () => {
    expect(compassBearingDeg(270, null)).toBe(90);
  });

  it("animates continuously through a tween instead of snapping at the settled endpoints", () => {
    // Expressed in duration fractions, not wall-clock literals, so the sweep stays
    // pinned when ROTATION_TWEEN_MS is retuned (250 -> 120, user speed directive).
    const tween = startRotationTween(0, 1); // clockwise, 0 -> 90
    const start = compassBearingDeg(0, { ...tween, elapsedMs: 0 });
    const mid = compassBearingDeg(0, { ...tween, elapsedMs: ROTATION_TWEEN_MS / 2 });
    const end = compassBearingDeg(0, { ...tween, elapsedMs: ROTATION_TWEEN_MS });
    expect(start).toBe(0);
    expect(mid).toBeCloseTo(315); // wrapDegrees(-45)
    expect(end).toBe(270);
  });
});
