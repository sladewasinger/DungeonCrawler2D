import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView } from "../../../view/transform/viewTransform.js";
import { planTerrain, TERRAIN_KINDS } from "../terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;
const key = (x: number, y: number): string => `${x},${y}`;

describe("flat room VOID boundaries", () => {
  it.each(VIEW_ORIENTATIONS)("emits no rim or projected face at orientation %i", (orientation) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const voidTile = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map([[key(floor.x, floor.y), FLOOR], [key(voidTile.x, voidTile.y), VOID]]);
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: () => 0,
      voidBoundaryAt: () => "flat",
    }, { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("preserves ordinary floating VOID boundaries at orientation %i", (orientation) => {
    const floor = { x: 10, y: 10 };
    const view = worldTileToView(floor, orientation);
    const voidTile = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map([[key(floor.x, floor.y), FLOOR], [key(voidTile.x, voidTile.y), VOID]]);
    const plan = planTerrain({
      voidTerrain: true,
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: () => 0,
      voidBoundaryAt: () => "floating",
    }, { bounds: { ...floor, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces[0]?.voidWall).toBe(true);
    expect(plan.batches.cliffEdges[0]?.voidBoundary).toBe(true);
  });
});
