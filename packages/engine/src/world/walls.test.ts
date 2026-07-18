import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, STEP_UP, TICK_DT, WALL_RISE } from "../core/constants.js";
import { hashString } from "../core/rng.js";
import { createBody, stepBody } from "../entities/movement/index.js";
import { personalRoomChunk, personalRoomSpawn } from "./features/rooms.js";
import { CHUNK_SIZE, TILE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

/**
 * Walls are terrain: a wall tile is the local ground raised WALL_RISE.
 * You can't walk up it, you CAN jump onto it, and you fall off it like
 * any ledge. These tests drive the real movement physics over real
 * generated chunks — the contract the art now promises.
 */

/** A floor tile beside a wall whose top is a clean jumpable step up. */
function findWallStep(world: World): { floor: { x: number; y: number }; wall: { x: number; y: number } } {
  for (let cy = 2; cy < 10; cy++) {
    for (let cx = 2; cx < 10; cx++) {
      for (let ly = 2; ly < CHUNK_SIZE - 2; ly++) {
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          if (world.tileAt(x, y) !== TILE.Floor) continue;
          if (world.tileAt(x + 1, y) !== TILE.Wall) continue;
          const rise = world.heightAt(x + 1, y) - world.heightAt(x, y);
          // Terrain varies under both tiles; take a clean, clearly
          // jumpable step (jump apex ≈ 2.2).
          if (rise > 1.6 && rise < 2.05) return { floor: { x, y }, wall: { x: x + 1, y } };
        }
      }
    }
  }
  throw new Error("no floor→wall step found in scan range");
}

describe("walls as raised terrain", () => {
  it("wall rise is above STEP_UP but under the jump apex (physics invariant)", () => {
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(WALL_RISE).toBeGreaterThan(STEP_UP);
    expect(WALL_RISE).toBeLessThan(apex);
  });

  it("wall tiles are walkable tops raised WALL_RISE above their ground", () => {
    const world = new World(SEED, FLOOR);
    const { floor, wall } = findWallStep(world);
    expect(world.isWalkable(wall.x, wall.y)).toBe(true);
    expect(world.heightAt(wall.x, wall.y) - world.heightAt(floor.x, floor.y)).toBeGreaterThan(
      STEP_UP,
    );
  });

  it("walking into a wall is blocked; jumping lands you on top; walking off drops you", () => {
    const world = new World(SEED, FLOOR);
    const { floor } = findWallStep(world);
    const body = createBody(floor.x + 0.5, floor.y + 0.5, world.heightAt(floor.x, floor.y));

    // Walk east into the wall for a second: the height gate holds.
    for (let i = 0; i < 20; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(Math.floor(body.x)).toBe(floor.x);

    // Jump + push east briefly, then let go: rise over the lip, drift
    // on, land on a wall top.
    stepBody(world, body, { moveX: 1, moveY: 0, jump: true }, TICK_DT);
    for (let i = 0; i < 9; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    for (let i = 0; i < 30 && !body.grounded; i++) {
      stepBody(world, body, { moveX: 0, moveY: 0, jump: false }, TICK_DT);
    }
    expect(body.grounded).toBe(true);
    const onX = Math.floor(body.x);
    const onY = Math.floor(body.y);
    expect(world.tileAt(onX, onY)).toBe(TILE.Wall); // standing ON the wall
    expect(body.z).toBeCloseTo(world.heightAt(onX, onY), 5);

    // Walk back west off the platform: a plain fall, no damage range.
    let landed: number | null = null;
    for (let i = 0; i < 60 && landed === null; i++) {
      const r = stepBody(world, body, { moveX: -1, moveY: 0, jump: false }, TICK_DT);
      if (r.landed) landed = r.landed.fallHeight;
    }
    // How far it fell depends on the terrain below; that it FELL from a
    // real height (rather than stepping down) is the mechanic.
    expect(landed).not.toBeNull();
    expect(landed ?? 0).toBeGreaterThan(STEP_UP);
    expect(world.tileAt(Math.floor(body.x), Math.floor(body.y))).not.toBe(TILE.Wall);
    expect(body.z).toBeCloseTo(world.heightAt(Math.floor(body.x), Math.floor(body.y)), 5);
  });

  it("stretch-room walls rise beyond the jump apex — rooms stay sealed", () => {
    const world = new World(SEED, FLOOR);
    const room = personalRoomChunk(0);
    const spawn = personalRoomSpawn(0);
    const floorH = world.heightAt(Math.floor(spawn.x), Math.floor(spawn.y));
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    // Every wall tile in the room chunk towers over the interior.
    let walls = 0;
    for (let ly = 0; ly < CHUNK_SIZE; ly += 4) {
      for (let lx = 0; lx < CHUNK_SIZE; lx += 4) {
        const x = room.cx * CHUNK_SIZE + lx;
        const y = room.cy * CHUNK_SIZE + ly;
        if (world.tileAt(x, y) !== TILE.Wall) continue;
        walls++;
        expect(world.heightAt(x, y) - floorH).toBeGreaterThan(apex);
      }
    }
    expect(walls).toBeGreaterThan(10);
  });
});
