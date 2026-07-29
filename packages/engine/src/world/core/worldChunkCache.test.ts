import { describe, expect, it } from "vitest";
import { LEVEL } from "./level.js";
import { World } from "./world.js";

describe("World chunk cache retention", () => {
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
