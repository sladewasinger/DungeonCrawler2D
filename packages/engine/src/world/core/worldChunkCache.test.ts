import { describe, expect, it } from "vitest";
import { personalRoomChunk, spawnRoomChunk } from "../features/rooms/rooms.js";
import { LEVEL } from "./level.js";
import { ZONE } from "./types.js";
import { World } from "./world.js";

describe("World chunk cache retention", () => {
  it("caches all nine runtime chunks from one district plan", () => {
    const world = new World(7, 1, LEVEL.Sandbox);
    const first = world.getChunk(1, 1);
    expect(world.cachedChunkCount).toBe(9);
    expect(world.getChunk(1, 1)).toBe(first);
    world.getChunk(2, 2);
    expect(world.cachedChunkCount).toBe(9);
  });

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
});
