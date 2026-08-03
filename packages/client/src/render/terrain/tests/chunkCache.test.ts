import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "@dc2d/engine";
import { TERRAIN_KINDS, type TerrainSource } from "../planning/terrainPlanner.js";
import { TerrainChunkPlanCache, appendVisibleChunkPlans, emptyTerrainBatches } from "../planning/chunkCache.js";

const source: TerrainSource = {
  voidTerrain: true,
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

  it("does not reuse plans across VOID terrain modes", () => {
    const cache = new TerrainChunkPlanCache();
    const input = { coord: { cx: 0, cy: 0 }, orientation: 0 as const, revision: 1 };
    const enabled = cache.get({ ...input, source: { ...source, voidTerrain: true } });
    const disabled = cache.get({ ...input, source: { ...source, voidTerrain: false } });
    expect(disabled).not.toBe(enabled);
  });

  it("does not reuse plans across inside and outside presentation", () => {
    const cache = new TerrainChunkPlanCache();
    const input = { coord: { cx: 0, cy: 0 }, orientation: 0 as const, revision: 1 };
    const outside = cache.get({ ...input, source });
    const inside = cache.get({
      ...input,
      source: {
        ...source,
        presentationAt: () => ({ mode: "inside", wallRise: 3 }),
      },
    });

    expect(inside).not.toBe(outside);
  });

  it("invalidates seam neighbors when a tile changes", () => {
    const cache = new TerrainChunkPlanCache();
    cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    cache.get({ source, coord: { cx: 1, cy: 0 }, orientation: 0, revision: 1 });
    cache.get({ source, coord: { cx: 4, cy: 4 }, orientation: 0, revision: 1 });
    cache.invalidateTile(CHUNK_SIZE, 2);
    expect(cache.size).toBe(1);
  });

  it("evicts the least recently used plan at its configured capacity", () => {
    const cache = new TerrainChunkPlanCache(2);
    const first = cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 });
    const oldest = cache.get({ source, coord: { cx: 1, cy: 0 }, orientation: 0, revision: 1 });
    expect(cache.get({ source, coord: { cx: 0, cy: 0 }, orientation: 0, revision: 1 })).toBe(first);
    cache.get({ source, coord: { cx: 2, cy: 0 }, orientation: 0, revision: 1 });

    expect(cache.size).toBe(2);
    expect(cache.get({ source, coord: { cx: 1, cy: 0 }, orientation: 0, revision: 1 })).not.toBe(oldest);
  });

  it("submits only geometry inside the requested bounds from intersecting chunks", () => {
    const batches = emptyTerrainBatches();
    appendVisibleChunkPlans({ target: batches, cache: new TerrainChunkPlanCache(), source, bounds: { x: 0, y: 0, width: 1, height: 1 }, orientation: 0, revision: 1 });
    expect(batches.floors).toHaveLength(1);
    expect(batches.floors[0]?.worldTile).toEqual({ x: 0, y: 0 });
  });

  it("omits terrain geometry outside presentation visibility", () => {
    const batches = emptyTerrainBatches();
    const metrics = appendVisibleChunkPlans({
      target: batches,
      cache: new TerrainChunkPlanCache(),
      source,
      bounds: { x: 0, y: 0, width: 4, height: 1 },
      orientation: 0,
      revision: 1,
      visibility: {
        revision: 1,
        isWorldPositionVisible: (x) => x < 2,
      },
    });

    expect(batches.floors.map(({ worldTile }) => worldTile.x)).toEqual([0, 1]);
    expect(metrics).toEqual({ candidateQuads: 4, submittedQuads: 2 });
  });

  it("bounds new chunk planning while retaining immutable cached plans", () => {
    const batches = emptyTerrainBatches();
    const cache = new TerrainChunkPlanCache();
    const pending: string[] = [];
    appendVisibleChunkPlans({
      target: batches,
      cache,
      source,
      bounds: { x: 0, y: 0, width: CHUNK_SIZE * 3, height: 1 },
      orientation: 0,
      revision: 1,
      maxNewPlans: 1,
      onPendingPlan: ({ cx, cy }) => pending.push(`${cx},${cy}`),
    });

    expect(cache.size).toBe(1);
    expect(pending).toEqual(["1,0", "2,0"]);
  });

  it("clips every terrain presentation layer at a chunk seam", () => {
    const batches = emptyTerrainBatches();
    appendVisibleChunkPlans({
      target: batches,
      cache: new TerrainChunkPlanCache(),
      source: {
        ...source,
        heightAt: (x) => x === CHUNK_SIZE - 1 ? 1 : 0,
      },
      bounds: { x: CHUNK_SIZE - 1, y: 0, width: 2, height: 1 },
      orientation: 0,
      revision: 1,
    });

    expect(batches.floors).toHaveLength(2);
    expect(batches.floors.map(({ worldTile }) => worldTile.x)).toEqual([
      CHUNK_SIZE - 1,
      CHUNK_SIZE,
    ]);
    expect(allWorldTilesInside(batches, {
      x: CHUNK_SIZE - 1,
      y: 0,
      width: 2,
      height: 1,
    })).toBe(true);
  });
});

function allWorldTilesInside(
  batches: ReturnType<typeof emptyTerrainBatches>,
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return Object.values(batches).flat().every(({ worldTile }) =>
    worldTile.x >= bounds.x && worldTile.x < bounds.x + bounds.width &&
    worldTile.y >= bounds.y && worldTile.y < bounds.y + bounds.height
  );
}
