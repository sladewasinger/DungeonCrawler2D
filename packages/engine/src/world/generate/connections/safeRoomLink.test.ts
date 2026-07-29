// The kiosk door is a wall feature over an intact z2 terrace cell. Its front
// approach must still connect to the wider corridor network.
import { describe, expect, it } from "vitest";
import { isSafeRoomChunk } from "../../features/fixed/fixed.js";
import { CHUNK_SIZE, FEATURE_FACE, TILE } from "../../core/types.js";
import { generateChunk } from "../index.js";
import {
  reachesNeighborChunk,
  type ChunkCache,
  type WorldPoint,
} from "../test-support.js";

const FLOOR = 1;

function findSafeRoomDoor(seed: number, cx: number, cy: number): WorldPoint | null {
  const chunk = generateChunk({ worldSeed: seed, floor: FLOOR, cx: cx, cy: cy });
  for (let i = 0; i < chunk.tiles.length; i++) {
    if (chunk.features[i] !== TILE.DoorSafeRoom) continue;
    const lx = i % CHUNK_SIZE;
    const ly = (i - lx) / CHUNK_SIZE;
    return { x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly };
  }
  return null;
}

function findFirstSafeRoomChunk(seed: number, range: number): { cx: number; cy: number } | null {
  return coordinateSquare(range).find(({ cx, cy }) => isSafeRoomChunk({ worldSeed: seed, floor: FLOOR, cx, cy })) ?? null;
}

function coordinateSquare(range: number): Array<{ cx: number; cy: number }> {
  return Array.from({ length: range * 2 + 1 }, (_, x) => x - range)
    .flatMap((cx) => Array.from({ length: range * 2 + 1 }, (_, y) => ({ cx, cy: y - range })));
}

describe("safe-room kiosk stays reachable", () => {
  it("keeps the wall-mounted door independent from its raised collision terrain", () => {
    const checked = Array.from({ length: 24 }, (_, index) => index + 1)
      .filter((seed) => assertSafeRoomDoor(seed * 7919 + 13)).length;
    expect(checked).toBe(24);
  });

  it("the pad the door fronts still reaches the wider corridor network (feature-link.ts's connector, unaffected by the kiosk's Floor/Wall change)", () => {
    let checked = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const worldSeed = seed * 7919 + 13;
      const found = findFirstSafeRoomChunk(worldSeed, 3);
      if (!found) continue;
      const door = findSafeRoomDoor(worldSeed, found.cx, found.cy);
      if (!door) continue;
      const cache: ChunkCache = new Map();
      const start: WorldPoint = { x: door.x, y: door.y + 1 };
      const touchesNeighbor = reachesNeighborChunk({ seed: worldSeed, floor: FLOOR, cache }, start);
      expect(touchesNeighbor, `seed ${worldSeed}: kiosk pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBe(8);
  }, 15_000);
});

function assertSafeRoomDoor(worldSeed: number): boolean {
  const found = findFirstSafeRoomChunk(worldSeed, 3);
  if (!found) return false;
  const door = findSafeRoomDoor(worldSeed, found.cx, found.cy);
  if (!door) return false;
  const chunk = generateChunk({ worldSeed, floor: FLOOR, ...found });
  const doorIndex = localIndex(door, found);
  const southIndex = localIndex({ x: door.x, y: door.y + 1 }, found);
  expect(chunk.tiles[doorIndex]).toBe(TILE.Floor);
  expect(chunk.features[doorIndex]).toBe(TILE.DoorSafeRoom);
  expect(chunk.featureFaces[doorIndex]).toBe(FEATURE_FACE.South);
  expect(chunk.featureHeight[doorIndex]).toBe(1);
  expect(chunk.height[doorIndex]).toBe(2);
  expect(chunk.height[southIndex]).toBe(0);
  return true;
}

function localIndex(point: WorldPoint, chunk: { cx: number; cy: number }): number {
  return (point.y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE + (point.x - chunk.cx * CHUNK_SIZE);
}
