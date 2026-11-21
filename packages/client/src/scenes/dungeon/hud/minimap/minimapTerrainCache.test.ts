import { TILE, spawnRoomSpawn } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  authoredTerrainWorldFixture,
  finiteTerrainWorldFixture,
} from "../../../../testing/terrainWorldFixture.js";
import {
  cachedMinimapTerrain,
  MINIMAP_RANGE_TILES,
} from "./minimapTerrainCache.js";

describe("cached minimap terrain", () => {
  it("reads finite terrain and height directly without materializing chunks", () => {
    const { world, spawn } = finiteTerrainWorldFixture();

    const terrain = cachedMinimapTerrain(world, spawn.x, spawn.y);

    expect(world.cachedChunkCount).toBe(0);
    expect(terrain).toHaveLength(minimapCircleTileCount());
    expect(terrain.every((tile) => isWithinMinimapCircle({
      x: tile.x - Math.floor(spawn.x),
      y: tile.y - Math.floor(spawn.y),
    }))).toBe(true);
    expect(terrain.every((tile) => Number.isFinite(tile.height))).toBe(true);
    expect(cachedMinimapTerrain(world, spawn.x, spawn.y)).toBe(terrain);
  });

  it("refreshes cached terrain when tile overrides change", () => {
    const { world, spawn } = finiteTerrainWorldFixture();
    const chunkCount = world.cachedChunkCount;
    const tileX = Math.floor(spawn.x);
    const tileY = Math.floor(spawn.y);

    const first = cachedMinimapTerrain(world, spawn.x, spawn.y);
    world.replaceTileOverrides([{ x: tileX, y: tileY, tile: TILE.Floor }]);
    const refreshed = cachedMinimapTerrain(world, spawn.x, spawn.y);

    expect(world.cachedChunkCount).toBe(chunkCount);
    expect(refreshed).not.toBe(first);
    expect(cachedMinimapTerrain(world, tileX + 0.9, tileY + 0.9)).toBe(refreshed);
  });

  it("admits only the visible authored room chunks for a room minimap", () => {
    const world = authoredTerrainWorldFixture();
    const spawn = spawnRoomSpawn(0);

    const terrain = cachedMinimapTerrain(world, spawn.x, spawn.y);

    expect(terrain.length).toBeGreaterThan(0);
    expect(world.cachedChunkCount).toBeLessThanOrEqual(16);
    expect(world.cachedChunkCount).toBeGreaterThan(0);
  });
});

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
