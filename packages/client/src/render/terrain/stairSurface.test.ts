import { TILE, ZONE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  drawsVoidUnderlay,
  northClimbingStairCoversUnderlay,
  renderedSurfaceHeight,
} from "./stairSurface.js";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewTerrainWorld } from "./viewWorld.js";

function northClimbingPitStair(): ViewTerrainWorld {
  const real: TerrainWorld = {
    tileAt: (x, y) => x === 0 && y === 0 ? TILE.Stairs : TILE.Floor,
    heightAt: (_x, y) => y < 0 ? 0 : y === 0 ? -0.5 : -1,
    zoneAt: () => ZONE.None,
    isSanctuary: () => false,
    isWalkable: () => true,
    groundAt: (_x, y) => y <= 0 ? 0 : y >= 1 ? -1 : -y,
  };
  return {
    ...real,
    real,
    orientation: 0,
    toReal: (x, y) => ({ x, y }),
  };
}

describe("stair surface presentation", () => {
  it("anchors a half-height stair to its upper whole-height tile", () => {
    expect(renderedSurfaceHeight(TILE.Stairs, -0.5)).toBe(0);
    expect(renderedSurfaceHeight(TILE.Stairs, 0.5)).toBe(1);
  });

  it("keeps a stair out of the purple void underlay", () => {
    expect(drawsVoidUnderlay(TILE.Stairs, -0.5)).toBe(false);
    expect(drawsVoidUnderlay(TILE.Floor, -1)).toBe(true);
  });

  it("keeps the pit underlay from covering a north-climbing stair's lower bands", () => {
    const world = northClimbingPitStair();
    expect(northClimbingStairCoversUnderlay(world, 0, 1, -1)).toBe(true);
    expect(northClimbingStairCoversUnderlay(world, 1, 1, -1)).toBe(false);
  });
});
