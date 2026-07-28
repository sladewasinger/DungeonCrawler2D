import { CHUNK_SIZE, generateChunk, hashString, TERRAIN, type WorldView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrainOcclusionAhead } from "../../entities/geometry/occlusion.js";
import { chunkTileRows, DEV_WORLD_TILE_ROWS } from "./devWorldChunkFixture.js";
import { planTerrain, TERRAIN_KINDS, type TerrainKind } from "./terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;

describe("dev-world terrain planning", () => {
  it("distinguishes VOID caps from neighboring pit faces", () => {
    const chunk = generateChunk({ worldSeed: hashString("dev-world-1"), floor: 1, cx: 1, cy: -1 });
    const cell = (x: number, y: number): { terrain: TerrainKind; height: number } => {
      const index = (y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE + x - chunk.cx * CHUNK_SIZE;
      return { terrain: chunk.terrain[index] === TERRAIN.Void ? VOID : FLOOR, height: chunk.height[index] ?? 0 };
    };
    const floor = { x: 43, y: -14 };
    const lowerFloor = { x: 43, y: -13 };
    const voidTile = { x: 52, y: -5 };
    const source = {
      terrainAt: (x: number, y: number) => cell(x, y).terrain,
      heightAt: (x: number, y: number) => cell(x, y).height,
    };
    const floorPlan = planTerrain(source, {
      bounds: { x: floor.x, y: floor.y, width: 1, height: 1 }, orientation: 0,
    });
    const requestedVoidPlan = planTerrain(source, {
      bounds: { x: 51, y: -13, width: 1, height: 1 }, orientation: 0,
    });
    const boundaryPlan = planTerrain(source, {
      bounds: { x: 50, y: -13, width: 1, height: 1 }, orientation: 0,
    });
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
    expect(floorPlan.batches.southFaces).toHaveLength(1);
    expect(floorPlan.batches.southFaces[0]).toMatchObject({ topHeight: 0, bottomHeight: -1 });
    expect(boundaryPlan.batches.southFaces).toHaveLength(1);
    expect(boundaryPlan.batches.southFaces[0]).toMatchObject({ topHeight: 0, bottomHeight: -1 });
    expect(requestedVoidPlan.batches.voids).toHaveLength(2);
    expect(terrainOcclusionAhead({
      world, x: floor.x + 0.5, y: floor.y + 0.5, z: -1, orientation: 0,
    })).toBeNull();
  });
});
