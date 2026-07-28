import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView } from "../../view/transform/viewTransform.js";
import { planTerrain, TERRAIN_KINDS, type TerrainKind } from "./terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;

function key(x: number, y: number): string {
  return `${x},${y}`;
}

describe("VOID terrain planning", () => {
  it.each(VIEW_ORIENTATIONS)("emits only a flat cap at orientation %i", (orientation) => {
    const voidTile = { x: 10, y: 10 };
    const view = worldTileToView(voidTile, orientation);
    const neighbors = [
      viewTileToWorld({ x: view.x, y: view.y - 1 }, orientation),
      viewTileToWorld({ x: view.x + 1, y: view.y }, orientation),
      viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation),
      viewTileToWorld({ x: view.x - 1, y: view.y }, orientation),
    ];
    const terrain = new Map<string, TerrainKind>([
      [key(voidTile.x, voidTile.y), VOID],
      ...neighbors.map((neighbor) => [key(neighbor.x, neighbor.y), FLOOR] as const),
    ]);
    const heights = new Map<string, number>([
      [key(voidTile.x, voidTile.y), 2],
      ...neighbors.map((neighbor) => [key(neighbor.x, neighbor.y), 0] as const),
    ]);
    const plan = planTerrain({
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? VOID,
      heightAt: (x, y) => heights.get(key(x, y)) ?? 0,
    }, { bounds: { x: voidTile.x, y: voidTile.y, width: 1, height: 1 }, orientation });

    expect(plan.batches.voids).toHaveLength(1);
    expect(plan.batches.voids[0]?.vertices.every((vertex) => vertex.z === 0)).toBe(true);
    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges).toEqual([]);
    expect(plan.batches.ao).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("emits a dark boundary wall beside raised floor at orientation %i", (orientation) => {
    const floorTile = { x: 10, y: 10 };
    const view = worldTileToView(floorTile, orientation);
    const voidTile = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map<string, TerrainKind>([
      [key(floorTile.x, floorTile.y), FLOOR], [key(voidTile.x, voidTile.y), VOID],
    ]);
    const plan = planTerrain({
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? VOID,
      heightAt: (x, y) => key(x, y) === key(floorTile.x, floorTile.y) ? 1 : 0,
    }, { bounds: { x: floorTile.x, y: floorTile.y, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({ topHeight: 1, bottomHeight: 0, voidWall: true });
    expect(plan.batches.cliffEdges).toEqual([]);
    expect(plan.batches.ao).toEqual([]);
  });
});
