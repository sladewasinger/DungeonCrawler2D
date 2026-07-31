import { TILE, World, hashString } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  cachedMinimapTerrain,
  MINIMAP_RANGE_TILES,
} from "./minimapTerrainCache.js";

describe("cached minimap terrain", () => {
  it("refreshes an empty sample after matching terrain chunks load", () => {
    const world = new World(hashString("uncached-minimap-terrain"), 1);

    const empty = cachedMinimapTerrain(world, 0.5, 0.5);

    expect(world.cachedChunkCount).toBe(0);
    expect(empty).toEqual([]);

    loadTerrainAroundOrigin(world);
    const chunkCount = world.cachedChunkCount;
    const loaded = cachedMinimapTerrain(world, 0.5, 0.5);
    const reused = cachedMinimapTerrain(world, 0.5, 0.5);

    expect(world.cachedChunkCount).toBe(chunkCount);
    expect(loaded).toHaveLength(minimapCircleTileCount());
    expect(loaded.every((tile) => isWithinMinimapCircle(tile))).toBe(true);
    expect(loaded).not.toBe(empty);
    expect(reused).toBe(loaded);
  });

  it("refreshes cached terrain when tile overrides change", () => {
    const world = new World(hashString("loaded-minimap-terrain"), 1);
    loadTerrainAroundOrigin(world);
    const chunkCount = world.cachedChunkCount;

    const first = cachedMinimapTerrain(world, 0.5, 0.5);
    world.replaceTileOverrides([{ x: 0, y: 0, tile: TILE.Floor }]);
    const refreshed = cachedMinimapTerrain(world, 0.5, 0.5);

    expect(world.cachedChunkCount).toBe(chunkCount);
    expect(refreshed).not.toBe(first);
    expect(cachedMinimapTerrain(world, 0.9, 0.9)).toBe(refreshed);
  });
});

function loadTerrainAroundOrigin(world: World): void {
  world.heightAt(-1, -1);
  world.heightAt(-1, 0);
  world.heightAt(0, -1);
  world.heightAt(0, 0);
}

function minimapCircleTileCount(): number {
  let count = 0;
  for (let y = -MINIMAP_RANGE_TILES; y <= MINIMAP_RANGE_TILES; y += 1) {
    for (let x = -MINIMAP_RANGE_TILES; x <= MINIMAP_RANGE_TILES; x += 1) {
      if (isWithinMinimapCircle({ x, y })) count += 1;
    }
  }
  return count;
}

function isWithinMinimapCircle(point: { x: number; y: number }): boolean {
  return point.x ** 2 + point.y ** 2 <= MINIMAP_RANGE_TILES ** 2;
}
