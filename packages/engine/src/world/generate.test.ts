// Public-facade invariants for the default chunk generator (world/generate.ts):
// determinism, flat-first-plus-deliberate-height, fixed-feature placement,
// pocket sealing, and the instanced safe room. Generator-internal invariants
// (BSP layout, districts, avenues, landmarks, chasms) live under generate/.

import { describe, expect, it } from "vitest";
import { hashString } from "../core/rng.js";
import { isSafeRoomChunk, isStairsChunk, KIOSK_HEIGHT } from "./features/fixed/fixed.js";
import {
  accumulateHeightBudget,
  createHeightBudgetStats,
} from "./generate/terrain/heightBudget.test-support.js";
import { generateChunk } from "./generate.js";
import { floodFromBorder } from "./generate/test-support.js";
import {
  PERSONAL_ROOM_H,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomChunk,
  safeRoomFeatures,
  safeRoomSpawn,
} from "./features/rooms/rooms.js";
import { CHUNK_SIZE, TERRAIN, TILE, ZONE } from "./core/types.js";
import { World } from "./core/world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

describe("world generation", () => {
  it("is byte-identical for identical inputs (networking invariant)", () => {
    for (const [cx, cy] of [
      [0, 0],
      [-3, 7],
      [12, -12],
    ] as const) {
      const a = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
      const b = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
      expect(Array.from(a.features)).toEqual(Array.from(b.features));
      expect(Array.from(a.height)).toEqual(Array.from(b.height));
      expect(Array.from(a.zones)).toEqual(Array.from(b.zones));
    }
  });

  it("differs across seeds and floors", () => {
    const a = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: 5, cy: 5 });
    const b = generateChunk({ worldSeed: hashString("other-world"), floor: FLOOR, cx: 5, cy: 5 });
    const c = generateChunk({ worldSeed: SEED, floor: FLOOR + 1, cx: 5, cy: 5 });
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
    expect(Array.from(a.tiles)).not.toContain(1);
    expect(Array.from(a.terrain).every((value) => value === TERRAIN.Floor || value === TERRAIN.Void)).toBe(true);
  });

  it("is flat-first: floor height is 0 or within the pit/dais/chasm/landmark tier budget", () => {
    const stats = createHeightBudgetStats();
    for (const [cx, cy] of chunkGrid(-5, 5)) {
      const worldChunk = { worldSeed: SEED, floor: FLOOR, cx, cy };
      if (isSafeRoomChunk(worldChunk) || isStairsChunk(worldChunk)) continue;
      accumulateHeightBudget(stats, generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy }), true);
    }
    expect(stats.violations, stats.firstViolation).toBe(0);
    expect(stats.plainFloors).toBeGreaterThan(500);
    expect(stats.deliberateFloors).toBeGreaterThan(0);
  }, 15_000);

  it("safe-room chunks contain an entrance portal on a z2 kiosk TERRACE, not an open sanctuary", () => {
    const found = findFirst(isSafeRoomChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    let doors = 0;
    let doorIndex = -1;
    for (let i = 0; i < chunk.tiles.length; i++) {
      expect(chunk.zones[i]).toBe(ZONE.None);
      if (chunk.tiles[i] === TILE.DoorSafeRoom) {
        doors++;
        doorIndex = i;
      }
    }
    expect(doors).toBe(1);
    // The kiosk terrace's walkable top platform sits north of the door
    // (KIOSK_HEIGHT, not a flat floor — VISUAL_DIRECTION.md's z+1 rule);
    // ordinary pad ground continues south of it.
    expect(chunk.tiles[doorIndex - CHUNK_SIZE]).toBe(TILE.Floor);
    expect(chunk.height[doorIndex - CHUNK_SIZE]).toBe(KIOSK_HEIGHT);
    expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
  });

  it("stairway chunks contain a cleared landing pad", () => {
    // The pad is a flat clearing (baseSample is height 0 everywhere —
    // flat-first), never TILE.Stairs: a Stairs tile with no real height
    // delta across its climb axis is the "flavor without height" bug
    // (docs/PORT_PLAN.md's worldgen redesign brief) — see fixed.ts.
    const found = findFirst(isStairsChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    const clearFloor = Array.from(chunk.tiles).filter((t) => t === TILE.Floor).length;
    expect(clearFloor).toBeGreaterThan(60);
  });

  it("the instanced safe room has dynamic portal sites and sanctuary", () => {
    const world = new World(SEED, FLOOR);
    const doorCx = 3;
    const doorCy = -2;
    const f = safeRoomFeatures(doorCx, doorCy);
    expect(f.doors).toHaveLength(20);
    expect(f.doors.every((door) => world.tileAt(door.x, door.y) === TILE.Floor)).toBe(true);
    expect(world.tileAt(f.exit.x, f.exit.y)).toBe(TILE.DoorExit);

    const spawn = safeRoomSpawn(doorCx, doorCy);
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);

    // Distinct doors get distinct rooms; the same door is stable.
    const roomA = safeRoomChunk(doorCx, doorCy);
    const roomB = safeRoomChunk(doorCx + 1, doorCy);
    expect(roomA).not.toEqual(roomB);
    expect(safeRoomChunk(doorCx, doorCy)).toEqual(roomA);
  });

  it("embeds the personal sanctuary exit in a south alcove and spawns the player just inside", () => {
    const world = new World(SEED, FLOOR);
    const chunk = personalRoomChunk(0);
    const baseY = chunk.cy * CHUNK_SIZE;
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    const features = personalRoomFeatures(0);
    const spawn = personalRoomSpawn(0);

    expect(features.exit.y).toBe(baseY + top + PERSONAL_ROOM_H - 2);
    expect(world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);
    expect(world.tileAt(features.exit.x - 1, features.exit.y)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x + 1, features.exit.y)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x, features.exit.y + 1)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x, features.exit.y + 2)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x - 1, features.exit.y + 1)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x + 1, features.exit.y + 1)).toBe(TILE.Floor);
    expect(Math.floor(spawn.x)).toBe(features.exit.x);
    expect(Math.floor(spawn.y)).toBe(features.exit.y - 1);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });

  it("has no unreachable interior floor pockets (pocket sealing)", () => {
    for (const [cx, cy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, 1], [1, -1]] as const) {
      const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
      assertNoPockets(chunk.tiles, cx, cy);
    }
  });
});

