import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, TERRAIN, TILE } from "../../core/types.js";
import { World } from "../../core/world.js";
import {
  ROOM_ISOLATION_BUFFER_CHUNKS,
  SAFE_ROOM_H,
  SAFE_ROOM_W,
  SPAWN_ROOM_H,
  SPAWN_ROOM_W,
} from "./roomModel.js";
import {
  safeRoomChunk,
  spawnRoomChunk,
} from "./rooms.js";

const CASES = [
  {
    kind: "safe",
    position: safeRoomChunk(4, 7),
    width: SAFE_ROOM_W,
    height: SAFE_ROOM_H,
  },
  {
    kind: "spawn",
    position: spawnRoomChunk(),
    width: SPAWN_ROOM_W,
    height: SPAWN_ROOM_H,
  },
] as const;

describe("protected room terrain isolation", () => {
  it.each(CASES)(
    "keeps the $kind exterior as a sealed Bedrock apron when ordinary VOID is disabled",
    (room) => {
      const world = new World(hashString("room-isolation"), 1, {
        features: { voidTerrain: false },
      });
      assertRoomExteriorIsSealed(world, room);
    },
  );

  it("separates the spawn plane from dungeon terrain with a sealed apron", () => {
    const world = new World(hashString("room-isolation-buffer"), 1, {
      features: { voidTerrain: false },
    });
    const spawn = spawnRoomChunk();

    for (let distance = 1;
      distance <= ROOM_ISOLATION_BUFFER_CHUNKS;
      distance += 1) {
      assertSealedCell(world, {
        x: spawn.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
        y: (spawn.cy - distance) * CHUNK_SIZE + CHUNK_SIZE / 2,
      });
    }
  });

  it("keeps the open horizontal room plane rendered and blocked", () => {
    const world = new World(hashString("room-isolation-horizontal-apron"), 1, {
      features: { voidTerrain: false },
    });
    const spawn = spawnRoomChunk();

    for (let distance = 1;
      distance <= ROOM_ISOLATION_BUFFER_CHUNKS;
      distance += 1) {
      assertSealedCell(world, {
        x: (spawn.cx - distance) * CHUNK_SIZE + CHUNK_SIZE / 2,
        y: spawn.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
      });
    }

    // The nearest east chunk is also apron. Two chunks east is the authored
    // personal-room slot, so it must remain rendered room terrain rather than
    // being overwritten merely to make the spawn apron symmetric.
    assertSealedCell(world, {
      x: (spawn.cx + 1) * CHUNK_SIZE + CHUNK_SIZE / 2,
      y: spawn.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
    });
    assertRenderedRoomCell(world, {
      x: (spawn.cx + ROOM_ISOLATION_BUFFER_CHUNKS) * CHUNK_SIZE + CHUNK_SIZE / 2,
      y: spawn.cy * CHUNK_SIZE + CHUNK_SIZE / 2,
    });
  });
});

function assertRoomExteriorIsSealed(
  world: World,
  room: (typeof CASES)[number],
): void {
  const left = Math.floor(CHUNK_SIZE / 2 - room.width / 2);
  const top = Math.floor(CHUNK_SIZE / 2 - room.height / 2);
  const baseX = room.position.cx * CHUNK_SIZE;
  const baseY = room.position.cy * CHUNK_SIZE;
  const samples = [
    { x: baseX, y: baseY },
    { x: baseX + left - 1, y: baseY + top },
    { x: baseX + left, y: baseY + top - 1 },
    { x: baseX + left + room.width, y: baseY + top },
    { x: baseX + left, y: baseY + top + room.height },
  ];
  for (const sample of samples) assertSealedCell(world, sample);
}

function assertSealedCell(
  world: World,
  sample: { readonly x: number; readonly y: number },
): void {
  expect(world.surfaceTileAt(sample.x, sample.y)).toBe(TILE.Bedrock);
  expect(world.terrainAt(sample.x, sample.y)).toBe(TERRAIN.Floor);
  expect(world.isWalkable(sample.x, sample.y)).toBe(false);
}

function assertRenderedRoomCell(
  world: World,
  sample: { readonly x: number; readonly y: number },
): void {
  expect(world.surfaceTileAt(sample.x, sample.y)).toBe(TILE.Floor);
  expect(world.terrainAt(sample.x, sample.y)).toBe(TERRAIN.Floor);
  expect(world.isWalkable(sample.x, sample.y)).toBe(true);
}
