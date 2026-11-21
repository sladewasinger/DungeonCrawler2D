import { describe, expect, it } from "vitest";
import { personalRoomChunk } from "./features/rooms/rooms.js";
import { generateChunk } from "./generate.js";
import { sliceGeneratedFloorChunk, type GeneratedFloor } from "./generate/finiteFloor.js";
import { assertChunkWorldFeatures } from "./generate/worldFeatureInvariant.js";
import {
  CHUNK_SIZE,
  TERRAIN,
  TILE,
  type Chunk,
} from "./core/types.js";
import { LEVEL } from "./core/level.js";
import { World } from "./core/world.js";
import {
  FINITE_WORLD_FIXTURE_SEED,
  finiteWorldFixture,
  finiteWorldFixtureFloor,
} from "./core/fixtures/finiteWorldFixture.js";

const DISABLED = { voidTerrain: false } as const;

function expectNoVoid(chunk: Chunk): void {
  for (let index = 0; index < chunk.tiles.length; index++) {
    expect(chunk.tiles[index], `tile ${index}`).not.toBe(TILE.Void);
    expect(chunk.terrain[index], `terrain ${index}`).not.toBe(TERRAIN.Void);
  }
}

describe("VOID terrain world feature", () => {
  it("keeps representative ordinary finite chunks free of VOID when disabled", () => {
    const floor = finiteWorldFixtureFloor(false);
    const points = [floor.spawn, floor.downStairways[0]?.position, floor.miniBossArenas[0]?.position];
    for (const point of points) {
      if (!point) throw new Error("finite fixture is missing representative metadata");
      expectNoVoid(chunkContaining(floor, point.x, point.y));
    }
  });

  it("changes only enabled VOID cells, preserving every finite tile exactly", () => {
    const enabledFloor = finiteWorldFixtureFloor();
    const disabledFloor = finiteWorldFixtureFloor(false);
    const point = terrainPoint(enabledFloor, TERRAIN.Void);
    const enabled = chunkContaining(enabledFloor, point.x, point.y);
    const disabled = chunkContaining(disabledFloor, point.x, point.y);

    for (let index = 0; index < enabled.tiles.length; index++) {
      if (enabled.terrain[index] === TERRAIN.Floor) {
        expectChunkCell(disabled, index, enabled);
      } else {
        expect(disabled.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
        expect(disabled.tiles[index], `tile ${index}`).not.toBe(TILE.Void);
        expect(disabled.zones[index], `zone ${index}`).toBe(enabled.zones[index]);
      }
    }
  });

  it("keeps reserved-room isolation independent from ordinary VOID mode", () => {
    const { cx, cy } = personalRoomChunk(0);
    const enabled = generateChunk({
      worldSeed: FINITE_WORLD_FIXTURE_SEED, floor: 1, cx, cy,
    });
    const disabled = generateChunk({
      worldSeed: FINITE_WORLD_FIXTURE_SEED, floor: 1, cx, cy, features: DISABLED,
    });
    expect(disabled).toEqual(enabled);
    expect(disabled.terrain).not.toContain(TERRAIN.Void);
    expect(disabled.tiles).toContain(TILE.Bedrock);
  });

  it("restores generated VOID cells as finite terrain when disabled", () => {
    const enabledFloor = finiteWorldFixtureFloor();
    const disabledFloor = finiteWorldFixtureFloor(false);
    const point = terrainPoint(enabledFloor, TERRAIN.Void);
    const enabled = chunkContaining(enabledFloor, point.x, point.y);
    const disabled = chunkContaining(disabledFloor, point.x, point.y);
    const index = chunkIndex(point.x, point.y);

    expect(enabled.terrain[index]).toBe(TERRAIN.Void);
    expect(disabled.terrain[index]).toBe(TERRAIN.Floor);
    expect(disabled.tiles[index]).not.toBe(TILE.Void);
    expect(disabled.height[index]).toBeGreaterThanOrEqual(0);
    const world = finiteWorldFixture({ features: DISABLED });
    expect(world.terrainAt(point.x, point.y)).toBe(TERRAIN.Floor);
  });

  it("snapshots startup features before caching chunks", () => {
    const configured = { voidTerrain: false };
    const world = finiteWorldFixture({ features: configured });
    configured.voidTerrain = true;

    expect(world.features).toEqual(DISABLED);
    expect(Object.isFrozen(world.features)).toBe(true);
  });

  it("advertises authored Combat Sandbox VOID even when ordinary VOID is disabled", () => {
    const world = new World(FINITE_WORLD_FIXTURE_SEED, 1, {
      level: LEVEL.CombatSandbox,
      features: DISABLED,
    });

    expect(world.features).toEqual({ voidTerrain: true });
    expect(Object.isFrozen(world.features)).toBe(true);
  });

  it("rejects runtime VOID overrides when the feature is disabled", () => {
    const world = finiteWorldFixture({ features: DISABLED });
    expect(() => world.replaceTileOverrides([
      { x: 0, y: 0, tile: TILE.Void },
    ])).toThrow(/VOID override leaked/);
  });

  it("rejects VOID in every tile-bearing generated plane", () => {
    const floor = finiteWorldFixtureFloor(false);
    const chunk = chunkContaining(floor, floor.spawn.x, floor.spawn.y);
    chunk.features[0] = TILE.Void;
    expect(() => assertChunkWorldFeatures(chunk, DISABLED)).toThrow(/VOID cell 0 leaked/);
  });
});

function expectChunkCell(actual: Chunk, index: number, expected: Chunk): void {
  expect(actual.tiles[index], `tile ${index}`).toBe(expected.tiles[index]);
  expect(actual.terrain[index], `terrain ${index}`).toBe(expected.terrain[index]);
  expect(actual.features[index], `feature ${index}`).toBe(expected.features[index]);
  expect(actual.featureFaces[index], `feature face ${index}`).toBe(expected.featureFaces[index]);
  expect(actual.featureHeight[index], `feature height ${index}`).toBe(expected.featureHeight[index]);
  expect(actual.height[index], `height ${index}`).toBe(expected.height[index]);
  expect(actual.zones[index], `zone ${index}`).toBe(expected.zones[index]);
}

function terrainPoint(floor: GeneratedFloor, terrain: number): { readonly x: number; readonly y: number } {
  const index = floor.terrain.findIndex((candidate) => candidate === terrain);
  if (index < 0) throw new Error(`finite fixture is missing terrain ${terrain}`);
  return {
    x: floor.bounds.minX + index % floor.bounds.width,
    y: floor.bounds.minY + Math.floor(index / floor.bounds.width),
  };
}

function chunkContaining(floor: GeneratedFloor, x: number, y: number): Chunk {
  return sliceGeneratedFloorChunk(floor, Math.floor(x / CHUNK_SIZE), Math.floor(y / CHUNK_SIZE));
}

function chunkIndex(x: number, y: number): number {
  const localX = x - Math.floor(x / CHUNK_SIZE) * CHUNK_SIZE;
  const localY = y - Math.floor(y / CHUNK_SIZE) * CHUNK_SIZE;
  return localY * CHUNK_SIZE + localX;
}
