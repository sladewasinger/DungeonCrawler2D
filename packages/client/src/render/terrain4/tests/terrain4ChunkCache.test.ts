import { describe, expect, it } from "vitest";
import { TERRAIN4, type Terrain4Source } from "../terrainPlanner.js";
import { Terrain4ChunkPlanCache, appendVisibleChunkPlans, emptyTerrain4Batches } from "../terrain4ChunkCache.js";

const source: Terrain4Source = {
  terrainAt: () => TERRAIN4.Floor,
  heightAt: () => 0,
};

describe("Terrain4ChunkPlanCache", () => {
  it("reuses plans for the same chunk/orientation/revision", () => {
    const cache = new Terrain4ChunkPlanCache();
    const first = cache.get(source, { cx: 0, cy: 0 }, 0, 1);
    expect(cache.get(source, { cx: 0, cy: 0 }, 0, 1)).toBe(first);
    expect(cache.get(source, { cx: 0, cy: 0 }, 90, 1)).not.toBe(first);
  });

  it("invalidates seam neighbors when a tile changes", () => {
    const cache = new Terrain4ChunkPlanCache();
    cache.get(source, { cx: 0, cy: 0 }, 0, 1);
    cache.get(source, { cx: 1, cy: 0 }, 0, 1);
    cache.get(source, { cx: 4, cy: 4 }, 0, 1);
    cache.invalidateTile(64, 2);
    expect(cache.size).toBe(1);
  });

  it("combines only chunks intersecting the requested bounds", () => {
    const batches = emptyTerrain4Batches();
    appendVisibleChunkPlans(batches, new Terrain4ChunkPlanCache(), source, { x: 0, y: 0, width: 1, height: 1 }, 0, 1);
    expect(batches.floors.length).toBe(64 * 64);
  });
});
