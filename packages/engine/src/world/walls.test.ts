import { describe, expect, it } from "vitest";
import { JUMP_VELOCITY, GRAVITY, TICK_DT } from "../core/constants.js";
import { hashString } from "../core/rng.js";
import { createBody, stepBody } from "../entities/movement/index.js";
import { personalRoomChunk, personalRoomSpawn } from "./features/rooms.js";
import { CHUNK_SIZE, TILE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

/**
 * Walls are solid, period (2026-07-19 user decree, supersedes the prior
 * "wall tops are walkable platforms" model): a wall tile's visual height
 * stays as generated, but its collision is figuratively infinite —
 * nothing walks into it, jumps onto it, or lands on top, no matter how
 * small the visual rise. High-ground tactics live exclusively on raised
 * FLOOR terraces (terraces.ts, platforms.ts), which remain jumpable.
 */

/** A floor tile with a wall immediately to its east, anywhere in scan range. */
function findFloorWallPair(world: World): { floor: { x: number; y: number }; wall: { x: number; y: number } } {
  for (let cy = 2; cy < 10; cy++) {
    for (let cx = 2; cx < 10; cx++) {
      for (let ly = 2; ly < CHUNK_SIZE - 2; ly++) {
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          if (world.tileAt(x, y) !== TILE.Floor) continue;
          if (world.tileAt(x + 1, y) !== TILE.Wall) continue;
          return { floor: { x, y }, wall: { x: x + 1, y } };
        }
      }
    }
  }
  throw new Error("no floor→wall pair found in scan range");
}

describe("walls are solid", () => {
  it("wall tiles are never walkable, regardless of their visual height", () => {
    const world = new World(SEED, FLOOR);
    const { wall } = findFloorWallPair(world);
    expect(world.isWalkable(wall.x, wall.y)).toBe(false);
    // Visual height is untouched by the collision change — it still
    // renders raised.
    expect(world.heightAt(wall.x, wall.y)).toBeGreaterThan(0);
  });

  it("walking into a wall is blocked outright", () => {
    const world = new World(SEED, FLOOR);
    const { floor } = findFloorWallPair(world);
    const body = createBody(floor.x + 0.5, floor.y + 0.5, world.heightAt(floor.x, floor.y));
    for (let i = 0; i < 20; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(Math.floor(body.x)).toBe(floor.x);
  });

  it("jumping at a wall never lands you on top of it — the corner check is a hard veto, not a height gate", () => {
    const world = new World(SEED, FLOOR);
    const { floor, wall } = findFloorWallPair(world);
    const body = createBody(floor.x + 0.5, floor.y + 0.5, world.heightAt(floor.x, floor.y));

    // Full hop, apex well above WALL_RISE, driven straight at the wall.
    stepBody(world, body, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    for (let i = 0; i < 60; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);

    // Never entered the wall's column, and never rests at the wall's
    // top height while standing over it.
    expect(Math.floor(body.x)).toBeLessThanOrEqual(wall.x - 1);
    if (body.grounded) {
      expect(world.tileAt(Math.floor(body.x), Math.floor(body.y))).not.toBe(TILE.Wall);
    }
  });

  it("a full-hop apex clears the old WALL_RISE step, proving this is a deliberate veto, not insufficient jump power", () => {
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(apex).toBeGreaterThan(1); // comfortably above WALL_RISE (1)
  });

  it("stretch-room walls stay sealed (unchanged — they were already unjumpably tall)", () => {
    const world = new World(SEED, FLOOR);
    const room = personalRoomChunk(0);
    const spawn = personalRoomSpawn(0);
    let walls = 0;
    for (let ly = 0; ly < CHUNK_SIZE; ly += 4) {
      for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
        const x = room.cx * CHUNK_SIZE + lx;
        const y = room.cy * CHUNK_SIZE + ly;
        if (world.tileAt(x, y) !== TILE.Wall) continue;
        walls++;
        expect(world.isWalkable(x, y)).toBe(false);
      }
    }
    expect(walls).toBeGreaterThan(10);
    // Sanity: the room interior itself is walkable floor.
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});
