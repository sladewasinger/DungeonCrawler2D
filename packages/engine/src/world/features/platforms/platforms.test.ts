import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, STEP_UP } from "../../../core/constants.js";
import { hashString } from "../../../core/rng.js";
import { PLATFORM_TIER_STEP, applyPlatformCluster, hasPlatformCluster, platformLootSpots } from "./platforms.js";
import {
  CORRIDOR_HALF_WIDTH,
  baseSample,
  corridorSegments,
  distToCorridor,
  generatedChunkCenter,
  seedsFor,
} from "../../core/terrain.js";
import { TILE, TOPOLOGY } from "../../core/types.js";
import {
  GENERATION_CHUNK_SIZE as CHUNK_SIZE,
  WORLD_GEOMETRY_SCALE,
} from "../../generate/layout/scale.js";

const SEED = hashString("test-world");
const FLOOR = 1;
type ChunkPosition = { cx: number; cy: number };
type ClusterChunk = { tiles: Uint8Array; height: Float32Array };

function squareCoordinates(range: number): ChunkPosition[] {
  return Array.from({ length: (range * 2 + 1) ** 2 }, (_, index) => ({
    cx: index % (range * 2 + 1) - range,
    cy: Math.floor(index / (range * 2 + 1)) - range,
  }));
}

function findClusterChunks(range: number): ChunkPosition[] {
  return squareCoordinates(range).filter((chunk) => hasPlatformCluster({ worldSeed: SEED, floor: FLOOR, ...chunk }));
}

/**
 * A chunk-local base layout (the same flat-first baseSample sampling the
 * generators run) with the platform cluster applied on top — exercises
 * platforms.ts directly, independent of which generator is wired in as
 * the engine's default (see world/generate/index.ts).
 */
function buildClusterChunk({ cx, cy }: ChunkPosition): ClusterChunk {
  const seeds = seedsFor(SEED, FLOOR);
  const segs = corridorSegments(SEED, FLOOR, cx, cy);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let index = 0; index < tiles.length; index++) {
    const lx = index % CHUNK_SIZE;
    const ly = Math.floor(index / CHUNK_SIZE);
    const sample = baseSample(seeds, segs, baseX + lx, baseY + ly);
    tiles[index] = sample.wall ? TOPOLOGY.Uncarved : TILE.Floor;
    height[index] = sample.height;
  }
  applyPlatformCluster({ chunk: { worldSeed: SEED, floor: FLOOR, cx, cy }, seeds, segs, tiles, height });
  return { tiles, height };
}

function localSpot(spot: { x: number; y: number }, chunk: ChunkPosition): { x: number; y: number } {
  return {
    x: Math.floor(spot.x / WORLD_GEOMETRY_SCALE) - chunk.cx * CHUNK_SIZE,
    y: Math.floor(spot.y / WORLD_GEOMETRY_SCALE) - chunk.cy * CHUNK_SIZE,
  };
}

function heightsAround(height: Float32Array, center: { x: number; y: number }): number[] {
  return Array.from({ length: 81 }, (_, index) => {
    const x = center.x + index % 9 - 4;
    const y = center.y + Math.floor(index / 9) - 4;
    return x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE ? 0 : (height[y * CHUNK_SIZE + x] ?? 0);
  });
}

function assertJumpableLootSpot(input: { height: Float32Array; spot: { x: number; y: number }; chunk: ChunkPosition }): void {
  const center = localSpot(input.spot, input.chunk);
  const top = input.height[center.y * CHUNK_SIZE + center.x] ?? 0;
  const heights = heightsAround(input.height, center);
  expect(top - Math.min(...heights)).toBeGreaterThanOrEqual(PLATFORM_TIER_STEP - 1e-6);
  expect(heights.some((height) => Math.abs(top - PLATFORM_TIER_STEP - height) < 0.11)).toBe(true);
}

function corridorHeightIsSmooth(height: Float32Array, chunk: ChunkPosition): void {
  const segs = corridorSegments(SEED, FLOOR, chunk.cx, chunk.cy);
  const center = generatedChunkCenter(SEED, FLOOR, chunk.cx, chunk.cy);
  for (let t = -CHUNK_SIZE / 2; t <= CHUNK_SIZE / 2; t += 2) {
    const wx = Math.round(center.x) + t;
    const wy = Math.round(center.y);
    if (distToCorridor(segs, wx, wy) <= CORRIDOR_HALF_WIDTH) assertCorridorHeight({ height, chunk, wx, wy });
  }
}

function assertCorridorHeight(input: { height: Float32Array; chunk: ChunkPosition; wx: number; wy: number }): void {
  const { height, chunk, wx, wy } = input;
  const lx = wx - chunk.cx * CHUNK_SIZE;
  const ly = wy - chunk.cy * CHUNK_SIZE;
  if (lx < 1 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) return;
  const current = height[ly * CHUNK_SIZE + lx] ?? 0;
  const west = height[ly * CHUNK_SIZE + lx - 1] ?? 0;
  expect(Math.abs(current - west)).toBeLessThanOrEqual(PLATFORM_TIER_STEP);
}

describe("ruin platform clusters", () => {
  it("appear at a meaningful rate", () => {
    const clusters = findClusterChunks(6); // 13×13 chunks
    expect(clusters.length).toBeGreaterThan(10);
  });

  it("tiers rise in jump-clearable steps (physics invariant)", () => {
    // Jump apex must clear one tier, and one tier must exceed STEP_UP —
    // platforms are for jumping, not walking.
    const apex = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(apex).toBeGreaterThan(PLATFORM_TIER_STEP);
    expect(PLATFORM_TIER_STEP).toBeGreaterThan(STEP_UP);
  });

  it("loot spots sit on tops that rise a jumpable +2 from nearby ground", () => {
    let checked = 0;
    for (const chunk of findClusterChunks(6)) {
      const { height } = buildClusterChunk(chunk);
      for (const spot of platformLootSpots({ worldSeed: SEED, floor: FLOOR, ...chunk })) {
        assertJumpableLootSpot({ height, spot, chunk });
        checked++;
      }
      if (checked > 8) break;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("never raises the corridor itself (connectivity guarantee)", () => {
    const chunks = findClusterChunks(4);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const { height } = buildClusterChunk(chunk);
      corridorHeightIsSmooth(height, chunk);
    }
  });
});
