// Hand-built height fixtures for the shared cliff mask — expectations derived on
// paper from FACE_MIN_DROP (0.75, WALL_FACE_MIN_DROP), never by calling the
// implementation under test. Mirrors ownFace.test.ts's fixture style.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { cliffSidesAt, isCliffDrop } from "./cliffMask.js";
import type { TerrainRead } from "./faces.js";

/** heights keyed "x,y"; missing cells default to 0 height / Floor tile. */
function terrain(heights: Record<string, number>, walls: ReadonlySet<string> = new Set()): TerrainRead {
  return {
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    tileAt: (x, y): TileType => (walls.has(`${x},${y}`) ? TILE.Wall : TILE.Floor),
  };
}

describe("isCliffDrop", () => {
  it("is true at exactly the 0.75 threshold", () => {
    expect(isCliffDrop(1, 0.25)).toBe(true);
  });

  it("is false just under the threshold — a ramp, not a cliff", () => {
    expect(isCliffDrop(1, 0.26)).toBe(false);
  });

  it("is false for equal or rising neighbors", () => {
    expect(isCliffDrop(1, 1)).toBe(false);
    expect(isCliffDrop(1, 2)).toBe(false);
  });
});

describe("cliffSidesAt", () => {
  it("marks no sides on flat ground", () => {
    const world = terrain({});
    expect(cliffSidesAt(world, 5, 5)).toEqual({ north: false, south: false, east: false, west: false });
  });

  it("marks every side of an isolated raised pillar (seed 228182761's tile 15,40 shape)", () => {
    // A single z1 tile with lower open ground on all 4 sides: the user's exact
    // repro — west AND east (and north, and south) all qualify as exposed cliff.
    const world = terrain({ "15,40": 1 });
    expect(cliffSidesAt(world, 15, 40)).toEqual({ north: true, south: true, east: true, west: true });
  });

  it("marks only the sides that actually drop, on a platform's edge", () => {
    // A 2-wide platform: east neighbor is more raised ground (no drop), the
    // other 3 sides front z0.
    const world = terrain({ "5,5": 1, "6,5": 1 });
    expect(cliffSidesAt(world, 5, 5)).toEqual({ north: true, south: true, east: false, west: true });
  });

  it("never counts a WALL neighbor, even when it sits lower — that side keeps its own black border", () => {
    const world = terrain({ "5,5": 1 }, new Set(["4,5"]));
    expect(cliffSidesAt(world, 5, 5).west).toBe(false);
  });

  it("excludes sub-threshold drops (a subtle-slope ramp stays clean)", () => {
    const world = terrain({ "5,5": 0.5 });
    expect(cliffSidesAt(world, 5, 5)).toEqual({ north: false, south: false, east: false, west: false });
  });

  it("marks a z0 pit rim's dropping sides — negative heights count as lower open ground", () => {
    // Flat z0 ground with a z-1 pit south and east of (5,5): drop is 0 - (-1) = 1,
    // over the 0.75 threshold, so those two sides (and only those) are cliff.
    const world = terrain({ "5,6": -1, "6,5": -1 });
    expect(cliffSidesAt(world, 5, 5)).toEqual({ north: false, south: true, east: true, west: false });
  });
});
