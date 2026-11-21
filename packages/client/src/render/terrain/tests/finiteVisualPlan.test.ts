import { BIOME } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { groupCliffRimParts } from "../overlay/cliffRimParts.js";
import { TerrainChunkPlanCache } from "../planning/chunkCache.js";
import { planTerrain, TERRAIN_KINDS, type TerrainSource } from "../planning/terrainPlanner.js";
import { atlasDraws } from "../batch/atlasBatch.js";
import { territoryWallRole } from "../planning/tileset.js";
import type { TerrainScreenProjection } from "../batch/quadBatch.js";

const VOID_WALL_FACE = "void-wall-face";
const projection: TerrainScreenProjection = {
  project: ({ x, y, z }) => ({ x: x * 10, y: y * 10 - z * 5 }),
};

describe("finite terrain visual plan", () => {
  it("retains bedrock caps, wall faces, and cliff rims after directional reload", () => {
    const source = finiteWallSource();
    const cache = new TerrainChunkPlanCache();
    const input = { source, orientation: 0 as const, revision: 1 };

    cache.get({ ...input, coord: { cx: 0, cy: -1 } });
    cache.get({ ...input, coord: { cx: 0, cy: 1 } });
    cache.get({ ...input, coord: { cx: 1, cy: 0 } });
    const plan = cache.get({ ...input, coord: { cx: 0, cy: 0 } });
    const cap = plan.batches.floors.find(({ worldTile }) =>
      worldTile.x === 1 && worldTile.y === 1);

    expect(cap).toMatchObject({ surface: "bedrock", height: 2 });
    expect(plan.batches.southFaces).toContainEqual(
      expect.objectContaining({ worldTile: { x: 1, y: 1 }, topHeight: 2 }),
    );
    expect(plan.batches.cliffEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ worldTile: { x: 1, y: 1 }, voidBoundary: false }),
    ]));

    const draws = atlasDraws(plan.batches, {
      projection,
      biomeAt: () => BIOME.Pools,
      debug: false,
    });
    expect(draws.some(({ role }) => role === "bedrock")).toBe(true);
    expect(draws.some(({ role }) => role === VOID_WALL_FACE)).toBe(true);
    expect(groupCliffRimParts(plan.batches.cliffEdges).size).toBeGreaterThan(0);
  });

  it("emits a white finite-boundary rim when server VOID terrain is disabled", () => {
    const source: TerrainSource = {
      voidTerrain: false,
      finiteBounds: { x: 0, y: 0, width: 1, height: 1 },
      isInBoundsAt: (x, y) => x === 0 && y === 0,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: () => 0,
    };
    const plan = planTerrain(source, {
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      orientation: 0,
    });

    expect(plan.batches.cliffEdges.length).toBeGreaterThan(0);
    expect(plan.batches.cliffEdges[0]).toMatchObject({
      voidBoundary: true,
    });
    expect(groupCliffRimParts(plan.batches.cliffEdges).size).toBeGreaterThan(0);
  });

  it("keeps finite edges authoritative when a legacy room exception overlaps them", () => {
    const source: TerrainSource = {
      voidTerrain: false,
      finiteBounds: { x: 0, y: 0, width: 2, height: 2 },
      isInBoundsAt: (x, y) => x >= 0 && x < 2 && y >= 0 && y < 2 || y >= 0,
      terrainAt: () => TERRAIN_KINDS.Floor,
      heightAt: () => 0,
    };
    const plan = planTerrain(source, {
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      orientation: 0,
    });

    expect(plan.batches.cliffEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ sides: expect.arrayContaining(["north"]) }),
      expect.objectContaining({ sides: expect.arrayContaining(["west"]) }),
    ]));
  });

  it.each([0, 1])("keeps bedrock and territory wall roles distinct after plan reload %i", (territory) => {
    const source = finiteWallSource();
    const plan = planTerrain(source, {
      bounds: { x: 0, y: 0, width: 2, height: 2 },
      orientation: 0,
    });
    const draws = atlasDraws(plan.batches, {
      projection,
      biomeAt: () => BIOME.Pools,
      territoryAt: () => territory,
      debug: false,
    });
    const bedrock = draws.find(({ role, worldTile }) =>
      role === "bedrock" && worldTile?.x === 1 && worldTile.y === 1);
    const wall = draws.find(({ role, phase }) => phase === 2 && role === VOID_WALL_FACE);

    expect(bedrock?.role).toBe("bedrock");
    expect(wall?.role).toBe(VOID_WALL_FACE);
    expect(wall?.role).not.toBe(territoryWallRole(territory));
  });
});

function finiteWallSource(): TerrainSource {
  return {
    voidTerrain: false,
    finiteBounds: { x: 0, y: 0, width: 32, height: 32 },
    cacheIdentity: "finite-visual-regression",
    terrainAt: () => TERRAIN_KINDS.Floor,
    surfaceAt: (x, y) => x === 1 && y === 1 ? "bedrock" : "floor",
    heightAt: (x, y) => x === 1 && y === 1 ? 2 : 0,
  };
}
