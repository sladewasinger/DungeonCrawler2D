import { CHUNK_SIZE, hashString, TERRAIN, TILE, World, ZONE, type Chunk, type WorldView } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { terrainOcclusionAhead } from "../../entities/geometry/occlusion.js";
import {
  chunkTerrainKinds,
  chunkTileKinds,
} from "./fixtures/devWorldChunkFixture.js";
import { planTerrain, TERRAIN_KINDS, type TerrainKind } from "./terrainPlanner.js";

const FLOOR = TERRAIN_KINDS.Floor;
const VOID = TERRAIN_KINDS.Void;
const DEV_WORLD_SEED = hashString("dev-world-1");

describe("dev-world terrain planning", () => {
  it("keeps VOID-mode floor and void material classes distinct", () => {
    const chunk = mixedBoundaryChunk(true, TILE.Void);

    expect(chunkTileKinds(chunk)).toEqual(expect.arrayContaining([TILE.Floor, TILE.Void]));
    expect(chunkTerrainKinds(chunk)).toEqual(expect.arrayContaining([TERRAIN.Floor, TERRAIN.Void]));
  });

  it("keeps finite-mode terrain walkable while retaining bedrock boundaries", () => {
    const chunk = mixedBoundaryChunk(false, TILE.Bedrock);

    expect(chunkTileKinds(chunk)).toEqual(expect.arrayContaining([TILE.Floor, TILE.Bedrock]));
    assertFinitePlanes(chunk);
  });

  it("distinguishes VOID caps from neighboring pit faces", () => {
    const floor = { x: 0, y: 0 };
    const lowerFloor = { x: 0, y: 1 };
    const voidTile = { x: 1, y: 0 };
    const cell = (x: number, y: number): { terrain: TerrainKind; height: number } => ({
      terrain: x === voidTile.x && y === voidTile.y ? VOID : FLOOR,
      height: y === lowerFloor.y ? -1 : 0,
    });
    const source = {
      voidTerrain: true,
      terrainAt: (x: number, y: number) => cell(x, y).terrain,
      heightAt: (x: number, y: number) => cell(x, y).height,
    };
    const floorPlan = planTerrain(source, {
      bounds: { x: floor.x, y: floor.y, width: 1, height: 1 }, orientation: 0,
    });
    const requestedVoidPlan = planTerrain(source, {
      bounds: { ...voidTile, width: 1, height: 1 }, orientation: 0,
    });
    const world: WorldView = {
      isWalkable: () => true,
      terrainAt: (x, y) => source.terrainAt(x, y) === VOID ? TERRAIN.Void : TERRAIN.Floor,
      heightAt: source.heightAt,
      groundAt: source.heightAt,
      stairHeightAt: () => null,
    };

    expect(cell(floor.x, floor.y)).toMatchObject({ terrain: FLOOR, height: 0 });
    expect(cell(lowerFloor.x, lowerFloor.y)).toMatchObject({ terrain: FLOOR, height: -1 });
    expect(cell(voidTile.x, voidTile.y).terrain).toBe(VOID);
    expect(cell(voidTile.x, voidTile.y + 1))
      .toMatchObject({ terrain: FLOOR, height: -1 });
    expect(floorPlan.batches.southFaces).toHaveLength(1);
    expect(floorPlan.batches.southFaces[0]).toMatchObject({ topHeight: 0, bottomHeight: -1 });
    expect(requestedVoidPlan.batches.voids).toHaveLength(2);
    expect(terrainOcclusionAhead({
      world, x: floor.x + 0.5, y: floor.y + 0.5, z: -1, orientation: 0,
    })).toBeNull();
  });
});

function mixedBoundaryChunk(voidTerrain: boolean, boundaryTile: number): Chunk {
  const world = new World(DEV_WORLD_SEED, 1, { features: { voidTerrain } });
  const bounds = world.floorBounds;
  if (!bounds) throw new Error("missing floor bounds");
  for (let cy = bounds.minChunkY; cy <= bounds.maxChunkY; cy++) {
    const found = findMixedChunkInRow({ world, minCx: bounds.minChunkX, maxCx: bounds.maxChunkX, cy, boundaryTile });
    if (found) return found;
  }
  throw new Error(`no chunk containing Floor and tile ${boundaryTile} found`);
}

function findMixedChunkInRow(input: {
  readonly world: World;
  readonly minCx: number;
  readonly maxCx: number;
  readonly cy: number;
  readonly boundaryTile: number;
}): Chunk | null {
  for (let cx = input.minCx; cx <= input.maxCx; cx++) {
    const chunk = input.world.getChunk(cx, input.cy);
    const kinds = chunkTileKinds(chunk);
    if (kinds.includes(TILE.Floor) && kinds.includes(input.boundaryTile)) return chunk;
  }
  return null;
}

function assertFinitePlanes(chunk: Chunk): void {
  for (let index = 0; index < CHUNK_SIZE ** 2; index++) {
    expect(chunk.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
    expect(chunk.zones[index], `zone ${index}`).toBe(ZONE.None);
  }
}