function chunkGrid(min: number, max: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cx = min; cx <= max; cx++) for (let cy = min; cy <= max; cy++) out.push([cx, cy]);
  return out;
}

function findFirst(
  predicate: (chunk: { worldSeed: number; floor: number; cx: number; cy: number }) => boolean,
): { cx: number; cy: number } | null {
  for (let cx = -6; cx <= 6; cx++) {
    const found = findInColumn(cx, predicate);
    if (found) return found;
  }
  return null;
}

function findInColumn(cx: number, predicate: (chunk: { worldSeed: number; floor: number; cx: number; cy: number }) => boolean): { cx: number; cy: number } | null {
  for (let cy = -6; cy <= 6; cy++) {
    if (predicate({ worldSeed: SEED, floor: FLOOR, cx, cy })) return { cx, cy };
  }
  return null;
}

function assertNoPockets(tiles: Uint8Array, cx: number, cy: number): void { const reached = floodFromBorder(tiles); for (let index = 0; index < tiles.length; index++) assertReachedTile({ tiles, reached, index, cx, cy }); }

function assertReachedTile(input: { readonly tiles: Uint8Array; readonly reached: Uint8Array; readonly index: number; readonly cx: number; readonly cy: number }): void { if (input.tiles[input.index] !== TILE.Void) expect(input.reached[input.index], `chunk ${input.cx},${input.cy} tile ${input.index} is an orphan pocket`).toBe(1); }
