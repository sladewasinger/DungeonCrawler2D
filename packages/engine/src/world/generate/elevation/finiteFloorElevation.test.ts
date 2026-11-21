import { describe, expect, it } from "vitest";
import { TILE } from "../../core/types.js";
import { carveAt, createFloorBuffers, localIndex } from "../finiteFloorBuffers.js";
import { applyElevationTransitions } from "../finiteFloorElevation.js";
import { generateFiniteFloor } from "../finiteFloor.js";
import { analyzeFloorMovement } from "../finiteFloorMovement.js";
import { FLOOR_SEMANTIC, type FloorBounds, type GeneratedFloor } from "../finiteFloorTypes.js";

describe("finite floor elevation", () => {
  it("forms coherent below-zero bands around authored surfaces", () => {
    const bounds = testBounds();
    const buffers = createFloorBuffers(bounds);
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const semantic = x === 0 ? FLOOR_SEMANTIC.SpawnExterior : FLOOR_SEMANTIC.Corridor;
      carveAt({ buffers, bounds, point: { x, y: 0 }, semantic, regionId: 1 });
    }

    applyElevationTransitions({
      buffers, bounds, safeRooms: [], stairways: { down: [], up: null }, miniBossArenas: [],
      elevationStep: 1, minimumElevation: -2, maximumElevation: 0,
    });

    expect(heightAt(bounds, buffers.height, 0)).toBe(0);
    expect(heightAt(bounds, buffers.height, -8)).toBe(-1);
    expect(heightAt(bounds, buffers.height, -16)).toBe(-2);
    expect(heightAt(bounds, buffers.height, 8)).toBe(-1);
    expect(heightAt(bounds, buffers.height, 16)).toBe(-2);
    for (let x = bounds.minX; x < bounds.maxX; x++) {
      expect(Math.abs(heightAt(bounds, buffers.height, x + 1) - heightAt(bounds, buffers.height, x))).toBeLessThanOrEqual(1);
    }
    expect(buffers.features.every((feature) => feature === TILE.Floor)).toBe(true);
  });

  it("generates deterministic bounded below-zero playable terrain", () => {
    const request = { worldSeed: 74621, floor: 1, features: { voidTerrain: false } };
    const floor = generateFiniteFloor(request);
    const repeated = generateFiniteFloor(request);
    const bounded = generateFiniteFloor({ ...request, config: { minimumElevation: -1 } });
    const loweredCeiling = generateFiniteFloor({ ...request, config: { maximumElevation: -1 } });
    const clampedCeiling = generateFiniteFloor({ ...request, config: { maximumElevation: 4 } });
    const ordinaryHeights = heightsOfOrdinaryTerrain(floor);
    const boundedHeights = heightsOfOrdinaryTerrain(bounded);
    const loweredCeilingHeights = heightsOfOrdinaryTerrain(loweredCeiling);

    expect(ordinaryHeights).toContain(-2);
    expect(boundedHeights.reduce((minimum, height) => Math.min(minimum, height), Infinity)).toBe(-1);
    expect(loweredCeilingHeights.reduce((maximum, height) => Math.max(maximum, height), -Infinity)).toBe(0);
    expect(loweredCeilingHeights).toContain(-1);
    expect(floor.identity.fingerprint).toBe(repeated.identity.fingerprint);
    expect(floor.height).toEqual(repeated.height);
    expect(floor.identity.configurationFingerprint).not.toBe(bounded.identity.configurationFingerprint);
    expect(floor.identity.fingerprint).not.toBe(bounded.identity.fingerprint);
    expect(floor.identity.configurationFingerprint).not.toBe(loweredCeiling.identity.configurationFingerprint);
    expect(floor.identity.fingerprint).not.toBe(loweredCeiling.identity.fingerprint);
    expect(clampedCeiling.configuration.maximumElevation).toBe(0);
    expect(clampedCeiling.height).toEqual(floor.height);
    expect(clampedCeiling.identity.configurationFingerprint).toBe(floor.identity.configurationFingerprint);
    expect(clampedCeiling.identity.fingerprint).toBe(floor.identity.fingerprint);
    expect(analyzeFloorMovement({ buffers: floor, spawn: floor.spawn }, floor.bounds).failures).toEqual([]);
    expect(analyzeFloorMovement({ buffers: loweredCeiling, spawn: loweredCeiling.spawn }, loweredCeiling.bounds).failures).toEqual([]);
  }, 30_000);
});

function testBounds(): FloorBounds {
  return {
    minX: -16, minY: 0, width: 33, height: 1, maxX: 16, maxY: 0,
    minChunkX: -1, minChunkY: 0, maxChunkX: 0, maxChunkY: 0,
  };
}

function heightAt(bounds: FloorBounds, height: Float32Array, x: number): number {
  return height[localIndex({ bounds, x, y: 0 })] ?? 0;
}

function heightsOfOrdinaryTerrain(floor: GeneratedFloor): number[] {
  const heights: number[] = [];
  for (let index = 0; index < floor.height.length; index++) {
    const semantic = floor.semantic[index];
    if (floor.features[index] === TILE.Floor && (semantic === FLOOR_SEMANTIC.Corridor
      || semantic === FLOOR_SEMANTIC.Room
      || semantic === FLOOR_SEMANTIC.Transition)) heights.push(floor.height[index] ?? 0);
  }
  return heights;
}
