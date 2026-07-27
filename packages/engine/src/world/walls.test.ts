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
function raisedPairAt(world: World, x: number, y: number): { floor: { x: number; y: number }; raised: { x: number; y: number } } | null {
  if (world.tileAt(x, y) !== TILE.Floor || world.tileAt(x + 1, y) !== TILE.Floor) return null;
  if (world.heightAt(x + 1, y) - world.heightAt(x, y) < WALL_FACE_MIN_DROP) return null;
  return { floor: { x, y }, raised: { x: x + 1, y } };
}

function interiorCoordinates(cx: number, cy: number): Array<[number, number]> {
  return Array.from({ length: CHUNK_SIZE - 4 }, (_, row) =>
    Array.from({ length: CHUNK_SIZE - 4 }, (_, column) => [cx * CHUNK_SIZE + column + 2, cy * CHUNK_SIZE + row + 2] as [number, number]),
  ).flat();
}

function scanChunkForRaisedPair(world: World, cx: number, cy: number) {
  const coordinate = interiorCoordinates(cx, cy).find(([x, y]) => raisedPairAt(world, x, y));
  return coordinate ? raisedPairAt(world, ...coordinate) : null;
}

function searchChunks(world: World): { floor: { x: number; y: number }; raised: { x: number; y: number } } | null {
  return Array.from({ length: 8 }, (_, row) => row + 2)
    .flatMap((cy) => Array.from({ length: 8 }, (_, column) => [column + 2, cy] as [number, number]))
    .map(([cx, cy]) => scanChunkForRaisedPair(world, cx, cy))
    .find((pair) => pair !== null) ?? null;
}

function findFloorRaisedPair(world: World): { floor: { x: number; y: number }; raised: { x: number; y: number } } {
  const pair = searchChunks(world);
  if (pair) return pair;
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

  function raisedRoomPerimeter(world: World): number {
    const room = personalRoomChunk(0);
    const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    return Array.from({ length: PERSONAL_ROOM_H }, (_, row) => row + top)
      .flatMap((ly) => Array.from({ length: PERSONAL_ROOM_W }, (_, column) => [left + column, ly] as [number, number]))
      .filter(([lx, ly]) => lx === left || lx === left + PERSONAL_ROOM_W - 1 || ly === top || ly === top + PERSONAL_ROOM_H - 1)
      .filter(([lx, ly]) => world.tileAt(room.cx * CHUNK_SIZE + lx, room.cy * CHUNK_SIZE + ly) === TILE.Floor)
      .filter(([lx, ly]) => world.heightAt(room.cx * CHUNK_SIZE + lx, room.cy * CHUNK_SIZE + ly) >= 3).length;
  }

  it("stretch-room perimeters remain raised Floor terrain", () => {
    const world = new World(SEED, FLOOR);
    const spawn = personalRoomSpawn(0);
    expect(raisedRoomPerimeter(world)).toBeGreaterThan(10);
    // Sanity: the room interior itself is walkable floor.
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});
