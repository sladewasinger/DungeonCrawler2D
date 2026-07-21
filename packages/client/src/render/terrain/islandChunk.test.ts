// islandChunkCoords/islandViewCentroid: pure framing math shared by the gallery and
// editor scenes (see module doc). At orientation 0 this must reduce to the pre-lane
// hardcoded single chunk (0,0) — the pixel-lock anchor. Under the tile-index mapping
// (worldTileToView), the 20-tile island rotates onto view tiles -20..-1 on each negated
// axis — entirely inside a single 32-aligned chunk — so every orientation is exactly one
// chunk. (The old pure-index rotation put the range at -19..0, straddling the boundary
// at 0: that 2/4/2-chunk spread was the one-cell offset bug, not real geometry.) The
// coverage assertion below is the real invariant: the returned set covers all 4 corners.
import { CHUNK_SIZE } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "../view/viewOrientation.js";
import { worldTileToView, worldToView } from "../view/viewTransform.js";
import { islandChunkCoords, islandViewCentroid } from "./islandChunk.js";

const GRID_SIZE = 20;

function coveredBy(coords: readonly { cx: number; cy: number }[], v: { x: number; y: number }): boolean {
  return coords.some(
    ({ cx, cy }) =>
      v.x >= cx * CHUNK_SIZE && v.x < (cx + 1) * CHUNK_SIZE && v.y >= cy * CHUNK_SIZE && v.y < (cy + 1) * CHUNK_SIZE,
  );
}

describe("islandChunkCoords", () => {
  it("is exactly one chunk (0,0) at orientation 0 — the pre-lane hardcoded value, pixel-lock anchor", () => {
    expect(islandChunkCoords(0, GRID_SIZE)).toEqual([{ cx: 0, cy: 0 }]);
  });

  it("is exactly one chunk at 90/180/270 too — the rotated island sits inside one aligned chunk", () => {
    expect(islandChunkCoords(90, GRID_SIZE)).toEqual([{ cx: 0, cy: -1 }]);
    expect(islandChunkCoords(180, GRID_SIZE)).toEqual([{ cx: -1, cy: -1 }]);
    expect(islandChunkCoords(270, GRID_SIZE)).toEqual([{ cx: -1, cy: 0 }]);
  });

  it("the returned chunk set's union always contains all 4 real corners' view coords, at every orientation", () => {
    const far = GRID_SIZE - 1;
    const realCorners = [
      { x: 0, y: 0 },
      { x: far, y: 0 },
      { x: 0, y: far },
      { x: far, y: far },
    ];
    for (const orientation of VIEW_ORIENTATIONS) {
      const coords = islandChunkCoords(orientation, GRID_SIZE);
      for (const corner of realCorners) {
        const v = worldTileToView(corner, orientation);
        expect(coveredBy(coords, v), `orientation ${orientation}, corner ${JSON.stringify(corner)} -> view ${JSON.stringify(v)}`).toBe(
          true,
        );
      }
    }
  });

  it("returns no duplicate chunk coordinates", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      const coords = islandChunkCoords(orientation, GRID_SIZE);
      const keys = coords.map((c) => `${c.cx},${c.cy}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("islandViewCentroid", () => {
  it("is the grid's real center at orientation 0", () => {
    expect(islandViewCentroid(0, GRID_SIZE)).toEqual({ x: 10, y: 10 });
  });

  it("matches worldToView of the grid center at every orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      expect(islandViewCentroid(orientation, GRID_SIZE)).toEqual(worldToView({ x: 10, y: 10 }, orientation));
    }
  });
});
