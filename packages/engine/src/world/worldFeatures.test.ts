import { describe, expect, it } from "vitest";
import { CHASM_DEATH_Z } from "../core/constants.js";
import { hashString } from "../core/rng.js";
import {
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  personalRoomChunk,
} from "./features/rooms/rooms.js";
import { ROOM_WALL_RISE } from "./features/rooms/roomExitGeometry.js";
import { generateChunk } from "./generate.js";
import { assertChunkWorldFeatures } from "./generate/worldFeatureInvariant.js";
import { CHUNK_SIZE, TERRAIN, TILE, ZONE, type Chunk } from "./core/types.js";
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

  it("keeps every reserved-room chunk cell finite when disabled", () => {
    const { cx, cy } = personalRoomChunk(0);
    const enabled = generateChunk({
      worldSeed: hashString(DEV_WORLD), floor: 1, cx, cy,
    });
    const disabled = generateChunk({
      worldSeed: hashString(DEV_WORLD), floor: 1, cx, cy, features: DISABLED,
    });
    expectNoVoid(disabled);
    assertRoomModeTransform(enabled, disabled);
  });

  it("restores deep chasms as finite lethal Floor instead of infinite VOID", () => {
    const worldSeed = hashString("chasm-test-world");
    const coordinate = { cx: -18, cy: -25 };
    const enabled = generateChunk({ worldSeed, floor: 1, ...coordinate });
    const disabled = generateChunk({ worldSeed, floor: 1, ...coordinate, features: DISABLED });
    const index = disabled.height.findIndex((height) => height <= CHASM_DEATH_Z);

    expect(index).toBe(20);
    expect(enabled.terrain[index]).toBe(TERRAIN.Void);
    expect(disabled.tiles[index]).toBe(TILE.Floor);
    expect(disabled.terrain[index]).toBe(TERRAIN.Floor);
    expect(disabled.height[index]).toBe(-2);
    const x = coordinate.cx * CHUNK_SIZE + (index % CHUNK_SIZE);
    const y = coordinate.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
    const world = new World(worldSeed, 1, { level: LEVEL.Dungeon, features: DISABLED });
    expect(world.isWalkable(x, y)).toBe(true);
  });

  it("keeps finite structural wall geometry permanently impassable", () => {
    const world = new World(hashString(DEV_WORLD), 1, {
      level: LEVEL.Dungeon,
      features: DISABLED,
    });
    const chunk = world.getChunk(1, -1);
    const index = chunk.tiles.findIndex((tile) => tile === TILE.Bedrock);

    expect(index).toBeGreaterThanOrEqual(0);
    const x = chunk.cx * CHUNK_SIZE + index % CHUNK_SIZE;
    const y = chunk.cy * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
    expect(world.surfaceTileAt(x, y)).toBe(TILE.Bedrock);
    expect(world.tileAt(x, y)).toBe(TILE.Bedrock);
    expect(world.heightAt(x, y)).toBeGreaterThan(0);
    expect(world.isWalkable(x, y)).toBe(false);
  });

  it("snapshots startup features before caching chunks", () => {
    const configured = { voidTerrain: false };
    const world = new World(hashString(DEV_WORLD), 1, { features: configured });
    configured.voidTerrain = true;

    expect(world.features).toEqual(DISABLED);
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

function assertRoomModeTransform(enabled: Chunk, disabled: Chunk): void {
  for (let index = 0; index < enabled.tiles.length; index++) {
    if (enabled.terrain[index] === TERRAIN.Floor) {
      expectChunkCell(disabled, index, enabled);
      continue;
    }
    expect(disabled.tiles[index], `tile ${index}`).toBe(TILE.Floor);
    expect(disabled.terrain[index], `terrain ${index}`).toBe(TERRAIN.Floor);
    expect(disabled.features[index], `feature ${index}`).toBe(enabled.features[index]);
    expect(disabled.featureFaces[index], `feature face ${index}`)
      .toBe(enabled.featureFaces[index]);
    expect(disabled.featureHeight[index], `feature height ${index}`)
      .toBe(enabled.featureHeight[index]);
    expect(disabled.height[index], `height ${index}`).toBe(ROOM_WALL_RISE);
    expect(disabled.zones[index], `zone ${index}`).toBe(legacyPersonalRoomZone(index));
  }
}

function expectChunkCell(actual: Chunk, index: number, expected: Chunk): void {
  expect(actual.tiles[index], `tile ${index}`).toBe(expected.tiles[index]);
  expect(actual.terrain[index], `terrain ${index}`).toBe(expected.terrain[index]);
  expect(actual.features[index], `feature ${index}`).toBe(expected.features[index]);
  expect(actual.featureFaces[index], `feature face ${index}`).toBe(expected.featureFaces[index]);
  expect(actual.featureHeight[index], `feature height ${index}`).toBe(expected.featureHeight[index]);
  expect(actual.height[index], `height ${index}`).toBe(expected.height[index]);
  expect(actual.zones[index], `zone ${index}`).toBe(expected.zones[index]);
}

function legacyPersonalRoomZone(index: number): number {
  const lx = index % CHUNK_SIZE;
  const ly = Math.floor(index / CHUNK_SIZE);
  const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
  const inside = lx >= left && lx < left + PERSONAL_ROOM_W &&
    ly >= top && ly < top + PERSONAL_ROOM_H;
  return inside ? ZONE.Sanctuary : ZONE.None;
}
