// Public-facade invariants for the default chunk generator (world/generate.ts):
// determinism, flat-first-plus-deliberate-height, fixed-feature placement,
// pocket sealing, and the instanced safe room. Generator-internal invariants
// (BSP layout, districts, avenues, landmarks, chasms) live under generate/.

import { describe, expect, it } from "vitest";
import { hashString } from "../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "./features/fixed.js";
import { CHASM_DEPTH } from "./generate/height.js";
import { TOWER_MAX_RISE } from "./generate/landmarks/tower.js";
import { generateChunk } from "./generate.js";
import {
  PERSONAL_ROOM_H,
  personalRoomChunk,
  personalRoomFeatures,
  personalRoomSpawn,
  safeRoomChunk,
  safeRoomFeatures,
  safeRoomSpawn,
} from "./features/rooms.js";
import { CHUNK_SIZE, TILE, ZONE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

describe("world generation", () => {
  it("is byte-identical for identical inputs (networking invariant)", () => {
    for (const [cx, cy] of [
      [0, 0],
      [-3, 7],
      [12, -12],
    ] as const) {
      const a = generateChunk(SEED, FLOOR, cx, cy);
      const b = generateChunk(SEED, FLOOR, cx, cy);
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect(Array.from(a.height)).toEqual(Array.from(b.height));
      expect(Array.from(a.zones)).toEqual(Array.from(b.zones));
    }
  });

  it("differs across seeds and floors", () => {
    const a = generateChunk(SEED, FLOOR, 5, 5);
    const b = generateChunk(hashString("other-world"), FLOOR, 5, 5);
    const c = generateChunk(SEED, FLOOR + 1, 5, 5);
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });

  it("is flat-first: floor height is 0 or within the pit/dais/chasm/landmark tier budget", () => {
    let plainFloors = 0;
    let deliberateFloors = 0;
    for (const [cx, cy] of chunkGrid(-5, 5)) {
      if (isSafeRoomChunk(SEED, FLOOR, cx, cy) || isStairsChunk(SEED, FLOOR, cx, cy)) continue;
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      for (let i = 0; i < chunk.tiles.length; i++) {
        const h = chunk.height[i] ?? 0;
        if (chunk.tiles[i] === TILE.Floor) {
          expect(h).toBeGreaterThanOrEqual(CHASM_DEPTH);
          expect(h).toBeLessThanOrEqual(TOWER_MAX_RISE);
          if (h === 0) plainFloors++;
          else deliberateFloors++;
        } else if (chunk.tiles[i] === TILE.Stairs) {
          // A doorway ramp, a repaired cliff, or a landmark-tier step,
          // bounded by the deepest and tallest deliberate features.
          expect(h).toBeGreaterThanOrEqual(CHASM_DEPTH);
          expect(h).toBeLessThanOrEqual(TOWER_MAX_RISE);
        }
      }
    }
    expect(plainFloors).toBeGreaterThan(500);
    expect(deliberateFloors).toBeGreaterThan(0);
  });

  it("safe-room chunks contain an entrance portal, not an open sanctuary", () => {
    const found = findFirst(isSafeRoomChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
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
    expect(chunk.tiles[doorIndex - CHUNK_SIZE]).toBe(TILE.Wall);
    expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
  });

  it("stairway chunks contain a stairs pad", () => {
    const found = findFirst(isStairsChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
    const stairTiles = Array.from(chunk.tiles).filter((t) => t === TILE.Stairs).length;
    expect(stairTiles).toBeGreaterThan(0);
  });

  it("the instanced safe room has sanctuary, portal doors, and fixtures", () => {
    const world = new World(SEED, FLOOR);
    const doorCx = 3;
    const doorCy = -2;
    const f = safeRoomFeatures(doorCx, doorCy);
    expect(world.tileAt(f.doorPersonal.x, f.doorPersonal.y)).toBe(TILE.DoorPersonal);
    expect(world.tileAt(f.doorParty.x, f.doorParty.y)).toBe(TILE.DoorParty);
    expect(world.tileAt(f.exit.x, f.exit.y)).toBe(TILE.DoorExit);
    expect(world.tileAt(f.stash.x, f.stash.y)).toBe(TILE.Stash);
    expect(world.tileAt(f.table.x, f.table.y)).toBe(TILE.CraftingTable);

    const spawn = safeRoomSpawn(doorCx, doorCy);
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);

    // Distinct doors get distinct rooms; the same door is stable.
    const roomA = safeRoomChunk(doorCx, doorCy);
    const roomB = safeRoomChunk(doorCx + 1, doorCy);
    expect(roomA).not.toEqual(roomB);
    expect(safeRoomChunk(doorCx, doorCy)).toEqual(roomA);
  });

  it("embeds the personal sanctuary exit in the north wall and spawns the player just inside", () => {
    const world = new World(SEED, FLOOR);
    const chunk = personalRoomChunk(0);
    const baseY = chunk.cy * CHUNK_SIZE;
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    const features = personalRoomFeatures(0);
    const spawn = personalRoomSpawn(0);

    expect(features.exit.y).toBe(baseY + top + 1);
    expect(world.tileAt(features.exit.x, features.exit.y)).toBe(TILE.DoorExit);
    expect(world.tileAt(features.exit.x - 1, features.exit.y)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x + 1, features.exit.y)).toBe(TILE.Floor);
    expect(world.tileAt(features.exit.x - 1, features.exit.y - 1)).toBe(TILE.Wall);
    expect(world.tileAt(features.exit.x + 1, features.exit.y - 1)).toBe(TILE.Wall);
    expect(world.tileAt(features.exit.x, features.exit.y + 1)).toBe(TILE.Floor);
    expect(Math.floor(spawn.x)).toBe(features.exit.x);
    expect(Math.floor(spawn.y)).toBe(features.exit.y + 1);
    expect(world.isSanctuary(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });

  it("has no unreachable interior floor pockets (pocket sealing)", () => {
    for (const [cx, cy] of chunkGrid(-2, 2)) {
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      const reached = floodFromBorder(chunk.tiles);
      for (let i = 0; i < chunk.tiles.length; i++) {
        if (chunk.tiles[i] === TILE.Wall) continue;
        expect(reached[i], `chunk ${cx},${cy} tile ${i} is an orphan pocket`).toBe(1);
      }
    }
  });
});

function chunkGrid(min: number, max: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cx = min; cx <= max; cx++) {
    for (let cy = min; cy <= max; cy++) out.push([cx, cy]);
  }
  return out;
}

function findFirst(
  predicate: (seed: number, floor: number, cx: number, cy: number) => boolean,
): { cx: number; cy: number } | null {
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      if (predicate(SEED, FLOOR, cx, cy)) return { cx, cy };
    }
  }
  return null;
}

