import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld } from "../../view/transform/viewTransform.js";
import { TERRAIN4, planTerrain4 } from "./terrainPlanner.js";

describe("planTerrain4 stair walls", () => {
  it("marks the south face below a stair feature for stair wall art", () => {
    const plan = planTerrain4({
      terrainAt: (x, y) => x === 0 && (y === 0 || y === 1) ? TERRAIN4.Floor : TERRAIN4.Void,
      heightAt: (x, y) => x === 0 && y === 0 ? 2 : 0,
      featureAt: (x, y) => x === 0 && y === 0 ? "stairs" : null,
    }, { bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.southFaces[0]?.stairWall).toBe(true);
  });

  it.each(VIEW_ORIENTATIONS)("keeps the raised neighbor wall on the screen-north edge of stairs at orientation %i", (orientation) => {
    const stairView = { x: 8, y: 8 };
    const northView = { x: stairView.x, y: stairView.y - 1 };
    const stair = viewTileToWorld(stairView, orientation);
    const north = viewTileToWorld(northView, orientation);
    const plan = planTerrain4({
      terrainAt: () => TERRAIN4.Floor,
      heightAt: (x, y) => sameTile(x, y, north) ? 2 : 0.375,
      featureAt: (x, y) => sameTile(x, y, stair) ? "stairs" : null,
    }, { bounds: { ...north, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      worldTile: north,
      topHeight: 2,
      bottomHeight: 0.375,
      stairWall: false,
      southNeighborIsStair: true,
    });
  });

  it.each(VIEW_ORIENTATIONS)("places a segmented wall between descending adjacent stair tiles at orientation %i", (orientation) => {
    const stairView = { x: 8, y: 8 };
    const southView = { x: stairView.x, y: stairView.y + 1 };
    const current = viewTileToWorld(stairView, orientation);
    const south = viewTileToWorld(southView, orientation);
    const plan = planTerrain4({
      terrainAt: () => TERRAIN4.Floor,
      heightAt: (x, y) => sameTile(x, y, current) ? 1 : 0.5,
      featureAt: (x, y) => sameTile(x, y, current) || sameTile(x, y, south) ? "stairs" : null,
    }, { bounds: { ...current, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      topHeight: 1,
      bottomHeight: 0.5,
      stairWall: true,
      southNeighborIsStair: true,
    });
  });
});

function sameTile(x: number, y: number, tile: { readonly x: number; readonly y: number }): boolean {
  return x === tile.x && y === tile.y;
}
