import { describe, expect, it } from "vitest";
import { JUMP_VELOCITY, GRAVITY, TICK_DT, WALL_FACE_MIN_DROP } from "../core/constants.js";
import { hashString } from "../core/rng.js";
import { createBody, stepBody } from "../entities/movement/index.js";
import {
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  personalRoomChunk,
  personalRoomSpawn,
} from "./features/rooms.js";
import { CHUNK_SIZE, TERRAIN, TILE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

/**
 * Runtime terrain no longer stores Wall cells. Former uncarved cells are raised Floors;
 * the height transition blocks grounded movement and the renderer derives its
 * camera-facing face from adjacent finite Floor heights.
 */

/** A floor tile with a raised Floor immediately to its east. */
function findFloorRaisedPair(world: World): { floor: { x: number; y: number }; raised: { x: number; y: number } } {
  for (let cy = 2; cy < 10; cy++) {
    for (let cx = 2; cx < 10; cx++) {
      for (let ly = 2; ly < CHUNK_SIZE - 2; ly++) {
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
          const x = cx * CHUNK_SIZE + lx;
          const y = cy * CHUNK_SIZE + ly;
          if (world.tileAt(x, y) !== TILE.Floor) continue;
          if (world.tileAt(x + 1, y) !== TILE.Floor) continue;
          if (world.heightAt(x + 1, y) - world.heightAt(x, y) < WALL_FACE_MIN_DROP) continue;
          return { floor: { x, y }, raised: { x: x + 1, y } };
        }
      }
    }
  }
  throw new Error("no floor→raised-floor pair found in scan range");
}

describe("height-derived terrain boundaries", () => {
  it("former uncarved cells are finite Floor surfaces, not Wall tiles", () => {
    const world = new World(SEED, FLOOR);
    const { raised } = findFloorRaisedPair(world);
    expect(world.tileAt(raised.x, raised.y)).toBe(TILE.Floor);
    expect(world.terrainAt(raised.x, raised.y)).toBe(TERRAIN.Floor);
    expect(world.heightAt(raised.x, raised.y)).toBeGreaterThan(0);
  });

  it("walking into a raised terrain boundary is blocked by the height gate", () => {
    const world = new World(SEED, FLOOR);
    const { floor } = findFloorRaisedPair(world);
    const body = createBody(floor.x + 0.5, floor.y + 0.5, world.heightAt(floor.x, floor.y));
    for (let i = 0; i < 20; i++) stepBody(world, body, { moveX: 1, moveY: 0, jump: false }, TICK_DT);
    expect(Math.floor(body.x)).toBe(floor.x);
  });

  it("generated chunks contain no runtime Wall values", () => {
    const world = new World(SEED, FLOOR);
    expect(Array.from(world.getChunk(2, 2).tiles)).not.toContain(1);
  });

  it("a full-hop apex clears the old WALL_RISE step, proving this is a deliberate veto, not insufficient jump power", () => {
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(apex).toBeGreaterThan(1); // comfortably above WALL_RISE (1)
  });

  it("stretch-room perimeters remain raised Floor terrain", () => {
    const world = new World(SEED, FLOOR);
    const room = personalRoomChunk(0);
    const spawn = personalRoomSpawn(0);
    let raised = 0;
    const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    for (let ly = top; ly < top + PERSONAL_ROOM_H; ly++) {
      for (let lx = left; lx < left + PERSONAL_ROOM_W; lx++) {
        if (lx > left && lx < left + PERSONAL_ROOM_W - 1 &&
            ly > top && ly < top + PERSONAL_ROOM_H - 1) continue;
        const x = room.cx * CHUNK_SIZE + lx;
        const y = room.cy * CHUNK_SIZE + ly;
        if (world.tileAt(x, y) === TILE.Floor && world.heightAt(x, y) >= 3) raised++;
      }
    }
    expect(raised).toBeGreaterThan(10);
    // Sanity: the room interior itself is walkable floor.
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});
