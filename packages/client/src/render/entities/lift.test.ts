// Headless tests for the elevation-lift conversion under FLAT PROJECTION (lift.ts
// module doc): terrain draws every surface at its raw world row, so a grounded entity
// lifts by ZERO at every terrain height, and only height above the local ground
// (jump/fall/flying) lifts the sprite. Hand-derived from SCREEN_TILE_PX = 48 px/unit —
// not by echoing the implementation's own output back.
import { describe, expect, it } from "vitest";
import { airborneHeightAboveGround, spriteLiftPx } from "./lift.js";

describe("spriteLiftPx (flat projection)", () => {
  it("a grounded entity on a z1 platform gets ZERO lift — it stands on its drawn tile", () => {
    expect(spriteLiftPx(1, 1)).toBe(0);
  });

  it("a grounded entity on a z-1 pit floor gets zero lift too", () => {
    expect(spriteLiftPx(-1, -1)).toBe(0);
  });

  it("stays zero at flat ground level", () => {
    expect(spriteLiftPx(0, 0)).toBe(0);
    expect(spriteLiftPx(0)).toBe(0);
  });

  it("lifts by height ABOVE local ground only: jumping to z2.5 off a z1 platform is 1.5 tiles up", () => {
    expect(spriteLiftPx(2.5, 1)).toBe(1.5 * 48);
  });

  it("falling into a pit (z between rim and floor) lifts by clearance above the pit floor", () => {
    // z -0.4 while the ground below is the pit floor at -1: clearance 0.6 tiles.
    expect(spriteLiftPx(-0.4, -1)).toBeCloseTo(0.6 * 48, 10);
  });

  it("never lifts negative when z dips under the local ground during step-down transitions", () => {
    expect(spriteLiftPx(0.9, 1)).toBe(0);
  });

  it("accepts the legacy 3-arg call shape (torch visual) with identical semantics", () => {
    expect(spriteLiftPx(2, 0.5, true)).toBe(1.5 * 48);
  });
});

describe("airborneHeightAboveGround", () => {
  it("is zero while grounded, no matter what z says", () => {
    expect(airborneHeightAboveGround(5, 0, false)).toBe(0);
  });

  it("is the height above local ground while airborne", () => {
    expect(airborneHeightAboveGround(3, 1, true)).toBe(2);
  });

  it("never goes negative when z sits at or below the local ground", () => {
    expect(airborneHeightAboveGround(1, 1, true)).toBe(0);
    expect(airborneHeightAboveGround(0, 1, true)).toBe(0);
  });
});
