// The safe-room kiosk's door must stay walkable from its own pad now that the
// kiosk is a z2 FLOOR terrace (VISUAL_DIRECTION.md's wall vertical-extent
// rule), not TILE.Wall rock: STEP_UP gates grounded movement onto any raised
// cell (movement/collision.ts's cornerBlocksMove) with no door exemption, so
// the door itself must sit at a walkable height relative to its threshold —
// carveSafeRoomEntrance's fix (fixed.ts). And the pad it fronts must still
// reach the wider corridor network, exactly as before the kiosk's tile type
// changed from Wall to Floor (feature-link.ts's connector).
import { describe, expect, it } from "vitest";
import { isSafeRoomChunk } from "../features/fixed.js";
import { CHUNK_SIZE, SOLID_TILES, TILE } from "../types.js";
import { generateChunk } from "./index.js";
import { bfsChunks, keyInChunk, type ChunkCache, type WorldPoint } from "./test-support.js";

const FLOOR = 1;

function findSafeRoomDoor(seed: number, cx: number, cy: number): WorldPoint | null {
  const chunk = generateChunk(seed, FLOOR, cx, cy);
  for (let i = 0; i < chunk.tiles.length; i++) {
    if (chunk.tiles[i] !== TILE.DoorSafeRoom) continue;
    const lx = i % CHUNK_SIZE;
    const ly = (i - lx) / CHUNK_SIZE;
    return { x: cx * CHUNK_SIZE + lx, y: cy * CHUNK_SIZE + ly };
  }
  return null;
}

function findFirstSafeRoomChunk(seed: number, range: number): { cx: number; cy: number } | null {
  for (let cx = -range; cx <= range; cx++) {
    for (let cy = -range; cy <= range; cy++) {
      if (isSafeRoomChunk(seed, FLOOR, cx, cy)) return { cx, cy };
    }
  }
  return null;
}

describe("safe-room kiosk stays reachable", () => {
  it("the door sits within STEP_UP of the pad tile just south of it — a real grounded step, not a stranded ledge", () => {
    let checked = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const worldSeed = seed * 7919 + 13;
      const found = findFirstSafeRoomChunk(worldSeed, 5);
      if (!found) continue;
      const door = findSafeRoomDoor(worldSeed, found.cx, found.cy);
      if (!door) continue;
      const south: WorldPoint = { x: door.x, y: door.y + 1 };
      const chunk = generateChunk(worldSeed, FLOOR, found.cx, found.cy);
      const doorIndex = (door.y - found.cy * CHUNK_SIZE) * CHUNK_SIZE + (door.x - found.cx * CHUNK_SIZE);
      const southIndex = (south.y - found.cy * CHUNK_SIZE) * CHUNK_SIZE + (south.x - found.cx * CHUNK_SIZE);
      expect(SOLID_TILES.has(chunk.tiles[doorIndex]!)).toBe(true);
      expect(chunk.height[doorIndex]).toBe(2);
      expect(chunk.height[southIndex]).toBe(0);
      checked++;
    }
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
      const reached = bfsChunks(worldSeed, FLOOR, start, 2, cache);
      const touchesNeighbor = Array.from(reached).some(
        (key) => !keyInChunk(key, found.cx, found.cy),
      );
      expect(touchesNeighbor, `seed ${worldSeed}: kiosk pad never leaves its own chunk`).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
});
