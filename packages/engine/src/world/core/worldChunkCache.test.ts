import { describe, expect, it } from "vitest";
import { personalRoomChunk, spawnRoomChunk, spawnRoomSpawn } from "../features/rooms/rooms.js";
import { LEVEL } from "./level.js";
import { CHUNK_SIZE, TILE, ZONE } from "./types.js";
import { World } from "./world.js";
import { generateFiniteFloor } from "../generate/finiteFloor.js";

describe("World chunk cache retention", () => {
  it("does not eagerly materialize finite chunks during World construction", () => {
    const world = new World(71, 1);

    expect(world.generatedFloor).not.toBeNull();
    expect(world.cachedChunkCount).toBe(0);
    expect(world.finiteSliceCount).toBe(0);
  }, 30_000);

  it("accepts an already generated authoritative floor handoff", () => {
    const config = { mazeDensity: 0.75, roomSizeVariation: 1 } as const;
    const floor = generateFiniteFloor({ worldSeed: 71, floor: 1, config });
    const world = new World(71, 1, {
      generatedFloor: floor,
      generation: config,
      expectedGeneration: floor.identity,
    });

    expect(world.cachedChunkCount).toBe(0);
    expect(world.generatedFloor).not.toBe(floor);
    expect(world.generatedFloor).toEqual(floor);
    const publicFloor = world.generatedFloor;
    if (!publicFloor) throw new Error("missing public generated floor");
    const point = floor.spawn;
    const index = (point.y - floor.bounds.minY) * floor.bounds.width + point.x - floor.bounds.minX;
    const runtimeHeight = world.heightAt(point.x, point.y);
    publicFloor.height[index] = runtimeHeight + 99;
    expect(world.heightAt(point.x, point.y)).toBe(runtimeHeight);
    expect(world.floorIdentity).toEqual(floor.identity);
    expect(world.cachedChunkCount).toBe(0);
    expect(() => new World(71, 1, {
      generatedFloor: floor,
      generation: { ...config, mazeDensity: 0.5 },
      expectedGeneration: floor.identity,
    })).toThrow("generation configuration");
  }, 30_000);

  it("keeps sandbox floor zero on the legacy flat fixture path", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const chunk = world.getChunk(0, 0);

    expect(world.generatedFloor).toBeNull();
    expect(chunk.tiles).toHaveLength(CHUNK_SIZE * CHUNK_SIZE);
    expect(chunk.tiles).toContain(TILE.Floor);
    expect(world.cachedChunkCount).toBe(1);
  });

  it("caches all nine runtime chunks from one district plan", () => {
    const world = new World(7, 1, LEVEL.Sandbox);
    const first = world.getChunk(1, 1);
    expect(world.cachedChunkCount).toBe(9);
    expect(world.getChunk(1, 1)).toBe(first);
    world.getChunk(2, 2);
    expect(world.cachedChunkCount).toBe(9);
  }, 30_000);

  it("does not cache district terrain over reserved rooms", () => {
    const world = new World(7, 1);
    const personal = personalRoomChunk(0);
    const spawn = spawnRoomChunk();

    world.getChunk(personal.cx, personal.cy - 1);
    world.getChunk(spawn.cx - 1, spawn.cy - 1);

    expect(world.getChunk(personal.cx, personal.cy).zones)
      .toContain(ZONE.Sanctuary);
    expect(world.getChunk(spawn.cx, spawn.cy).zones)
      .toContain(ZONE.Sanctuary);
  });

  it("reads a cached room-isolation chunk without re-entering getChunk", () => {
    const world = new World(71, 1);
    const spawn = spawnRoomSpawn(10);
    world.getChunk(Math.floor(spawn.x / CHUNK_SIZE), Math.floor(spawn.y / CHUNK_SIZE));
    let calls = 0;
    const original = world.getChunk.bind(world);
    world.getChunk = (cx, cy) => { calls += 1; return original(cx, cy); };

    for (let index = 0; index < 64; index += 1) {
      world.heightAt(spawn.x, spawn.y);
      world.featureAt(spawn.x, spawn.y);
    }

    expect(calls).toBe(0);
  }, 30_000);

  it("evicts distant chunks and deterministically regenerates them", () => {
    const world = new World(7, 1, LEVEL.Sandbox);
    const origin = world.getChunk(0, 0);
    const distant = world.getChunk(4, 0);
    for (let cx = 1; cx < 4; cx += 1) world.getChunk(cx, 0);

    world.pruneChunkCache(0, 0, 2);

    expect(world.cachedChunkCount).toBe(2);
    expect(world.getChunk(0, 0)).toBe(origin);
    expect(world.getChunk(4, 0)).not.toBe(distant);
    expect(world.getChunk(4, 0)).toEqual(distant);
  });

  it("reconstructs evicted finite chunks from the canonical indexed floor", () => {
    const world = new World(71, 1);
    const floor = world.generatedFloor;
    if (!floor) throw new Error("missing generated floor fixture");
    const point = floor.spawn;
    const cx = Math.floor(point.x / CHUNK_SIZE);
    const cy = Math.floor(point.y / CHUNK_SIZE);
    const original = world.getChunk(cx, cy);
    const source = (point.y - floor.bounds.minY) * floor.bounds.width + point.x - floor.bounds.minX;

    world.pruneChunkCache(100_000, 100_000, 0);

    expect(world.getChunk(cx, cy)).toEqual(original);
    const peer = new World(71, 1);
    expect(peer.generatedFloor?.tiles[source]).toBe(floor.tiles[source]);
    expect(peer.generatedFloor?.height[source]).toBe(floor.height[source]);
  }, 10_000);

  it("keeps only active finite chunks after the cache is pruned", () => {
    const world = new World(71, 1);
    const first = world.getChunk(0, 0);
    expect(world.finiteSliceCount).toBe(0);

    world.pruneChunkCache(100_000, 100_000, 0);

    expect(world.cachedChunkCount).toBe(0);
    expect(world.getChunk(0, 0)).not.toBe(first);
    expect(world.getChunk(0, 0)).toEqual(first);
    expect(world.finiteSliceCount).toBe(0);
  }, 30_000);

  it("does not retain out-of-bounds finite slices", () => {
    const world = new World(71, 1);
    const before = world.finiteSliceCount;

    world.getChunk(-10_000, -10_000);
    world.getChunk(10_000, 1_000);
    world.getChunk(-10_000, 1_000);

    expect(world.cachedChunkCount).toBe(0);
    expect(world.finiteSliceCount).toBe(before);
  }, 30_000);
});
