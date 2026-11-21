import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { SOLID_TILES, TILE } from "../../core/types.js";
import { generateFiniteFloor } from "../finiteFloor.js";
import { analyzeFloorMovement } from "../finiteFloorMovement.js";
import { disconnectedWalkableCells } from "../connections/validation/finiteFloorRequiredConnectivity.js";

describe("open-world grassy hills, sand, and forest generation", () => {
  it("generates fast rolling hills, sand banks, rivers, bridges, and forest props", () => {
    const floor = generateFiniteFloor({
      worldSeed: hashString("open-forest-world"),
      floor: 1,
      features: { voidTerrain: false },
    });

    const walkableFloor = countWalkable(floor.features, floor.tiles);
    expect(walkableFloor / floor.tiles.length).toBeGreaterThan(0.5);
    expect(hasDistinctHillHeights(floor)).toBe(true);
    expect(hasTerritory(floor, 0)).toBe(true);
    expect(hasTerritory(floor, 1)).toBe(true);
    expect(hasTerritory(floor, 2)).toBe(true);
    expect(countFeature(floor.features, TILE.Water)).toBeGreaterThan(20);
    expect(countFeature(floor.features, TILE.Bridge)).toBeGreaterThan(5);
    expect(countFeature(floor.features, TILE.Tree)).toBeGreaterThan(20);
    expect(countFeature(floor.features, TILE.Bush)).toBeGreaterThan(20);
    expect(countFeature(floor.features, TILE.Boulder)).toBeGreaterThan(5);

    const movement = analyzeFloorMovement({ buffers: floor, spawn: floor.spawn }, floor.bounds);
    const sealedArenas = [...floor.miniBossArenas, ...(floor.bossArena ? [floor.bossArena] : [])];
    expect(disconnectedWalkableCells({
      buffers: floor,
      bounds: floor.bounds,
      reachable: movement.reachable,
      sealedArenas,
    })).toHaveLength(0);
  }, 20_000);
});

function countWalkable(features: Uint8Array, tiles: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === TILE.Floor && !SOLID_TILES.has(features[i] ?? TILE.Floor)) count++;
  }
  return count;
}

function hasDistinctHillHeights(floor: ReturnType<typeof generateFiniteFloor>): boolean {
  const heights = new Set<number>();
  for (let i = 0; i < floor.tiles.length; i++) {
    if (floor.tiles[i] === TILE.Floor) heights.add(floor.height[i] ?? 0);
  }
  return heights.size >= 3 && [...heights].some((height) => height >= 1);
}

function hasTerritory(floor: ReturnType<typeof generateFiniteFloor>, target: number): boolean {
  return floor.territory.some((territory, index) => floor.tiles[index] === TILE.Floor && territory === target);
}

function countFeature(features: Uint8Array, target: number): number {
  let count = 0;
  for (let i = 0; i < features.length; i++) {
    if (features[i] === target) count++;
  }
  return count;
}