/** Mirrors pockets.ts's own reach seeds: border, stairs, or a safe-room door. */
function isReachSeed(tiles: Uint8Array, i: number): boolean {
  const lx = i % CHUNK_SIZE;
  const ly = (i - lx) / CHUNK_SIZE;
  const onBorder = lx === 0 || ly === 0 || lx === CHUNK_SIZE - 1 || ly === CHUNK_SIZE - 1;
  return onBorder || tiles[i] === TILE.Stairs || tiles[i] === TILE.DoorSafeRoom;
}

function orthoNeighbors(i: number): number[] {
  const lx = i % CHUNK_SIZE;
  const ly = (i - lx) / CHUNK_SIZE;
  return [
    lx > 0 ? i - 1 : -1,
    lx < CHUNK_SIZE - 1 ? i + 1 : -1,
    ly > 0 ? i - CHUNK_SIZE : -1,
    ly < CHUNK_SIZE - 1 ? i + CHUNK_SIZE : -1,
  ];
}

/** Reachability from every chunk-border/stairs/door tile, ignoring wall topology only. */
function floodFromBorder(tiles: Uint8Array): Uint8Array {
  const reached = new Uint8Array(tiles.length);
  const queue: number[] = [];
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Wall || !isReachSeed(tiles, i)) continue;
    reached[i] = 1;
    queue.push(i);
  }
  while (queue.length > 0) {
    const i = queue.pop();
    if (i === undefined) break;
    for (const n of orthoNeighbors(i)) {
      if (n < 0 || reached[n] === 1 || tiles[n] === TILE.Wall) continue;
      reached[n] = 1;
      queue.push(n);
    }
  }
  return reached;
}
