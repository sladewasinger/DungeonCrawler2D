// Unit coverage for descent.ts's pure chunk/position selection: exactly one
// chunk per role per floor, StairwayUp/StairwayDown never sharing a chunk,
// and the floor-range gates (no StairwayUp on floor 1, no StairwayDown on
// FLOOR_CAP). Reachability and the mouth-notch geometry are covered against
// real generated chunks in generate/descentInvariant.test.ts.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../../core/types.js";
import {
  FLOOR_CAP,
  isStairwayDownChunk,
  isStairwayUpChunk,
  stairwayDownChunk,
  stairwayDownPosition,
  stairwayUpChunk,
  stairwayUpPosition,
} from "./descent.js";

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 13);

function world(seed: number, floor: number, location = { cx: 0, cy: 0 }) {
  return { worldSeed: seed, floor, ...location };
}

function stairwayPairs(): Array<{ seed: number; floor: number; up: { cx: number; cy: number }; down: { cx: number; cy: number } }> {
  return SEEDS.flatMap((seed) => Array.from({ length: FLOOR_CAP - 2 }, (_, index) => ({ seed, floor: index + 2 })))
    .map(({ seed, floor }) => ({ seed, floor, up: stairwayUpChunk(world(seed, floor)), down: stairwayDownChunk(world(seed, floor)) }))
    .filter((pair): pair is { seed: number; floor: number; up: { cx: number; cy: number }; down: { cx: number; cy: number } } => pair.up !== null && pair.down !== null);
}

describe("stairway chunk selection", () => {
  it("StairwayDown exists on floors 1..FLOOR_CAP-1, never on FLOOR_CAP or below floor 1", () => {
    for (const seed of SEEDS) {
      expect(stairwayDownChunk(world(seed, 0))).toBeNull();
      for (let floor = 1; floor < FLOOR_CAP; floor++) expect(stairwayDownChunk(world(seed, floor))).not.toBeNull();
      expect(stairwayDownChunk(world(seed, FLOOR_CAP))).toBeNull();
    }
  });

  it("StairwayUp exists on floors 2..FLOOR_CAP, never on floor 1", () => {
    for (const seed of SEEDS) {
      expect(stairwayUpChunk(world(seed, 1))).toBeNull();
      for (let floor = 2; floor <= FLOOR_CAP; floor++) expect(stairwayUpChunk(world(seed, floor))).not.toBeNull();
    }
  });

  it("StairwayUp and StairwayDown never resolve to the same chunk on a floor hosting both", () => {
    const pairs = stairwayPairs();
    for (const { seed, floor, up, down } of pairs) {
      expect(up.cx === down.cx && up.cy === down.cy, `seed ${seed} floor ${floor}: up/down share a chunk`).toBe(false);
    }
    expect(pairs.length).toBeGreaterThan(50);
  });

  it("isStairwayUpChunk/isStairwayDownChunk agree with the chunk getters, and only that one chunk", () => {
    const seed = SEEDS[0] as number;
    const floor = 3;
    const down = stairwayDownChunk(world(seed, floor));
    const up = stairwayUpChunk(world(seed, floor));
    expect(down).not.toBeNull();
    expect(up).not.toBeNull();
    if (!down || !up) return;
    expect(isStairwayDownChunk(world(seed, floor, down))).toBe(true);
    expect(isStairwayDownChunk(world(seed, floor, { cx: down.cx + 1, cy: down.cy }))).toBe(false);
    expect(isStairwayUpChunk(world(seed, floor, up))).toBe(true);
    expect(isStairwayUpChunk(world(seed, floor, { cx: up.cx + 1, cy: up.cy }))).toBe(false);
  });

  it("position functions return null exactly where the chunk getters do, and a point inside that chunk otherwise", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const positionWorld = { worldSeed: seed, floor: FLOOR_CAP };
      expect(stairwayDownPosition(positionWorld)).toBeNull(); // FLOOR_CAP has the arena instead
      const up = stairwayUpPosition(positionWorld);
      const chunk = stairwayUpChunk(world(seed, FLOOR_CAP));
      expect(chunk).not.toBeNull();
      expect(up).not.toBeNull();
      if (!up || !chunk) continue;
      expect(Math.floor(up.x / CHUNK_SIZE)).toBe(chunk.cx);
      expect(Math.floor(up.y / CHUNK_SIZE)).toBe(chunk.cy);
    }
  });
});
