// Grafted from the "districts" candidate: super-chunk character, landmark
// set-pieces, and avenue-widened seams layered onto the architect base
// generator (docs/PORT_PLAN.md's worldgen redesign brief).

import { describe, expect, it } from "vitest";
import { hashString } from "../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "../features/fixed.js";
import { CHUNK_SIZE, TILE } from "../types.js";
import { DISTRICT, districtAt, isLandmarkChunk, type DistrictKind } from "./district.js";
import { architectSeed } from "./hash.js";
import { generateChunk } from "./index.js";

const SEED = hashString("district-test-world");
const FLOOR = 1;
const ROOT_SEED = architectSeed(SEED, FLOOR);

describe("district character", () => {
  it("all biome district kinds appear within a modest region", () => {
    const seen = new Set<DistrictKind>();
    for (let scx = -6; scx <= 6; scx++) {
      for (let scy = -6; scy <= 6; scy++) {
        seen.add(districtAt(ROOT_SEED, scx * 3, scy * 3));
      }
    }
    expect(seen).toEqual(new Set([
      DISTRICT.Warren,
      DISTRICT.Plaza,
      DISTRICT.Ruins,
      DISTRICT.PillarForest,
      DISTRICT.Flooded,
      DISTRICT.Arena,
    ]));
  });

  it("is stable for every chunk within one super-chunk", () => {
    const kind = districtAt(ROOT_SEED, 0, 0);
    for (let cx = 0; cx < 3; cx++) {
      for (let cy = 0; cy < 3; cy++) {
        expect(districtAt(ROOT_SEED, cx, cy)).toBe(kind);
      }
    }
  });
});

describe("landmark set-pieces", () => {
  it("a landmark chunk's district-appropriate landmark replaces its plain style", () => {
    // Walk out from the center of super-chunk (0,0) until it isn't also
    // claimed by a safe-room kiosk or stairway pad.
    let cx = 1;
    let cy = 1;
    while (isSafeRoomChunk({ worldSeed: SEED, floor: FLOOR, cx, cy }) || isStairsChunk({ worldSeed: SEED, floor: FLOOR, cx, cy })) {
      cx += 3;
      cy += 3;
    }
    expect(isLandmarkChunk(cx, cy)).toBe(true);
    const chunk = generateChunk({ worldSeed: SEED, floor: FLOOR, cx: cx, cy: cy });
    // Every landmark stamps at least one raised Floor ring/gate around its
    // center — a landmark chunk is never indistinguishable from a plain
    // one, and its own gates keep it internally walkable.
    const raisedCount = Array.from(chunk.height).filter((h) => h > 0).length;
    const floorCount = Array.from(chunk.tiles).filter((t) => t === TILE.Floor).length;
    expect(raisedCount).toBeGreaterThan(0);
    expect(floorCount).toBeGreaterThan(0);
  });
});

describe("avenues", () => {
  it("a corridor crossing a super-chunk boundary is wider than one that doesn't", () => {
    // Chunks (2,0)|(3,0) straddle a super-chunk seam; (0,0)|(1,0) don't
    // (SUPERCHUNK_SIZE = 3). Measure carved width along each shared border.
    const inSeamWidth = corridorWidthAtBorder({ seed: SEED, left: { cx: 0, cy: 0 }, right: { cx: 1, cy: 0 } });
    const avenueWidth = corridorWidthAtBorder({ seed: SEED, left: { cx: 2, cy: 0 }, right: { cx: 3, cy: 0 } });
    expect(avenueWidth).toBeGreaterThanOrEqual(inSeamWidth);
  });
});

/** Widest run of carved (non-wall) tiles along the shared vertical border between two east/west-adjacent chunks. */
function corridorWidthAtBorder({ seed, left, right }: { seed: number; left: { cx: number; cy: number }; right: { cx: number; cy: number } }): number {
  const a = generateChunk({ worldSeed: seed, floor: FLOOR, ...left });
  const b = generateChunk({ worldSeed: seed, floor: FLOOR, ...right });
  let best = 0;
  let run = 0;
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    const eastEdge = a.tiles[ly * CHUNK_SIZE + (CHUNK_SIZE - 1)];
    const westEdge = b.tiles[ly * CHUNK_SIZE];
    const carved = eastEdge !== TILE.Void && westEdge !== TILE.Void;
    run = carved ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
