// Headless tests for the melee-wedge telegraph's geometry and fade curve — asserts the
// shape is derived from the engine's real MELEE_RANGE/MELEE_ARC_COS constants, not
// independently-tuned magic numbers that could drift out of sync with what the server
// actually resolves hits against.
import { MELEE_ARC_COS, MELEE_RANGE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WEDGE_FADE_MS, WEDGE_HALF_ANGLE_RAD, WEDGE_RADIUS_TILES, wedgeAlpha, wedgeGeometry } from "./meleeWedgeGeometry.js";

describe("wedge shape constants", () => {
  it("radius is exactly the engine's MELEE_RANGE, not a re-tuned literal", () => {
    expect(WEDGE_RADIUS_TILES).toBe(MELEE_RANGE);
  });

  it("half-angle is exactly acos(MELEE_ARC_COS), not a re-tuned literal", () => {
    expect(WEDGE_HALF_ANGLE_RAD).toBe(Math.acos(MELEE_ARC_COS));
  });
});

describe("wedgeGeometry", () => {
  it("spans centerAngle +/- the derived half-angle, radius scaled by tilePx", () => {
    const tilePx = 48;
    const center = Math.PI / 3;
    const geo = wedgeGeometry(center, tilePx);
    expect(geo.startAngle).toBeCloseTo(center - WEDGE_HALF_ANGLE_RAD);
    expect(geo.endAngle).toBeCloseTo(center + WEDGE_HALF_ANGLE_RAD);
    expect(geo.radiusPx).toBeCloseTo(WEDGE_RADIUS_TILES * tilePx);
  });

  it("the full span between start/end angles is exactly twice the derived half-angle", () => {
    const geo = wedgeGeometry(0, 48);
    expect(geo.endAngle - geo.startAngle).toBeCloseTo(2 * WEDGE_HALF_ANGLE_RAD);
  });
});

describe("wedgeAlpha", () => {
  it("is full-bright at spawn and fades to 0 by WEDGE_FADE_MS", () => {
    expect(wedgeAlpha(0)).toBe(1);
    expect(wedgeAlpha(WEDGE_FADE_MS / 2)).toBeCloseTo(0.5);
    expect(wedgeAlpha(WEDGE_FADE_MS)).toBe(0);
  });

  it("is 0 outside the [0, WEDGE_FADE_MS) window", () => {
    expect(wedgeAlpha(-1)).toBe(0);
    expect(wedgeAlpha(WEDGE_FADE_MS + 50)).toBe(0);
  });
});
