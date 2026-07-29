import { describe, expect, it } from "vitest";
import { hashString } from "../../../core/rng.js";
import { CHUNK_SIZE, type Chunk } from "../../core/types.js";
import { generateDistrictChunks } from "../index.js";
import { partitionRegion } from "../layout/bsp.js";
import {
  DISTRICT,
  districtAt,
  districtCoordinateForChunk,
  DISTRICT_CHUNK_SPAN,
  DISTRICT_TILE_SPAN,
} from "../layout/district.js";
import { districtSeed, layoutSeed } from "../layout/hash.js";
import type { Rect } from "../types.js";

const WORLD_SEED = hashString("district-generation");
const FLOOR = 2;
const PLANES = [
  "tiles",
  "terrain",
  "features",
  "featureFaces",
  "featureHeight",
  "height",
  "zones",
] as const;

describe("district generation", () => {
  it("slices one plan into nine 32x32 runtime chunks", () => {
    const chunks = generateDistrictChunks({
      worldSeed: WORLD_SEED,
      floor: FLOOR,
      cx: -1,
      cy: -1,
    });
    expect(chunks).toHaveLength(DISTRICT_CHUNK_SPAN ** 2);
    expect(new Set(chunks.map(({ cx, cy }) => `${cx},${cy}`)).size)
      .toBe(DISTRICT_CHUNK_SPAN ** 2);
    for (const chunk of chunks) {
      for (const plane of PLANES) {
        expect(chunk[plane]).toHaveLength(CHUNK_SIZE * CHUNK_SIZE);
      }
    }
  });

  it("is tile-for-tile independent of which district chunk was requested", () => {
    const northWest = generateDistrictChunks({
      worldSeed: WORLD_SEED,
      floor: FLOOR,
      cx: 0,
      cy: 0,
    });
    const southEast = generateDistrictChunks({
      worldSeed: WORLD_SEED,
      floor: FLOOR,
      cx: 2,
      cy: 2,
    });
    for (let index = 0; index < northWest.length; index++) {
      expectChunkPlanesEqual(
        northWest[index] as Chunk,
        southEast[index] as Chunk,
      );
    }
  });

  it("allows rooms to cross internal runtime-chunk boundaries", () => {
    const floorSeed = layoutSeed(WORLD_SEED, FLOOR);
    const coordinate = districtCoordinateForChunk(0, 0);
    const kind = districtAt(floorSeed, 0, 0);
    const rooms = partitionRegion(
      districtSeed(floorSeed, coordinate.dx, coordinate.dy),
      DISTRICT_TILE_SPAN,
      kind,
    ).rooms;
    expect(rooms.some(({ rect }) => crossesChunkBoundary(rect))).toBe(true);
  });

  it("keeps maze districts dense instead of collapsing into a few giant rooms", () => {
    const rooms = partitionRegion(
      WORLD_SEED,
      DISTRICT_TILE_SPAN,
      DISTRICT.Ruins,
    ).rooms;
    const minimumRoomCount = DISTRICT_CHUNK_SPAN ** 2 * 4;

    expect(rooms.length).toBeGreaterThanOrEqual(minimumRoomCount);
    expect(rooms.every(({ rect }) => {
      return rect.x1 - rect.x0 + 1 <= CHUNK_SIZE &&
        rect.y1 - rect.y0 + 1 <= CHUNK_SIZE;
    })).toBe(true);
  });
});

function expectChunkPlanesEqual(a: Chunk, b: Chunk): void {
  expect({ cx: a.cx, cy: a.cy }).toEqual({ cx: b.cx, cy: b.cy });
  for (const plane of PLANES) {
    expect(Array.from(a[plane])).toEqual(Array.from(b[plane]));
  }
}

function crossesChunkBoundary(rect: Rect): boolean {
  for (let offset = 1; offset < DISTRICT_CHUNK_SPAN; offset++) {
    const boundary = offset * CHUNK_SIZE;
    const crossesX = rect.x0 < boundary && rect.x1 >= boundary;
    const crossesY = rect.y0 < boundary && rect.y1 >= boundary;
    if (crossesX || crossesY) return true;
  }
  return false;
}
