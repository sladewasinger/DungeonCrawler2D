import { CHUNK_SIZE, generateChunk, hashString, TERRAIN, TILE, ZONE, type Chunk, type WorldView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrainOcclusionAhead } from "../../entities/geometry/occlusion.js";
import {
  chunkHeightRows,
  chunkTileRows,
  DEV_WORLD_TILE_ROWS,
  FINITE_DEV_WORLD_HEIGHT_ROWS,
  FINITE_DEV_WORLD_TILE_ROWS,
} from "./devWorldChunkFixture.js";
import { planTerrain, TERRAIN_KINDS, type TerrainKind } from "./terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;

describe("dev-world terrain planning", () => {
  it("preserves every finite-mode cell in the screenshot regression chunk", () => {
    const chunk = generateChunk({
      worldSeed: hashString("dev-world-1"), floor: 1, cx: 1, cy: -1,
      features: { voidTerrain: false },
    });

    expect(chunkTileRows(chunk)).toEqual(FINITE_DEV_WORLD_TILE_ROWS);
    expect(chunkHeightRows(chunk)).toEqual(FINITE_DEV_WORLD_HEIGHT_ROWS);
    assertFinitePlanes(chunk);
  });

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
      voidTerrain: true,
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
      terrainAt: (x, y) => source.terrainAt(x, y) === VOID ? TERRAIN.Void : TERRAIN.Floor,
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

function assertFinitePlanes(chunk: Chunk): void {
  for (let index = 0; index < CHUNK_SIZE ** 2; index++) {
    const expectedFeature = chunk.tiles[index] === TILE.Stairs ? TILE.Stairs : TILE.Floor;
    expect(chunk.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
    expect(chunk.features[index], `feature ${index}`).toBe(expectedFeature);
    expect(chunk.zones[index], `zone ${index}`).toBe(ZONE.None);
  }
}
