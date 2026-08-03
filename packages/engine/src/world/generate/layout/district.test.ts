// District invariants: shared character, landmark placement, and deterministic
// outer connections across neighboring 96×96 plans.

import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { TILE } from "../../core/types.js";
import {
  DISTRICT,
  DISTRICT_CHUNK_SPAN,
  districtAt,
  districtOriginForChunk,
  type DistrictKind,
} from "./district.js";
import { layoutSeed } from "./hash.js";
import {
  generateDistrictChunks,
  sliceGeneratedFloorChunk,
} from "../index.js";
import { finiteFloorForRuntime } from "../finiteFloor.js";

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
  it("a stamped arena chunk replaces its plain finite-floor style", () => {
    const floor = finiteFloorForRuntime({ worldSeed: SEED, floor: FLOOR });
    const arena = floor.miniBossArenas[0];
    expect(arena).toBeDefined();
    if (!arena) return;
    const chunk = sliceGeneratedFloorChunk(floor, arena.chunk.cx, arena.chunk.cy);
    const raisedCount = Array.from(chunk.height).filter((h) => h > 0).length;
    const floorCount = Array.from(chunk.tiles).filter((t) => t === TILE.Floor).length;
    expect(raisedCount).toBeGreaterThan(0);
    expect(floorCount).toBeGreaterThan(0);
  }, 30_000);
});

describe("district connections", () => {
  it("keeps adjacent finite runtime slices aligned at their shared edge", () => {
    const floor = finiteFloorForRuntime({ worldSeed: SEED, floor: FLOOR });
    const left = sliceGeneratedFloorChunk(floor, 0, 0);
    const right = sliceGeneratedFloorChunk(floor, 1, 0);
    const district = generateDistrictChunks({ worldSeed: SEED, floor: FLOOR, cx: 0, cy: 0 });
    expect(Array.from(district[0]?.tiles ?? [])).toEqual(Array.from(left.tiles));
    expect(Array.from(district[1]?.tiles ?? [])).toEqual(Array.from(right.tiles));
  });
});
