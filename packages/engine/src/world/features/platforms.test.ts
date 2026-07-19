import { describe, expect, it } from "vitest";
import { GRAVITY, JUMP_VELOCITY, STEP_UP } from "../../core/constants.js";
import { hashString } from "../../core/rng.js";
import { PLATFORM_TIER_STEP, applyPlatformCluster, hasPlatformCluster, platformLootSpots } from "./platforms.js";
import { CORRIDOR_HALF_WIDTH, baseSample, chunkCenter, corridorSegments, distToCorridor, seedsFor } from "../terrain.js";
import { CHUNK_SIZE, TILE } from "../types.js";

const SEED = hashString("test-world");
const FLOOR = 1;

function findClusterChunks(range: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cy = -range; cy <= range; cy++) {
    for (let cx = -range; cx <= range; cx++) {
      if (hasPlatformCluster(SEED, FLOOR, cx, cy)) out.push([cx, cy]);
    }
  }
  return out;
}

/**
 * A chunk-local base layout (the same flat-first baseSample sampling the
 * generators run) with the platform cluster applied on top — exercises
 * platforms.ts directly, independent of which generator is wired in as
 * the engine's default (see world/generate/index.ts).
 */
function buildClusterChunk(cx: number, cy: number): { tiles: Uint8Array; height: Float32Array } {
  const seeds = seedsFor(SEED, FLOOR);
  const segs = corridorSegments(SEED, FLOOR, cx, cy);
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  const height = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const sample = baseSample(seeds, segs, baseX + lx, baseY + ly);
      tiles[ly * CHUNK_SIZE + lx] = sample.wall ? TILE.Wall : TILE.Floor;
      height[ly * CHUNK_SIZE + lx] = sample.height;
    }
  }
  applyPlatformCluster(SEED, FLOOR, cx, cy, seeds, segs, tiles, height);
  return { tiles, height };
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
    for (const [cx, cy] of findClusterChunks(6)) {
      const { height } = buildClusterChunk(cx, cy);
      for (const spot of platformLootSpots(SEED, FLOOR, cx, cy)) {
        assertJumpableLootSpot(height, spot, cx, cy);
        checked++;
      }
      if (checked > 8) break;
    }
    expect(checked).toBeGreaterThan(4);
  });

  it("never raises the corridor itself (connectivity guarantee)", () => {
    for (const [cx, cy] of findClusterChunks(4)) {
      const { height } = buildClusterChunk(cx, cy);
      const segs = corridorSegments(SEED, FLOOR, cx, cy);
      const center = chunkCenter(SEED, FLOOR, cx, cy);
      // Sample along the corridor through this chunk: tiles on the
      // centerline must not carry mesa rises (they may still slope with
      // the base terrain ramps).
      for (let t = -CHUNK_SIZE / 2; t <= CHUNK_SIZE / 2; t += 2) {
        const wx = Math.round(center.x) + t;
        const wy = Math.round(center.y);
        if (distToCorridor(segs, wx, wy) > CORRIDOR_HALF_WIDTH) continue;
        const lx = wx - cx * CHUNK_SIZE;
        const ly = wy - cy * CHUNK_SIZE;
        if (lx < 1 || ly < 0 || lx >= CHUNK_SIZE || ly >= CHUNK_SIZE) continue;
        const h = height[ly * CHUNK_SIZE + lx] ?? 0;
        const west = height[ly * CHUNK_SIZE + (lx - 1)] ?? 0;
        // A mesa edge on the corridor would be a sudden +2 wall.
        expect(Math.abs(h - west)).toBeLessThanOrEqual(PLATFORM_TIER_STEP);
      }
    }
  });
});

/**
 * The top must be a real platform (something lower to jump from) AND a
 * stage exactly one jumpable tier below must sit within hop distance —
 * the climb works stage by stage.
 */
function assertJumpableLootSpot(
  height: Float32Array,
  spot: { x: number; y: number },
  cx: number,
  cy: number,
): void {
  const sx = Math.floor(spot.x) - cx * CHUNK_SIZE;
  const sy = Math.floor(spot.y) - cy * CHUNK_SIZE;
  const top = height[sy * CHUNK_SIZE + sx] ?? 0;
  let lowest = Infinity;
  let hasStage = false;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const nx = sx + dx;
      const ny = sy + dy;
      if (nx < 0 || ny < 0 || nx >= CHUNK_SIZE || ny >= CHUNK_SIZE) continue;
      const nh = height[ny * CHUNK_SIZE + nx] ?? 0;
      lowest = Math.min(lowest, nh);
      if (Math.abs(top - PLATFORM_TIER_STEP - nh) < 0.11) hasStage = true;
    }
  }
  expect(top - lowest).toBeGreaterThanOrEqual(PLATFORM_TIER_STEP - 1e-6);
  expect(hasStage).toBe(true);
}
