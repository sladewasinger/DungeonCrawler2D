// Core invariants of the BSP room-and-corridor generator: determinism,
// flat-first-plus-deliberate-height, fixed-feature placement, and
// interior pocket sealing.

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { CHUNK_SIZE, TILE, ZONE } from "../types.js";
import { generateChunk } from "./index.js";
import { CHASM_DEPTH } from "./height.js";
import { TOWER_MAX_RISE } from "./landmarks/tower.js";
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
      const a = generateChunk(SEED, FLOOR, cx, cy);
      const b = generateChunk(SEED, FLOOR, cx, cy);
      expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles));
      expect(Array.from(a.height)).toEqual(Array.from(b.height));
      expect(Array.from(a.zones)).toEqual(Array.from(b.zones));
    }
  });

  it("differs across seeds and floors", () => {
    const a = generateChunk(SEED, FLOOR, 5, 5);
    const b = generateChunk(hashString("other-world"), FLOOR, 5, 5);
    const c = generateChunk(SEED, FLOOR + 1, 5, 5);
    expect(Array.from(a.tiles)).not.toEqual(Array.from(b.tiles));
    expect(Array.from(a.tiles)).not.toEqual(Array.from(c.tiles));
  });

  it("is flat-first: floor height is 0 or within the pit/dais/chasm/landmark tier budget", () => {
    let plainFloors = 0;
    let deliberateFloors = 0;
    for (const [cx, cy] of chunkGrid(-5, 5)) {
      if (isSafeRoomChunk(SEED, FLOOR, cx, cy) || isStairsChunk(SEED, FLOOR, cx, cy)) continue;
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      for (let i = 0; i < chunk.tiles.length; i++) {
        const h = chunk.height[i] ?? 0;
        if (chunk.tiles[i] !== TILE.Floor) continue;
        expect(h).toBeGreaterThanOrEqual(CHASM_DEPTH);
        expect(h).toBeLessThanOrEqual(TOWER_MAX_RISE);
        if (h === 0) plainFloors++;
        else deliberateFloors++;
      }
    }
    expect(plainFloors).toBeGreaterThan(500);
    expect(deliberateFloors).toBeGreaterThan(0);
  });

  it("safe-room chunks contain an entrance portal, not an open sanctuary", () => {
    const found = findFirst(isSafeRoomChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
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
    expect(chunk.tiles[doorIndex - CHUNK_SIZE]).toBe(TILE.Wall);
    expect(chunk.tiles[doorIndex + CHUNK_SIZE]).toBe(TILE.Floor);
  });

  it("stairway chunks contain a stairs pad", () => {
    const found = findFirst(isStairsChunk);
    expect(found).not.toBeNull();
    if (!found) return;
    const chunk = generateChunk(SEED, FLOOR, found.cx, found.cy);
    const stairTiles = Array.from(chunk.tiles).filter((t) => t === TILE.Stairs).length;
    expect(stairTiles).toBeGreaterThan(0);
  });

  it("has no unreachable interior floor pockets (pocket sealing)", () => {
    for (const [cx, cy] of chunkGrid(-2, 2)) {
      const chunk = generateChunk(SEED, FLOOR, cx, cy);
      const reached = floodFromBorder(chunk.tiles);
      for (let i = 0; i < chunk.tiles.length; i++) {
        if (chunk.tiles[i] === TILE.Wall) continue;
        expect(reached[i], `chunk ${cx},${cy} tile ${i} is an orphan pocket`).toBe(1);
      }
    }
  });
});

function chunkGrid(min: number, max: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let cx = min; cx <= max; cx++) {
    for (let cy = min; cy <= max; cy++) out.push([cx, cy]);
  }
  return out;
}

function findFirst(
  predicate: (seed: number, floor: number, cx: number, cy: number) => boolean,
): { cx: number; cy: number } | null {
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      if (predicate(SEED, FLOOR, cx, cy)) return { cx, cy };
    }
  }
  return null;
}
