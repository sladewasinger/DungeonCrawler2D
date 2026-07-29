// Unit coverage for descent.ts's pure chunk/position selection: exactly one
// chunk per role per floor, StairwayUp/StairwayDown never sharing a chunk,
// and the floor-range gates (no StairwayUp on floor 1, no StairwayDown on
// FLOOR_CAP). Reachability and the mouth-notch geometry are covered against
// real generated chunks in generate/descentInvariant.test.ts.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../../core/types.js";
import {
  FLOOR_CAP,
  stairwayDownChunk,
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

  it("places the floor-cap up-stair position inside its selected chunk", () => {
    const seed = SEEDS[0] as number;
    const up = stairwayUpPosition(world(seed, FLOOR_CAP));
    const chunk = stairwayUpChunk(world(seed, FLOOR_CAP));
    expect(up).not.toBeNull();
    expect(chunk).not.toBeNull();
    if (!up || !chunk) return;
    expect(Math.floor(up.x / CHUNK_SIZE)).toBe(chunk.cx);
    expect(Math.floor(up.y / CHUNK_SIZE)).toBe(chunk.cy);
  });
});
