// Core invariants of the BSP room-and-corridor generator: determinism,
// flat-first-plus-deliberate-height, fixed-feature placement, and
// interior pocket sealing.

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk, KIOSK_HEIGHT } from "../features/fixed.js";
import { CHUNK_SIZE, TILE, ZONE } from "../types.js";
import {
  accumulateHeightBudget,
  createHeightBudgetStats,
} from "./heightBudget.test-support.js";
import { generateChunk } from "./index.js";
import { floodFromBorder } from "./test-support.js";

const SEED = hashString("layout-test-world");
const FLOOR = 1;

describe("room-and-corridor layout", () => {
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
  });

  it("differs across seeds and floors", () => {
    const a = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: 5, cy: 5 });
    const b = generateChunk({ worldSeed: hashString("other-world"), floor: FLOOR, cx: 5, cy: 5 });
    const c = generateChunk({ worldSeed: SEED, floor: FLOOR + 1, cx: 5, cy: 5 });
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });

  it("is flat-first: floor height is 0 or within the pit/dais/chasm/landmark tier budget", () => {
    const stats = createHeightBudgetStats();
    for (const [cx, cy] of chunkGrid(-5, 5)) {
      const worldChunk = { worldSeed: SEED, floor: FLOOR, cx, cy };
      if (isSafeRoomChunk(worldChunk) || isStairsChunk(worldChunk)) continue;
      accumulateHeightBudget(stats, generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy }), false);
    }
    expect(stats.violations, stats.firstViolation).toBe(0);
    expect(stats.plainFloors).toBeGreaterThan(500);
    expect(stats.deliberateFloors).toBeGreaterThan(0);
  }, 15_000);

  it("safe-room chunks contain an entrance portal on a z2 kiosk TERRACE, not an open sanctuary", () => {
    const found = findFirst(isSafeRoomChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    let doors = 0;
    let doorIndex = -1;
    for (let i = 0; i < chunk.tiles.length; i++) {
      expect(chunk.zones[i]).toBe(ZONE.None);
      if (chunk.tiles[i] === TILE.DoorSafeRoom) {
        doors++;
        doorIndex = i;
      }
    }
    expect(doors).toBe(1);
    // The kiosk terrace's walkable top platform sits north of the door
    // (KIOSK_HEIGHT, not a flat floor — VISUAL_DIRECTION.md's z+1 rule);
    // ordinary pad ground continues south of it.
    expect(chunk.tiles[doorIndex - CHUNK_SIZE]).toBe(TILE.Floor);
    expect(chunk.height[doorIndex - CHUNK_SIZE]).toBe(KIOSK_HEIGHT);
    expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
  });

  it("stairway chunks contain a cleared landing pad", () => {
    // The pad is a flat clearing (baseSample is height 0 everywhere —
    // flat-first), never TILE.Stairs: a Stairs tile with no real height
    // delta across its climb axis is the "flavor without height" bug
    // (docs/PORT_PLAN.md's worldgen redesign brief) — see fixed.ts.
    const found = findFirst(isStairsChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: found.cx, cy: found.cy });
    const clearFloor = Array.from(chunk.tiles).filter((t) => t === TILE.Floor).length;
    expect(clearFloor).toBeGreaterThan(60);
  });

  it("has no unreachable interior floor pockets (pocket sealing)", () => {
    for (const [cx, cy] of chunkGrid(-2, 2)) assertNoInteriorPockets(cx, cy);
  });
});

function assertNoInteriorPockets(cx: number, cy: number): void {
  const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx, cy });
  const reached = floodFromBorder(chunk.tiles);
  for (let index = 0; index < chunk.tiles.length; index++) assertReachedFloor({ tile: chunk.tiles[index], reached: reached[index], cx, cy, index });
}

function assertReachedFloor({ tile, reached, cx, cy, index }: { tile: number | undefined; reached: number | undefined; cx: number; cy: number; index: number }): void {
  if (tile !== TILE.Void) expect(reached, `chunk ${cx},${cy} tile ${index} is an orphan pocket`).toBe(1);
}

function chunkGrid(min: number, max: number): Array<[number, number]> {
  return Array.from({ length: max - min + 1 }, (_, x) => x + min)
    .flatMap((cx) => Array.from({ length: max - min + 1 }, (_, y) => [cx, y + min] as [number, number]));
}

function findFirst(
  predicate: (chunk: { worldSeed: number; floor: number; cx: number; cy: number }) => boolean,
): { cx: number; cy: number } | null {
  return chunkGrid(-6, 6)
    .map(([cx, cy]) => ({ cx, cy }))
    .find(({ cx, cy }) => predicate({ worldSeed: SEED, floor: FLOOR, cx, cy })) ?? null;
}
