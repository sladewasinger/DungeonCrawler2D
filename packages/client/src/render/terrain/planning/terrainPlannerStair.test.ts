import { DEFAULT_FLOOR_GENERATION_CONFIG } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import { TERRAIN_KINDS, planTerrain } from "./terrainPlanner.js";

describe("planTerrain stair walls", () => {
  it.each(VIEW_ORIENTATIONS)("subdivides a continuous stair ramp into configured visible treads at orientation %i", (orientation) => {
    const stair = viewTileToWorld({ x: 8, y: 8 }, orientation);
    const high = viewTileToWorld({ x: 8, y: 7 }, orientation);
    const low = viewTileToWorld({ x: 8, y: 9 }, orientation);
    const treadCount = DEFAULT_FLOOR_GENERATION_CONFIG.stairTreadCount;
    const plan = planTerrain({
      voidTerrain: true,
      stairTreadCount: treadCount,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: (x, y) => sameTile(x, y, high) ? 1 : sameTile(x, y, low) ? 0 : 0.5,
      featureAt: (x, y) => sameTile(x, y, stair) ? "stairs" : null,
    }, { bounds: { ...stair, width: 1, height: 1 }, orientation });

    const treadTops = plan.batches.features.filter(({ wallMounted }) => wallMounted !== true);
    const risers = plan.batches.features.filter(({ wallMounted }) => wallMounted === true);
    expect(treadTops).toHaveLength(treadCount);
    expect(risers).toHaveLength(treadCount);
    expect(new Set(treadTops.map(({ height }) => height)).size).toBe(treadCount);
    expect(Math.max(...treadTops.map(({ height }) => height))).toBe(1);
  });

  it("marks the south face below a stair feature for stair wall art", () => {
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: (x, y) => x === 0 && (y === 0 || y === 1) ? TERRAIN_KINDS.Floor : TERRAIN_KINDS.Void,
      heightAt: (x, y) => x === 0 && y === 0 ? 2 : 0,
      featureAt: (x, y) => x === 0 && y === 0 ? "stairs" : null,
    }, { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.southFaces[0]?.stairWall).toBe(true);
  });

  it.each(VIEW_ORIENTATIONS)("keeps the raised wall on the screen-north edge of stairs at orientation %i", (orientation) => {
    const stairView = { x: 8, y: 8 };
    const northView = { x: stairView.x, y: stairView.y - 1 };
    const stair = viewTileToWorld(stairView, orientation);
    const north = viewTileToWorld(northView, orientation);
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: (x, y) => sameTile(x, y, north) ? 2 : 0.375,
      featureAt: (x, y) => sameTile(x, y, stair) ? "stairs" : null,
    }, { bounds: { ...north, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      worldTile: north,
      topHeight: 2,
      bottomHeight: 0.375,
      stairWall: false,
    });
  });

  it.each(VIEW_ORIENTATIONS)("places a segmented wall between descending adjacent stair tiles at orientation %i", (orientation) => {
    const stairView = { x: 8, y: 8 };
    const southView = { x: stairView.x, y: stairView.y + 1 };
    const current = viewTileToWorld(stairView, orientation);
    const south = viewTileToWorld(southView, orientation);
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: (x, y) => sameTile(x, y, current) ? 1 : 0.5,
      featureAt: (x, y) => sameTile(x, y, current) || sameTile(x, y, south) ? "stairs" : null,
    }, { bounds: { ...current, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 1,
      bottomHeight: 0.5,
      stairWall: true,
    });
  });
});

function sameTile(x: number, y: number, tile: { readonly x: number; readonly y: number }): boolean {
  return x === tile.x && y === tile.y;
}
