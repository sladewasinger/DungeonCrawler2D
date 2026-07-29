// District invariants: shared character, landmark placement, and deterministic
// outer connections across neighboring 96×96 plans.

import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { isSafeRoomChunk, isStairsChunk } from "../../features/fixed/fixed.js";
import { CHUNK_SIZE, TILE } from "../../core/types.js";
import {
  DISTRICT,
  DISTRICT_CHUNK_SPAN,
  DISTRICT_TILE_SPAN,
  districtAt,
  districtOriginForChunk,
  isLandmarkChunk,
  type DistrictKind,
} from "./district.js";
import { layoutSeed } from "./hash.js";
import { generateChunk } from "../index.js";
import { districtEdgeAnchors } from "./districtEdges.js";

const SEED = hashString("district-test-world");
const FLOOR = 1;
const ROOT_SEED = layoutSeed(SEED, FLOOR);

describe("district character", () => {
  it("all biome district kinds appear within a modest region", () => {
    const seen = new Set<DistrictKind>();
    for (let scx = -6; scx <= 6; scx++) {
      for (let scy = -6; scy <= 6; scy++) {
        seen.add(districtAt(
          ROOT_SEED,
          scx * DISTRICT_CHUNK_SPAN,
          scy * DISTRICT_CHUNK_SPAN,
        ));
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

  it("is stable for every chunk within one district", () => {
    const kind = districtAt(ROOT_SEED, 0, 0);
    for (let cx = 0; cx < DISTRICT_CHUNK_SPAN; cx++) {
      for (let cy = 0; cy < DISTRICT_CHUNK_SPAN; cy++) {
        expect(districtAt(ROOT_SEED, cx, cy)).toBe(kind);
      }
    }
  });

  it("uses floor-based origins for negative chunk coordinates", () => {
    expect(districtOriginForChunk(-1, -1)).toEqual({
      cx: -DISTRICT_CHUNK_SPAN,
      cy: -DISTRICT_CHUNK_SPAN,
    });
  });
});

describe("landmark set-pieces", () => {
  it("a landmark chunk's district-appropriate landmark replaces its plain style", () => {
    // Walk out from the center of district (0,0) until it isn't also
    // claimed by a safe-room kiosk or stairway pad.
    const centerOffset = Math.floor(DISTRICT_CHUNK_SPAN / 2);
    let cx = centerOffset;
    let cy = centerOffset;
    while (isSafeRoomChunk({ worldSeed: SEED, floor: FLOOR, cx, cy }) || isStairsChunk({ worldSeed: SEED, floor: FLOOR, cx, cy })) {
      cx += DISTRICT_CHUNK_SPAN;
      cy += DISTRICT_CHUNK_SPAN;
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

describe("district connections", () => {
  it("carves a wide shared corridor across a district boundary", () => {
    const anchor = districtEdgeAnchors({
      seed: ROOT_SEED,
      dx: 0,
      dy: 0,
      districtSize: DISTRICT_TILE_SPAN,
    }).find(({ side }) => side === 1);
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const cy = Math.floor(anchor.point.y / CHUNK_SIZE);
    const left = { cx: DISTRICT_CHUNK_SPAN - 1, cy };
    const right = { cx: DISTRICT_CHUNK_SPAN, cy };
    expect(corridorWidthAtBorder({ seed: SEED, left, right }))
      .toBeGreaterThanOrEqual(anchor.width);
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
