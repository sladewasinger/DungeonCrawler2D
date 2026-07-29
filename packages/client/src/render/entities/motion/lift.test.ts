// Headless tests for the elevation-lift conversion under the ELEVATION-PROJECTION
// contract (docs/ELEVATION-PROJECTION.md sections 3, 5): absolute-z entity lift, plus
// the same `height*TILE` shape re-derived for ground-anchored callers (shadow/halo/
// decals pass a cell's `groundAt` instead of an entity's `z`). Hand-derived from
// SCREEN_TILE_PX = 48 px/unit — not by echoing the implementation's own output back.
import { describe, expect, it } from "vitest";
import { airborneHeightAboveGround, spriteLiftPx } from "./lift.js";

describe("spriteLiftPx (absolute z)", () => {
  it("lifts a grounded entity by its full height above z=0 — standing on a z1 platform reads as one tile up, coinciding with the platform's own shifted cap", () => {
    expect(spriteLiftPx(1)).toBe(48);
  });

  it("stays zero at ground level", () => {
    expect(spriteLiftPx(0)).toBe(0);
  });

  it("scales linearly with z, whether or not the trailing (ignored) args are supplied", () => {
    expect(spriteLiftPx(3)).toBe(3 * 48);
    expect(spriteLiftPx(3, 1, true)).toBe(3 * 48);
    expect(spriteLiftPx(3, 1, false)).toBe(3 * 48);
  });

  it("pushes a below-zero entity (a pit/chasm floor) down on screen instead of clamping to zero — ruling 2, losing height moves you down-screen", () => {
    expect(spriteLiftPx(-1)).toBe(-48);
  });

  it("fractional z (mid-jump, or a stair-ramp center height) lifts proportionally", () => {
    expect(spriteLiftPx(2.5)).toBe(2.5 * 48);
    expect(spriteLiftPx(-0.5)).toBe(-0.5 * 48);
  });

  it("doubles as the GROUND-anchor shift when called with a cell's groundAt height instead of z (section 5): a shadow under an entity on a z-1 pit floor shifts DOWN one tile, same formula", () => {
    expect(spriteLiftPx(-1)).toBe(-1 * 48);
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
