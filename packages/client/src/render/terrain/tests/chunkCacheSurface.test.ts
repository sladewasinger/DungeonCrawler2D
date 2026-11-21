import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "@dc2d/engine";
import { TERRAIN_KINDS, type TerrainSource } from "../planning/terrainPlanner.js";
import {
  appendVisibleChunkPlans,
  emptyTerrainBatches,
  TerrainChunkPlanCache,
} from "../planning/chunkCache.js";

const source: TerrainSource = {
  voidTerrain: true,
  terrainAt: () => TERRAIN_KINDS.Floor,
  heightAt: () => 0,
};

describe("finite terrain surfaces across chunk reloads", () => {
  it("keeps bedrock surfaces stable when a chunk is revisited after directional traversal", () => {
    const cache = new TerrainChunkPlanCache();
    const finiteSource: TerrainSource = {
      ...source,
      cacheIdentity: "finite-floor-a",
      surfaceAt: (x, y) => x === 0 && y === 0 ? "bedrock" : "floor",
    };
    const first = cache.get({ source: finiteSource, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    cache.get({ source: finiteSource, coord: { cx: 0, cy: 1 }, orientation: 0, revision: 1 });
    const revisited = cache.get({ source: finiteSource, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });

    expect(revisited).toBe(first);
    expect(revisited.batches.floors.find(({ worldTile }) => worldTile.x === 0 && worldTile.y === 0)?.surface).toBe("bedrock");
  });

  it("keeps void cells out of floor batches after directional reload", () => {
    const cache = new TerrainChunkPlanCache();
    const finiteSource: TerrainSource = {
      ...source,
      cacheIdentity: "finite-floor-void",
      terrainAt: (x, y) => x === 0 && y === 0 ? TERRAIN_KINDS.Void : TERRAIN_KINDS.Floor,
    };
    cache.get({ source: finiteSource, coord: { cx: 0, cy: 1 }, orientation: 0, revision: 1 });
    const plan = cache.get({ source: finiteSource, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });

    expect(plan.batches.floors.some(({ worldTile }) => worldTile.x === 0 && worldTile.y === 0)).toBe(false);
    expect(plan.batches.voids.some(({ worldTile }) => worldTile.x === 0 && worldTile.y === 0)).toBe(true);
  });

  it("does not reuse plans between finite-floor identities at one revision", () => {
    const cache = new TerrainChunkPlanCache();
    const first = cache.get({ source: { ...source, cacheIdentity: "floor-a" }, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    const second = cache.get({ source: { ...source, cacheIdentity: "floor-b" }, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    expect(second).not.toBe(first);
  });

  it("does not admit chunks wholly outside the finite envelope", () => {
    const cache = new TerrainChunkPlanCache();
    const finiteSource: TerrainSource = {
      ...source,
      finiteBounds: { x: 0, y: 0, width: CHUNK_SIZE, height: CHUNK_SIZE },
    };
    const outside = cache.get({
      source: finiteSource,
      coord: { cx: 2, cy: 0 },
      orientation: 0,
      revision: 1,
    });

    expect(cache.size).toBe(0);
    expect(outside.batches.floors).toHaveLength(0);
  });

  it("does not plan outside chunks when a finite view touches an envelope edge", () => {
    const cache = new TerrainChunkPlanCache();
    const finiteSource: TerrainSource = {
      ...source,
      finiteBounds: { x: 0, y: 0, width: CHUNK_SIZE, height: CHUNK_SIZE },
    };
    const batches = emptyTerrainBatches();
    appendVisibleChunkPlans({
      target: batches,
      cache,
      source: finiteSource,
      bounds: { x: -CHUNK_SIZE, y: 0, width: CHUNK_SIZE * 2, height: 1 },
      orientation: 0,
      revision: 1,
    });

    expect(cache.size).toBe(1);
    expect(batches.floors.every(({ worldTile }) => worldTile.x >= 0)).toBe(true);
  });

  it("does not reuse plans across finite envelopes at one revision", () => {
    const cache = new TerrainChunkPlanCache();
    const input = { coord: { cx: 0, cy: 0 }, orientation: 0 as const, revision: 1 };
    const first = cache.get({
      ...input,
      source: { ...source, finiteBounds: { x: 0, y: 0, width: 32, height: 32 } },
    });
    const second = cache.get({
      ...input,
      source: { ...source, finiteBounds: { x: 1, y: 1, width: 30, height: 30 } },
    });

    expect(second).not.toBe(first);
  });
});
