import { describe, expect, it } from "vitest";
import { hashString } from "../core/rng.js";
import { personalRoomChunk } from "./features/rooms/rooms.js";
import { generateChunk } from "./generate.js";
import { finiteFloorForRuntime } from "./generate/finiteFloor.js";
import { assertChunkWorldFeatures } from "./generate/worldFeatureInvariant.js";
import {
  CHUNK_SIZE,
  TERRAIN,
  TILE,
  type Chunk,
} from "./core/types.js";
import { LEVEL } from "./core/level.js";
import { World } from "./core/world.js";

const DISABLED = { voidTerrain: false } as const;
const DEV_WORLD = "dev-world-1";

function expectNoVoid(chunk: Chunk): void {
  for (let index = 0; index < chunk.tiles.length; index++) {
    expect(chunk.tiles[index], `tile ${index}`).not.toBe(TILE.Void);
    expect(chunk.terrain[index], `terrain ${index}`).not.toBe(TERRAIN.Void);
  }
}

describe("VOID terrain world feature", () => {
  it.each([
    { seed: DEV_WORLD, cx: 0, cy: 0 },
    { seed: DEV_WORLD, cx: 1, cy: -1 },
    { seed: "chasm-test-world", cx: -21, cy: -23 },
  ])("keeps every ordinary chunk cell finite when disabled at ($cx, $cy)", ({ seed, cx, cy }) => {
    const chunk = generateChunk({
      worldSeed: hashString(seed), floor: 1, cx, cy, features: DISABLED,
    });
    expectNoVoid(chunk);
  });

  it("changes only enabled VOID cells, preserving every finite tile exactly", () => {
    const request = {
      worldSeed: hashString(DEV_WORLD),
      floor: 1,
      cx: 1,
      cy: -1,
    };
    const enabled = generateChunk(request);
    const disabled = generateChunk({ ...request, features: DISABLED });

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
      worldSeed: hashString(DEV_WORLD), floor: 1, cx, cy,
    });
    const disabled = generateChunk({
      worldSeed: hashString(DEV_WORLD), floor: 1, cx, cy, features: DISABLED,
    });
    expect(disabled).toEqual(enabled);
    expect(disabled.terrain).not.toContain(TERRAIN.Void);
    expect(disabled.tiles).toContain(TILE.Bedrock);
  });

  it("restores generated VOID cells as finite terrain when disabled", () => {
    const worldSeed = hashString("chasm-test-world");
    const floor = finiteFloorForRuntime({
      worldSeed,
      floor: 1,
      features: { voidTerrain: true },
    });
    const sourceIndex = floor.terrain.findIndex((terrain) => terrain === TERRAIN.Void);
    expect(sourceIndex).toBeGreaterThanOrEqual(0);
    const worldX = floor.bounds.minX + sourceIndex % floor.bounds.width;
    const worldY = floor.bounds.minY + Math.floor(sourceIndex / floor.bounds.width);
    const coordinate = {
      cx: Math.floor(worldX / CHUNK_SIZE),
      cy: Math.floor(worldY / CHUNK_SIZE),
    };
    const localX = worldX - coordinate.cx * CHUNK_SIZE;
    const localY = worldY - coordinate.cy * CHUNK_SIZE;
    const index = localY * CHUNK_SIZE + localX;
    const enabled = generateChunk({ worldSeed, floor: 1, ...coordinate });
    const disabled = generateChunk({ worldSeed, floor: 1, ...coordinate, features: DISABLED });

    expect(enabled.terrain[index]).toBe(TERRAIN.Void);
    expect(disabled.terrain[index]).toBe(TERRAIN.Floor);
    expect(disabled.tiles[index]).not.toBe(TILE.Void);
    expect(disabled.height[index]).toBeGreaterThanOrEqual(0);
    const world = new World(worldSeed, 1, { level: LEVEL.Dungeon, features: DISABLED });
    expect(world.terrainAt(worldX, worldY)).toBe(TERRAIN.Floor);
  });

  it("snapshots startup features before caching chunks", () => {
    const configured = { voidTerrain: false };
    const world = new World(hashString(DEV_WORLD), 1, { features: configured });
    configured.voidTerrain = true;

    expect(world.features).toEqual(DISABLED);
    expect(Object.isFrozen(world.features)).toBe(true);
  });

  it("advertises authored Combat Sandbox VOID even when ordinary VOID is disabled", () => {
    const world = new World(hashString(DEV_WORLD), 1, {
      level: LEVEL.CombatSandbox,
      features: DISABLED,
    });

    expect(world.features).toEqual({ voidTerrain: true });
    expect(Object.isFrozen(world.features)).toBe(true);
  });

  it("rejects runtime VOID overrides when the feature is disabled", () => {
    const world = new World(hashString(DEV_WORLD), 1, { features: DISABLED });
    expect(() => world.replaceTileOverrides([
      { x: 0, y: 0, tile: TILE.Void },
    ])).toThrow(/VOID override leaked/);
  });

  it("rejects VOID in every tile-bearing generated plane", () => {
    const chunk = generateChunk({
      worldSeed: hashString(DEV_WORLD), floor: 1, cx: 1, cy: -1, features: DISABLED,
    });
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
