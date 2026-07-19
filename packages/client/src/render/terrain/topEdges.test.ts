// A ledge's west/east/north/corner outline and the boundary-dash rule against
// hand-built height grids — mirrors ownFace.test.ts's fixture style. The rule
// under test: a cap/dash draws only where the cell above the line is walkable
// top and the cell below is the TOP row of a face descending FROM that top.
import { TILE, type TileType } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import type { TerrainRead } from "./faces.js";
import { topEdgesAt } from "./topEdges.js";

/** heights keyed "x,y"; missing cells default to 0 and are never TILE.Wall. */
function terrain(heights: Record<string, number>): TerrainRead {
  return {
    heightAt: (x, y) => heights[`${x},${y}`] ?? 0,
    tileAt: (): TileType => TILE.Floor,
  };
}

describe("topEdgesAt", () => {
  it("marks no edges on flat ground", () => {
    const world = terrain({});
    expect(topEdgesAt(world, 0, 0)).toMatchObject({ west: false, east: false, north: false, southDash: false });
  });

  it("marks the west edge when the west neighbor meaningfully drops", () => {
    // South held level two rows deep so the cell itself never becomes a face row.
    const world = terrain({ "5,5": 1, "5,6": 1, "5,7": 1, "5,4": 1, "6,5": 1, "4,5": 0 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ west: true, east: false, north: false });
  });

  it("marks the east edge when the east neighbor meaningfully drops", () => {
    const world = terrain({ "5,5": 1, "5,6": 1, "5,7": 1, "5,4": 1, "4,5": 1, "6,5": 0 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ west: false, east: true, north: false });
  });

  it("marks the north edge when the north neighbor meaningfully drops", () => {
    const world = terrain({ "5,5": 1, "5,6": 1, "5,7": 1, "4,5": 1, "6,5": 1, "5,4": 0 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ west: false, east: false, north: true });
  });

  it("excludes sub-threshold drops (ramps stay clean, matching ownFace's threshold)", () => {
    const world = terrain({ "5,5": 0.5, "4,5": 0, "6,5": 0, "5,4": 0 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ west: false, east: false, north: false });
  });

  it("marks both sides of an isolated one-wide raised column", () => {
    const world = terrain({ "5,5": 1, "5,6": 1, "5,7": 1, "5,4": 1, "4,5": 0, "6,5": 0 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ west: true, east: true });
  });

  it("never fires on a face row itself — ownFace.ts already draws its brick", () => {
    const world = terrain({ "5,5": 1, "5,6": 0, "4,5": 0 });
    expect(topEdgesAt(world, 5, 5)).toEqual({
      west: false,
      east: false,
      north: false,
      southCornerLeft: false,
      southCornerRight: false,
      southDashEndWest: false,
      southDashEndEast: false,
      southDash: false,
    });
  });

  it("draws the plain full-width dash above a continuing face run", () => {
    // The face run below continues both west and east, and this top has no side
    // edges of its own — nothing terminates the dash.
    const world = terrain({
      "4,4": 1,
      "5,4": 1,
      "6,4": 1,
      "4,5": 1,
      "5,5": 1,
      "6,5": 1,
      "4,6": 0,
      "5,6": 0,
      "6,6": 0,
    });
    expect(topEdgesAt(world, 5, 4)).toMatchObject({
      southDash: true,
      southDashEndWest: false,
      southDashEndEast: false,
      southCornerLeft: false,
      southCornerRight: false,
    });
  });

  it("merges a side edge into the turning corner piece where west and south both drop", () => {
    const world = terrain({ "5,4": 1, "5,5": 1, "5,6": 0, "4,4": 0, "6,4": 1, "6,5": 1, "6,6": 0 });
    expect(topEdgesAt(world, 5, 4)).toMatchObject({
      west: false,
      southDash: false,
      southCornerLeft: true,
      southCornerRight: false,
    });
  });

  it("merges a side edge into the turning corner piece where east and south both drop", () => {
    const world = terrain({ "5,4": 1, "5,5": 1, "5,6": 0, "6,4": 0, "4,4": 1, "4,5": 1, "4,6": 0 });
    expect(topEdgesAt(world, 5, 4)).toMatchObject({
      east: false,
      southDash: false,
      southCornerLeft: false,
      southCornerRight: true,
    });
  });

  it("terminates the dash where the face run below ends but the top continues — corner, not T", () => {
    // (4,5) shares the run's height but its own drop lands a row further south,
    // so the brick run ends at (5,5) while the walkable top row runs on west —
    // the dash must stop with a closed west end instead of passing through.
    const world = terrain({
      "4,4": 1,
      "5,4": 1,
      "6,4": 1,
      "4,5": 1,
      "5,5": 1,
      "6,5": 1,
      "4,6": 1,
      "5,6": 0,
      "6,6": 0,
      "4,7": 0,
    });
    expect(topEdgesAt(world, 5, 4)).toMatchObject({
      southDash: false,
      southDashEndWest: true,
      southDashEndEast: false,
      southCornerLeft: false,
      west: false,
    });
  });

  it("draws no dash above a HIGHER surface's face — the cap belongs only to the top the face descends from", () => {
    // A z4 block rising out of z0 ground: the ground north of it is not the
    // surface the face descends from, so it gets no cap-dash (rule 1).
    const world = terrain({ "5,5": 4, "5,6": 4, "5,7": 4, "5,8": 0 });
    expect(topEdgesAt(world, 5, 4)).toMatchObject({
      southDash: false,
      southDashEndWest: false,
      southDashEndEast: false,
      southCornerLeft: false,
      southCornerRight: false,
    });
  });

  it("draws the dash above a pit edge — the 0-ground's south edge owns the pit wall's cap", () => {
    const world = terrain({ "4,6": -1, "5,6": -1, "6,6": -1 });
    expect(topEdgesAt(world, 5, 5)).toMatchObject({ southDash: true });
    // The pit face cell itself draws brick, never top edges.
    expect(topEdgesAt(world, 5, 6)).toMatchObject({ southDash: false, west: false, east: false, north: false });
  });

  it("draws nothing at a pit wall's foot — the pit floor south of the wall stays plain (rule 1)", () => {
    const world = terrain({ "5,6": -1, "5,7": -1 });
    // (5,7) is pit floor below the wall row at (5,6): no dash, no edges.
    expect(topEdgesAt(world, 5, 7)).toMatchObject({
      southDash: false,
      southDashEndWest: false,
      southDashEndEast: false,
      north: false,
    });
  });
});
