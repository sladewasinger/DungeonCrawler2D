// The safe-room kiosk's door must stay walkable from its own pad now that the
// kiosk is a z2 FLOOR terrace (VISUAL_DIRECTION.md's wall vertical-extent
// rule), not TILE.Wall rock: STEP_UP gates grounded movement onto any raised
// cell (movement/collision.ts's cornerBlocksMove) with no door exemption, so
// the door itself must sit at a walkable height relative to its threshold —
// carveSafeRoomEntrance's fix (fixed.ts). And the pad it fronts must still
// reach the wider corridor network, exactly as before the kiosk's tile type
// changed from Wall to Floor (feature-link.ts's connector).
import { describe, expect, it } from "vitest";
import { STEP_UP } from "../../core/constants.js";
import { isSafeRoomChunk } from "../features/fixed.js";
import { CHUNK_SIZE, TILE } from "../types.js";
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

function heightAt(seed: number, p: WorldPoint): number {
  const cx = Math.floor(p.x / CHUNK_SIZE);
  const cy = Math.floor(p.y / CHUNK_SIZE);
  const chunk = generateChunk(seed, FLOOR, cx, cy);
  const i = (p.y - cy * CHUNK_SIZE) * CHUNK_SIZE + (p.x - cx * CHUNK_SIZE);
  return chunk.height[i] ?? 0;
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
      const rise = Math.abs(heightAt(worldSeed, door) - heightAt(worldSeed, south));
      expect(rise, `seed ${worldSeed}: door-to-pad rise ${rise} exceeds STEP_UP`).toBeLessThanOrEqual(STEP_UP);
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
