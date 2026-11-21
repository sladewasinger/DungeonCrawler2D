// Public-facade invariants for the default chunk generator (world/generate.ts):
// determinism, flat-first-plus-deliberate-height, fixed-feature placement,
// pocket sealing, and the instanced safe room. Generator-internal invariants
// (BSP layout, districts, avenues, landmarks, chasms) live under generate/.

import { describe, expect, it } from "vitest";
import { hashString } from "../core/rng.js";
import { isSafeRoomChunk, isStairsChunk, KIOSK_HEIGHT } from "./features/fixed/fixed.js";
import {
  accumulateHeightBudget,
  createHeightBudgetStats,
} from "./generate/terrain/tests/heightBudget.test-support.js";
import { generateChunk } from "./generate.js";
import {
  chunkGrid,
  findFirstChunk,
} from "./generate/test-support/chunkCoordinates.js";
import {
  CHUNK_SIZE,
  FEATURE_FACE,
  TERRAIN,
  TILE,
  ZONE,
} from "./core/types.js";

const SEED = hashString("test-world");
const FLOOR = 1;

describe("world generation", () => {
  it("is byte-identical for identical inputs (networking invariant)", () => {
    for (const [cx, cy] of [
      [0, 0],
      [-3, 7],
      [12, -12],
    ] as const) {
      const a = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
      const b = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
      expect(Array.from(a.features)).toEqual(Array.from(b.features));
      expect(Array.from(a.height)).toEqual(Array.from(b.height));
      expect(Array.from(a.zones)).toEqual(Array.from(b.zones));
    }
  }, 30_000);

  it("differs across seeds and floors", () => {
    const a = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: 5, cy: 5 });
    const b = generateChunk({ worldSeed: hashString("other-world"), floor: FLOOR, cx: 5, cy: 5 });
    const c = generateChunk({ worldSeed: SEED, floor: FLOOR + 1, cx: 5, cy: 5 });
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
    expect(Array.from(a.tiles)).not.toContain(1);
    expect(Array.from(a.terrain).every((value) => value === TERRAIN.Floor || value === TERRAIN.Void)).toBe(true);
  }, 30_000);

  it("is flat-first: floor height is 0 or within the pit/dais/chasm/landmark tier budget", () => {
    const stats = createHeightBudgetStats();
    for (const [cx, cy] of chunkGrid(-5, 5)) {
      const worldChunk = { worldSeed: SEED, floor: FLOOR, cx, cy };
      if (isSafeRoomChunk(worldChunk) || isStairsChunk(worldChunk)) continue;
      accumulateHeightBudget(stats, generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy }), true);
    }
    expect(stats.violations, stats.firstViolation).toBe(0);
    expect(stats.plainFloors).toBeGreaterThan(500);
    expect(stats.deliberateFloors).toBeGreaterThan(0);
  }, 15_000);

  it("safe-room chunks contain an entrance portal on a z2 kiosk TERRACE, not an open sanctuary", () => {
    const found = findFirstChunk({
      worldSeed: SEED,
      floor: FLOOR,
      min: -6,
      max: 6,
      predicate: isSafeRoomChunk,
    });
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    let doors = 0; let doorIndex = -1;
    for (let i = 0; i < chunk.features.length; i++) {
      expect(chunk.zones[i]).toBe(ZONE.None);
      if (chunk.features[i] === TILE.DoorSafeRoom) {
        doors++;
        doorIndex = i;
      }
    }
    expect(doors).toBe(1);
    // The kiosk terrace's walkable top platform sits north of the door
    // (KIOSK_HEIGHT, not a flat floor — VISUAL_DIRECTION.md's z+1 rule);
    // ordinary pad ground continues south of it.
    expect(chunk.tiles[doorIndex]).toBe(TILE.Floor);
    expect(chunk.height[doorIndex]).toBe(KIOSK_HEIGHT);
    expect(chunk.featureFaces[doorIndex]).toBe(FEATURE_FACE.South);
    expect(chunk.featureHeight[doorIndex]).toBe(1);
    expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
    expect(chunk.features[doorIndex + CHUNK_SIZE]).toBe(TILE.Stairs);
    expect(chunk.height[doorIndex + CHUNK_SIZE]).toBe(1);
    expect(chunk.height[doorIndex + CHUNK_SIZE * 2]).toBe(0);
  });

  it("stairway chunks contain a cleared landing pad", () => {
    // The pad is a flat-first clearing, never TILE.Stairs: a Stairs tile with no real height
    // delta across its climb axis is the "flavor without height" bug
    // — see fixed.ts.
    const found = findFirstChunk({
      worldSeed: SEED,
      floor: FLOOR,
      min: -6,
      max: 6,
      predicate: isStairsChunk,
    });
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    const clearFloor = Array.from(chunk.tiles).filter((t) => t === TILE.Floor).length;
    expect(clearFloor).toBeGreaterThan(60);
  });

  it("returns an initialized blocked chunk beyond the finite floor", () => {
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: 20, cy: 20 });
    expect(Array.from(chunk.tiles).every((tile) => tile === TILE.Void)).toBe(true);
    expect(Array.from(chunk.terrain).every((terrain) => terrain === TERRAIN.Void)).toBe(true);
    expect(Array.from(chunk.height).every((height) => height === 0)).toBe(true);
  });
});
