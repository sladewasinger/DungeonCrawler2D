import { describe, expect, it } from "vitest";
import { STEP_UP } from "../core/constants";
import { hashString } from "../core/rng";
import { isSafeRoomChunk } from "./features";
import { generateChunk } from "./generate";
import { chunkCenter } from "./terrain";
import { safeRoomChunk, safeRoomFeatures, safeRoomSpawn } from "./rooms";
import { CHUNK_SIZE, TILE, ZONE } from "./types";
import { World } from "./world";

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
    // Chunk (5,5) — outside the dev test zone at (0,0)–(1,1), which is
    // deliberately identical on every seed and floor.
    const a = generateChunk(SEED, FLOOR, 5, 5);
    const b = generateChunk(hashString("other-world"), FLOOR, 5, 5);
    const c = generateChunk(SEED, FLOOR + 1, 5, 5);
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });

  it("borders agree between adjacent chunks (terrain is seamless)", () => {
    const left = generateChunk(SEED, FLOOR, 0, 0);
    const right = generateChunk(SEED, FLOOR, 1, 0);
    // Heights are pure functions of world coords; compare the shared
    // column's immediate neighbors for continuity: the right edge of
    // chunk 0 and left edge of chunk 1 must come from the same fields,
    // so no jump larger than intra-chunk jumps should appear.
    for (let ly = 0; ly < CHUNK_SIZE; ly++) {
      const hL = left.height[ly * CHUNK_SIZE + (CHUNK_SIZE - 1)]!;
      const hR = right.height[ly * CHUNK_SIZE]!;
      const intraJump = Math.abs(
        left.height[ly * CHUNK_SIZE + (CHUNK_SIZE - 1)]! -
          left.height[ly * CHUNK_SIZE + (CHUNK_SIZE - 2)]!,
      );
      // Cross-border jump must be same order as intra-chunk jumps
      // (cliffs exist, but a seam artifact would dwarf them).
      expect(Math.abs(hL - hR)).toBeLessThanOrEqual(Math.max(4, intraJump * 4 + 4));
    }
  });

  it("safe-room chunks contain an entrance portal, not an open sanctuary", () => {
    let found = 0;
    for (let cx = -6; cx <= 6 && found === 0; cx++) {
      for (let cy = -6; cy <= 6 && found === 0; cy++) {
        if (!isSafeRoomChunk(SEED, FLOOR, cx, cy)) continue;
        found++;
        const chunk = generateChunk(SEED, FLOOR, cx, cy);
        let doors = 0;
        let doorIndex = -1;
        for (let i = 0; i < chunk.tiles.length; i++) {
          // The overworld has no sanctuary anymore — safety is behind the door.
          expect(chunk.zones[i]).toBe(ZONE.None);
          if (chunk.tiles[i] === TILE.DoorSafeRoom) {
            doors++;
            doorIndex = i;
          }
        }
        expect(doors).toBe(1);
        // The door sits in the kiosk's south face: wall behind, floor ahead.
        expect(chunk.tiles[doorIndex - CHUNK_SIZE]).toBe(TILE.Wall);
        expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
      }
    }
    expect(found).toBeGreaterThan(0);
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

  it("chunk centers across a region are mutually reachable on foot", () => {
    // BFS over walkable tiles using the movement step rule (can rise
    // ≤ STEP_UP, can drop any amount). The corridor network is the
    // connectivity guarantee: every chunk center must be reachable
    // from the origin chunk's center.
    const world = new World(SEED, FLOOR);
    const range = 2; // 5×5 chunks = 160×160 tiles
    const start = snapCenter(world, 0, 0);
    const reached = bfs(world, start, range);

    for (let cx = -range; cx <= range; cx++) {
      for (let cy = -range; cy <= range; cy++) {
        const target = snapCenter(world, cx, cy);
        expect(
          reached.has(`${target.x},${target.y}`),
          `center of chunk ${cx},${cy} unreachable`,
        ).toBe(true);
      }
    }
  });
});

function snapCenter(world: World, cx: number, cy: number): { x: number; y: number } {
  const c = chunkCenter(world.worldSeed, world.floor, cx, cy);
  // Centers are on the corridor network; snap to the nearest walkable
  // tile just in case of rounding.
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = Math.round(c.x) + dx;
        const y = Math.round(c.y) + dy;
        if (world.isWalkable(x, y)) return { x, y };
      }
    }
  }
  throw new Error(`no walkable tile near center of ${cx},${cy}`);
}

function bfs(
  world: World,
  start: { x: number; y: number },
  chunkRange: number,
): Set<string> {
  const min = -chunkRange * CHUNK_SIZE;
  const max = (chunkRange + 1) * CHUNK_SIZE - 1;
  const reached = new Set<string>([`${start.x},${start.y}`]);
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const curH = world.heightAt(cur.x, cur.y);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < min || ny < min || nx > max || ny > max) continue;
      const key = `${nx},${ny}`;
      if (reached.has(key) || !world.isWalkable(nx, ny)) continue;
      // Walk rule: may rise at most STEP_UP; drops are free.
      if (world.heightAt(nx, ny) - curH > STEP_UP) continue;
      reached.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reached;
}
