// Hand-built height fixtures for the fake-AO contact-shade mask — expectations
// derived on paper from FACE_MIN_DROP (0.75, WALL_FACE_MIN_DROP) and the
// wall-always-casts rule, never by calling the implementation under test.
// Mirrors cliffMask.test.ts's fixture style (same TerrainRead stub shape).
import { TILE, type TileType } from "@dc2d/engine";
import { afterEach, describe, expect, it } from "vitest";
import {
  aoBandAlphas,
  aoCornerAlpha,
  contactShadeAt,
  DEFAULT_AO_STRENGTH,
  getAOStrength,
  setAOStrength,
} from "./contactShade.js";
import type { TerrainRead } from "./faces.js";

/** heights keyed "x,y"; missing cells default to 0 height / Floor tile. */
function terrain(heights: Record<string, number>, walls: ReadonlySet<string> = new Set()): TerrainRead {
  return {
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    tileAt: (x, y): TileType => (walls.has(`${x},${y}`) ? TILE.Wall : TILE.Floor),
  };
}

const NO_SIDES = { north: false, south: false, east: false, west: false };
const NO_CORNERS = { nw: false, ne: false, sw: false, se: false };

describe("contactShadeAt", () => {
  it("shades nothing on flat open ground", () => {
    expect(contactShadeAt(terrain({}), 5, 5)).toEqual({ sides: NO_SIDES, corners: NO_CORNERS });
  });

  it("casts from a Wall neighbor even at equal painted height (editor flat-wall rule)", () => {
    const world = terrain({}, new Set(["5,4"]));
    expect(contactShadeAt(world, 5, 5).sides).toEqual({ ...NO_SIDES, north: true });
  });

  it("casts from a z1 platform neighbor onto the z0 floor beside it", () => {
    // Drop is 1 - 0 = 1 >= 0.75: the east side shades, nothing else.
    const world = terrain({ "6,5": 1 });
    expect(contactShadeAt(world, 5, 5).sides).toEqual({ ...NO_SIDES, east: true });
  });

  it("shades all four sides of a pit floor ringed by flat ground", () => {
    // Pit cell at -1; every neighbor defaults to 0: drop 1 on each side.
    const world = terrain({ "5,5": -1 });
    expect(contactShadeAt(world, 5, 5).sides).toEqual({ north: true, south: true, east: true, west: true });
  });

  it("ignores sub-threshold steps — a 0.5 rise is a ramp, not a shadow-caster", () => {
    const world = terrain({ "5,4": 0.5 });
    expect(contactShadeAt(world, 5, 5)).toEqual({ sides: NO_SIDES, corners: NO_CORNERS });
  });

  it("marks a diagonal-only caster as a corner patch", () => {
    // NE diagonal at z1, both flanking orthogonals flat: ne corner only.
    const world = terrain({ "6,4": 1 });
    const shade = contactShadeAt(world, 5, 5);
    expect(shade.sides).toEqual(NO_SIDES);
    expect(shade.corners).toEqual({ ...NO_CORNERS, ne: true });
  });

  it("suppresses the corner patch once a flanking side already carries a band", () => {
    // NE diagonal AND north neighbor raised: the north band covers that seam;
    // a separate ne patch would double-darken the overlap.
    const world = terrain({ "6,4": 1, "5,4": 1 });
    const shade = contactShadeAt(world, 5, 5);
    expect(shade.sides.north).toBe(true);
    expect(shade.corners.ne).toBe(false);
  });
});

describe("AO strength knob", () => {
  afterEach(() => setAOStrength(DEFAULT_AO_STRENGTH));

  it("defaults to 0.5 — Austin's dial, docs/ASSUMPTIONS.md row 361", () => {
    expect(DEFAULT_AO_STRENGTH).toBe(0.5);
    expect(getAOStrength()).toBe(0.5);
  });

  it("scales band alphas linearly: [0.30, 0.20, 0.12] halves at the 0.5 default", () => {
    expect(aoBandAlphas(0.5)).toEqual([0.15, 0.1, 0.06]);
    expect(aoBandAlphas(0)).toEqual([0, 0, 0]);
  });

  it("scales the corner patch the same way: 0.22 at full, 0.11 at the default", () => {
    expect(aoCornerAlpha(1)).toBe(0.22);
    expect(aoCornerAlpha(0.5)).toBe(0.11);
  });

  it("clamps the setter to 0..1", () => {
    setAOStrength(1.7);
    expect(getAOStrength()).toBe(1);
    setAOStrength(-2);
    expect(getAOStrength()).toBe(0);
  });
});
