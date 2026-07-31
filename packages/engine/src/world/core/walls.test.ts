import { describe, expect, it } from "vitest";
import { TICK_DT, WALL_FACE_MIN_DROP } from "../../core/constants.js";
import { hashString } from "../../core/rng.js";
import { createBody, stepBody } from "../../entities/movement/index.js";
import {
  PERSONAL_ROOM_H,
  PERSONAL_ROOM_W,
  personalRoomChunk,
  personalRoomSpawn,
} from "../features/rooms/rooms.js";
import { CHUNK_SIZE, TERRAIN, TILE } from "./types.js";
import { World } from "./world.js";

const SEED = hashString("test-world");
const FLOOR = 1;

/** Runtime authored terrain retains finite raised Floors; topology-only walls become VOID. */

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
  it("authored raised cells remain finite Floor surfaces", () => {
    const world = new World(SEED, FLOOR);
    const { raised } = findFloorRaisedPair(world);
    expect(world.tileAt(raised.x, raised.y)).toBe(TILE.Floor);
    expect(world.terrainAt(raised.x, raised.y)).toBe(TERRAIN.Floor);
    expect(world.heightAt(raised.x, raised.y)).toBeGreaterThan(0);
  });

  it("topology-only wall cells become flat infinite-height VOID", () => {
    const world = new World(SEED, FLOOR);
    const chunk = world.getChunk(2, 2);
    const index = chunk.terrain.findIndex((terrain) => terrain === TERRAIN.Void);
    expect(index).toBeGreaterThanOrEqual(0);
    if (index < 0) return;
    const x = 2 * CHUNK_SIZE + (index % CHUNK_SIZE);
    const y = 2 * CHUNK_SIZE + Math.floor(index / CHUNK_SIZE);
    expect(world.tileAt(x, y)).toBe(TILE.Void);
    expect(world.heightAt(x, y)).toBe(0);
    expect(world.isWalkable(x, y)).toBe(false);
  });

  it("runtime chunks do not retain z2 Floor plateau cells", () => {
    const world = new World(SEED, FLOOR);
    const chunk = world.getChunk(0, 0);
    expect(
      Array.from(chunk.tiles).every((tile, index) => tile !== TILE.Floor || (chunk.height[index] ?? 0) < 2),
    ).toBe(true);
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

  it("stretch rooms keep only the north wall raised and use a sealed collision apron", () => {
    const world = new World(SEED, FLOOR);
    const room = personalRoomChunk(0);
    const left = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_W / 2);
    const top = Math.floor(CHUNK_SIZE / 2 - PERSONAL_ROOM_H / 2);
    const spawn = personalRoomSpawn(0);
    for (let lx = left; lx < left + PERSONAL_ROOM_W; lx++) {
      expect(world.heightAt(room.cx * CHUNK_SIZE + lx, room.cy * CHUNK_SIZE + top)).toBe(3);
    }
    expect(world.tileAt(room.cx * CHUNK_SIZE + left - 1, Math.floor(spawn.y))).toBe(TILE.Bedrock);
    expect(world.isWalkable(Math.floor(spawn.x), Math.floor(spawn.y))).toBe(true);
  });
});
