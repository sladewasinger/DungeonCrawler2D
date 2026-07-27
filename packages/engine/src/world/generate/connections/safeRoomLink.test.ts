// The safe-room kiosk's door must stay walkable from its own pad now that the
// kiosk is a z2 FLOOR terrace (VISUAL_DIRECTION.md's wall vertical-extent
// rule), not an uncarved generator cell: STEP_UP gates grounded movement onto any raised
// cell (movement/collision.ts's cornerBlocksMove) with no door exemption, so
// the door itself must sit at a walkable height relative to its threshold —
// carveSafeRoomEntrance's fix (fixed.ts). And the pad it fronts must still
// reach the wider corridor network, exactly as before the kiosk's tile type
// changed from Wall to Floor (feature-link.ts's connector).
import { describe, expect, it } from "vitest";
import { isSafeRoomChunk } from "../../features/fixed/fixed.js";
import { CHUNK_SIZE, SOLID_TILES, TILE } from "../../core/types.js";
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
    if (chunk.tiles[i] !== TILE.DoorSafeRoom) continue;
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
  it("the door sits within STEP_UP of the pad tile just south of it — a real grounded step, not a stranded ledge", () => {
    const checked = Array.from({ length: 40 }, (_, index) => index + 1)
      .filter((seed) => assertSafeRoomDoor(seed * 7919 + 13)).length;
    expect(checked).toBeGreaterThan(20);
  });

  it("the pad the door fronts still reaches the wider corridor network (feature-link.ts's connector, unaffected by the kiosk's Floor/Wall change)", () => {
    let checked = 0;
    for (let seed = 1; seed <= 15; seed++) {
      const worldSeed = seed * 7919 + 13;
      const found = findFirstSafeRoomChunk(worldSeed, 5);
      if (!found) continue;
      const door = findSafeRoomDoor(worldSeed, found.cx, found.cy);
      if (!door) continue;
      const cache: ChunkCache = new Map();
      const start: WorldPoint = { x: door.x, y: door.y + 1 };
      const touchesNeighbor = reachesNeighborChunk({ seed: worldSeed, floor: FLOOR, cache }, start);
      expect(touchesNeighbor, `seed ${worldSeed}: kiosk pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  }, 15_000);
});

function assertSafeRoomDoor(worldSeed: number): boolean {
  const found = findFirstSafeRoomChunk(worldSeed, 5);
  if (!found) return false;
  const door = findSafeRoomDoor(worldSeed, found.cx, found.cy);
  if (!door) return false;
  const chunk = generateChunk({ worldSeed, floor: FLOOR, ...found });
  const doorIndex = localIndex(door, found);
  const southIndex = localIndex({ x: door.x, y: door.y + 1 }, found);
  const doorTile = chunk.tiles[doorIndex];
  if (doorTile === undefined) throw new Error(`Missing door tile for seed ${worldSeed}`);
  expect(SOLID_TILES.has(doorTile)).toBe(true);
  expect(chunk.height[doorIndex]).toBe(2);
  expect(chunk.height[southIndex]).toBe(0);
  return true;
}

function localIndex(point: WorldPoint, chunk: { cx: number; cy: number }): number {
  return (point.y - chunk.cy * CHUNK_SIZE) * CHUNK_SIZE + (point.x - chunk.cx * CHUNK_SIZE);
}
