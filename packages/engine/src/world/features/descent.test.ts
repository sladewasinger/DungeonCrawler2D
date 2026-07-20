// Unit coverage for descent.ts's pure chunk/position selection: exactly one
// chunk per role per floor, StairwayUp/StairwayDown never sharing a chunk,
// and the floor-range gates (no StairwayUp on floor 1, no StairwayDown on
// FLOOR_CAP). Reachability and the mouth-notch geometry are covered against
// real generated chunks in generate/descentInvariant.test.ts.
import { describe, expect, it } from "vitest";
import { CHUNK_SIZE } from "../types.js";
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

describe("stairway chunk selection", () => {
  it("StairwayDown exists on floors 1..FLOOR_CAP-1, never on FLOOR_CAP or below floor 1", () => {
    for (const seed of SEEDS) {
      expect(stairwayDownChunk(seed, 0)).toBeNull();
      for (let floor = 1; floor < FLOOR_CAP; floor++) expect(stairwayDownChunk(seed, floor)).not.toBeNull();
      expect(stairwayDownChunk(seed, FLOOR_CAP)).toBeNull();
    }
  });

  it("StairwayUp exists on floors 2..FLOOR_CAP, never on floor 1", () => {
    for (const seed of SEEDS) {
      expect(stairwayUpChunk(seed, 1)).toBeNull();
      for (let floor = 2; floor <= FLOOR_CAP; floor++) expect(stairwayUpChunk(seed, floor)).not.toBeNull();
    }
  });

  it("StairwayUp and StairwayDown never resolve to the same chunk on a floor hosting both", () => {
    let checked = 0;
    for (const seed of SEEDS) {
      for (let floor = 2; floor < FLOOR_CAP; floor++) {
        const up = stairwayUpChunk(seed, floor);
        const down = stairwayDownChunk(seed, floor);
        expect(up).not.toBeNull();
        expect(down).not.toBeNull();
        if (!up || !down) continue;
        expect(up.cx === down.cx && up.cy === down.cy, `seed ${seed} floor ${floor}: up/down share a chunk`).toBe(
          false,
        );
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("isStairwayUpChunk/isStairwayDownChunk agree with the chunk getters, and only that one chunk", () => {
    const seed = SEEDS[0] as number;
    const floor = 3;
    const down = stairwayDownChunk(seed, floor);
    const up = stairwayUpChunk(seed, floor);
    expect(down).not.toBeNull();
    expect(up).not.toBeNull();
    if (!down || !up) return;
    expect(isStairwayDownChunk(seed, floor, down.cx, down.cy)).toBe(true);
    expect(isStairwayDownChunk(seed, floor, down.cx + 1, down.cy)).toBe(false);
    expect(isStairwayUpChunk(seed, floor, up.cx, up.cy)).toBe(true);
    expect(isStairwayUpChunk(seed, floor, up.cx + 1, up.cy)).toBe(false);
  });

  it("position functions return null exactly where the chunk getters do, and a point inside that chunk otherwise", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const world = { worldSeed: seed, floor: FLOOR_CAP };
      expect(stairwayDownPosition(world)).toBeNull(); // FLOOR_CAP has the arena instead
      const up = stairwayUpPosition(world);
      const chunk = stairwayUpChunk(seed, FLOOR_CAP);
      expect(chunk).not.toBeNull();
      expect(up).not.toBeNull();
      if (!up || !chunk) continue;
      expect(Math.floor(up.x / CHUNK_SIZE)).toBe(chunk.cx);
      expect(Math.floor(up.y / CHUNK_SIZE)).toBe(chunk.cy);
    }
  });
});
