import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "@dc2d/engine";
import { TERRAIN_KINDS, type TerrainSource } from "../planning/terrainPlanner.js";
import { TerrainChunkPlanCache, appendVisibleChunkPlans, emptyTerrainBatches } from "../planning/chunkCache.js";

const source: TerrainSource = {
  terrainAt: () => TERRAIN_KINDS.Floor,
  heightAt: () => 0,
};

describe("TerrainChunkPlanCache", () => {
  it("reuses plans for the same chunk/orientation/revision", () => {
    const cache = new TerrainChunkPlanCache();
    const first = cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    expect(cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 })).toBe(first);
    expect(cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 90, revision: 1 })).not.toBe(first);
  });

  it("invalidates seam neighbors when a tile changes", () => {
    const cache = new TerrainChunkPlanCache();
    cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    cache.get({ source, coord: { cx: 1, cy: 0 }, orientation: 0, revision: 1 });
    cache.get({ source, coord: { cx: 4, cy: 4 }, orientation: 0, revision: 1 });
    cache.invalidateTile(CHUNK_SIZE, 2);
    expect(cache.size).toBe(1);
  });

  it("combines only chunks intersecting the requested bounds", () => {
    const batches = emptyTerrainBatches();
    appendVisibleChunkPlans({ target: batches, cache: new TerrainChunkPlanCache(), source, bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0, revision: 1 });
    expect(batches.floors.length).toBe(CHUNK_SIZE ** 2);
  });
});
