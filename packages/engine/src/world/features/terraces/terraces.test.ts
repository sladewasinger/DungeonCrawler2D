import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { hasPlatformCluster } from "../platforms/platforms.js";
import { TERRACE_RISE, hasTerrace, terraceSpec } from "./terraces.js";
import { generatedChunkCenter } from "../../core/terrain.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../../generate/layout/scale.js";
import {
  buildTerraceChunk,
  checkStairEntries,
  countRaisedFloors,
  snapCenter,
  TwoChunkView,
  walkableReachable,
  type WalkBounds,
} from "./terrace-test-support.js";

const SEED = hashString("test-world");
const FLOOR = 1;

function findTerraces(range: number): Array<{ cx: number; cy: number }> {
  const width = range * 2 + 1;
  return Array.from({ length: width ** 2 }, (_, index) => ({ cx: index % width - range, cy: Math.floor(index / width) - range }))
    .filter((chunk) => hasTerrace({ worldSeed: SEED, floor: FLOOR, ...chunk }));
}

describe("raised sections (terraces)", () => {
  it("appear at a meaningful rate and never share a chunk with platform clusters", () => {
    const terraces = findTerraces(6); // 13×13 chunks
    expect(terraces.length).toBeGreaterThan(8);
    for (const chunk of terraces) {
      expect(hasPlatformCluster({ worldSeed: SEED, floor: FLOOR, ...chunk })).toBe(false);
    }
  });

  it("raises a hard-edged district one level, with stair entries only on the corridor", () => {
    const first = findTerraces(6)[0];
    if (!first) throw new Error("no terrace found in scan range");
    const { cx, cy } = first;
    const chunk = { worldSeed: SEED, floor: FLOOR, cx, cy };
    const spec = terraceSpec(chunk);
    if (!spec) throw new Error("terraceSpec returned null for a hasTerrace chunk");
    const { tiles, height } = buildTerraceChunk(chunk);

    const raisedFloors = countRaisedFloors(tiles, height, spec);
    expect(raisedFloors).toBeGreaterThan(40);

    // Entry steps: one tile OUTSIDE the boundary (the rect's outline
    // stays unbroken; the staircase object leans against it) — and
    // NEVER on the north side (no north→south-climbing staircase
    // exists in the pack; north edges are drop-off ledges).
    const { stairs, linked } = checkStairEntries(tiles, height, spec);
    expect(stairs).toBeGreaterThanOrEqual(2); // the corridor enters and leaves
    expect(linked).toBeGreaterThanOrEqual(1); // at least one true entry step
  });

  it("the junction atop the section is reachable on foot from the neighbor chunk", () => {
    const first = findTerraces(6)[0];
    if (!first) throw new Error("no terrace found in scan range");
    const { cx, cy } = first;
    const world = new TwoChunkView(SEED, FLOOR, [
      [cx - 1, cy],
      [cx, cy],
    ]);
    const start = snapCenter(world, generatedChunkCenter(SEED, FLOOR, cx - 1, cy));
    const target = snapCenter(world, generatedChunkCenter(SEED, FLOOR, cx, cy));
    // The junction sits inside the terrace, so this walk must climb it.
    expect(world.heightAt(target.x, target.y)).toBeGreaterThanOrEqual(TERRACE_RISE - 0.01);

    const bounds: WalkBounds = {
      minX: (cx - 1) * CHUNK_SIZE,
      maxX: (cx + 1) * CHUNK_SIZE + CHUNK_SIZE - 1,
      minY: (cy - 1) * CHUNK_SIZE,
      maxY: (cy + 1) * CHUNK_SIZE + CHUNK_SIZE - 1,
    };
    const reached = walkableReachable(world, start, bounds);
    expect(reached.has(`${target.x},${target.y}`)).toBe(true);
  });
});
