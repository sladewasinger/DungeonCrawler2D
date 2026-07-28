import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, generateChunk, hashString, TERRAIN, type WorldView } from "@dc2d/engine";
import { terrainOcclusionAhead } from "../../entities/geometry/occlusion.js";
import { VIEW_ORIENTATIONS } from "../../view/orientation/viewOrientation.js";
import { viewTileToWorld, worldTileToView } from "../../view/transform/viewTransform.js";
import { chunkTileRows, DEV_WORLD_TILE_ROWS } from "./devWorldChunkFixture.js";
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
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: (x, y) => heights.get(key(x, y)) ?? 0,
    }, { bounds: { x: voidTile.x, y: voidTile.y, width: 1, height: 1 }, orientation });

    expect(plan.batches.voids).toHaveLength(1);
    expect(plan.batches.voids[0]?.vertices.every((vertex) => vertex.z === 0)).toBe(true);
    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges).toEqual([]);
    expect(plan.batches.ao).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("leaves a raised Floor-to-VOID boundary face-free at orientation %i", (orientation) => {
    const floorTile = { x: 10, y: 10 };
    const view = worldTileToView(floorTile, orientation);
    const voidTile = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map<string, TerrainKind>([
      [key(floorTile.x, floorTile.y), FLOOR], [key(voidTile.x, voidTile.y), VOID],
    ]);
    const plan = planTerrain({
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: () => 1,
    }, { bounds: { x: floorTile.x, y: floorTile.y, width: 1, height: 1 }, orientation });

    expect(plan.batches.southFaces).toEqual([]);
    expect(plan.batches.cliffEdges).toHaveLength(1);
    expect(plan.batches.cliffEdges[0]).toMatchObject({ voidBoundary: true, sides: ["south"] });
    expect(plan.batches.ao).toEqual([]);
  });

  it.each(VIEW_ORIENTATIONS)("keeps ordinary and stair pit faces beside side VOID at orientation %i", (orientation) => {
    const floorTile = { x: 10, y: 10 };
    const view = worldTileToView(floorTile, orientation);
    const sideVoid = viewTileToWorld({ x: view.x + 1, y: view.y }, orientation);
    const southFloor = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map<string, TerrainKind>([
      [key(floorTile.x, floorTile.y), FLOOR],
      [key(sideVoid.x, sideVoid.y), VOID],
      [key(southFloor.x, southFloor.y), FLOOR],
    ]);
    const source = {
      terrainAt: (x: number, y: number) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: (x: number, y: number) => key(x, y) === key(floorTile.x, floorTile.y) ? 0 : -1,
      featureAt: () => null,
    };
    const stairSource = { ...source, featureAt: (x: number, y: number) => key(x, y) === key(floorTile.x, floorTile.y) ? "stairs" as const : null };

    const ordinary = planTerrain(source, { bounds: { ...floorTile, width: 1, height: 1 }, orientation });
    const stair = planTerrain(stairSource, { bounds: { ...floorTile, width: 1, height: 1 }, orientation });

    expect(ordinary.batches.southFaces).toHaveLength(1);
    expect(ordinary.batches.southFaces[0]).toMatchObject({
      stairWall: false, topHeight: 0, bottomHeight: -1,
    });
    expect(stair.batches.southFaces).toHaveLength(1);
    expect(stair.batches.southFaces[0]).toMatchObject({ stairWall: true, topHeight: 0, bottomHeight: -1 });
  });

  it.each(VIEW_ORIENTATIONS)("fills the VOID projection gap above a lower pit at orientation %i", (orientation) => {
    const voidTile = { x: 10, y: 10 };
    const view = worldTileToView(voidTile, orientation);
    const pit = viewTileToWorld({ x: view.x, y: view.y + 1 }, orientation);
    const terrain = new Map<string, TerrainKind>([
      [key(pit.x, pit.y), FLOOR], [key(voidTile.x, voidTile.y), VOID],
    ]);
    const plan = planTerrain({
      terrainAt: (x, y) => terrain.get(key(x, y)) ?? FLOOR,
      heightAt: (x, y) => key(x, y) === key(pit.x, pit.y) ? -1 : 0,
    }, { bounds: { x: voidTile.x, y: voidTile.y, width: 1, height: 1 }, orientation });

    expect(plan.batches.voids).toHaveLength(2);
    expect(plan.batches.voids.every((quad) => quad.vertices.every((vertex) => vertex.z === 0))).toBe(true);
  });

  it("keeps a screen-facing stair riser entirely below ground level", () => {
    const lower = { x: 10, y: 10 };
    const south = { x: 10, y: 11 };
    const plan = planTerrain({
      terrainAt: (x, y) => key(x, y) === key(lower.x, lower.y) || key(x, y) === key(south.x, south.y) ? FLOOR : VOID,
      heightAt: (x, y) => key(x, y) === key(lower.x, lower.y) ? -0.5 : -1,
      featureAt: (x, y) => key(x, y) === key(lower.x, lower.y) ? "stairs" : null,
    }, { bounds: { x: lower.x, y: lower.y, width: 1, height: 1 }, orientation: 0 });

    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({
      stairWall: true, topHeight: -0.5, bottomHeight: -1,
    });
  });

  it("distinguishes dev-world VOID caps from neighboring pit faces", () => {
    const chunk = generateChunk({ worldSeed: hashString("dev-world-1"), floor: 1, cx: 1, cy: -1 });
    const cell = (x: number, y: number): { terrain: TerrainKind; height: number } => {
      const index = (y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE + x - chunk.cx * CHUNK_SIZE;
      return { terrain: chunk.terrain[index] === TERRAIN.Void ? VOID : FLOOR, height: chunk.height[index] ?? 0 };
    };
    const floor = { x: 43, y: -14 };
    const lowerFloor = { x: 43, y: -13 };
    const voidTile = { x: 52, y: -5 };
    const source = {
      terrainAt: (x, y) => cell(x, y).terrain,
      heightAt: (x, y) => cell(x, y).height,
    };
    const plan = planTerrain(source, { bounds: { x: floor.x, y: floor.y, width: 1, height: 1 }, orientation: 0 });
    const requestedVoidPlan = planTerrain(source, { bounds: { x: 51, y: -13, width: 1, height: 1 }, orientation: 0 });
    const boundaryPlan = planTerrain(source, { bounds: { x: 50, y: -13, width: 1, height: 1 }, orientation: 0 });
    const world: WorldView = {
      isWalkable: () => true,
      terrainAt: source.terrainAt,
      heightAt: source.heightAt,
      groundAt: source.heightAt,
      stairHeightAt: () => null,
    };

    expect(chunkTileRows(chunk)).toEqual(DEV_WORLD_TILE_ROWS);
    expect(cell(floor.x, floor.y)).toMatchObject({ terrain: FLOOR, height: 0 });
    expect(cell(lowerFloor.x, lowerFloor.y)).toMatchObject({ terrain: FLOOR, height: -1 });
    expect(cell(voidTile.x, voidTile.y).terrain).toBe(VOID);
    expect(cell(50, -12)).toMatchObject({ terrain: FLOOR, height: -1 });
    expect(cell(51, -12)).toMatchObject({ terrain: FLOOR, height: -1 });
    expect(cell(51, -13)).toMatchObject({ terrain: VOID, height: 0 });
    expect(plan.batches.southFaces).toHaveLength(1);
    expect(plan.batches.southFaces[0]).toMatchObject({ topHeight: 0, bottomHeight: -1 });
    expect(boundaryPlan.batches.southFaces).toHaveLength(1);
    expect(boundaryPlan.batches.southFaces[0]).toMatchObject({ topHeight: 0, bottomHeight: -1 });
    expect(requestedVoidPlan.batches.voids).toHaveLength(2);
    expect(terrainOcclusionAhead({ world, x: floor.x + 0.5, y: floor.y + 0.5, z: -1, orientation: 0 })).toBeNull();
  });
});
