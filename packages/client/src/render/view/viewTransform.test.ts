// worldToView/viewToWorld: the seam's point mapping. Orientation-0 identity is a
// pixel-lock regression test — everything the renderer draws today goes through this
// path unchanged (brief step 1's "at orientation 0 output must be PIXEL-IDENTICAL").
import { describe, expect, it } from "vitest";
import { VIEW_ORIENTATIONS } from "./viewOrientation.js";
import { viewTileToWorld, viewToWorld, worldTileToView, worldToView, type Point } from "./viewTransform.js";

const SAMPLE_POINTS: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 3.5, y: -2.25 },
  { x: -7, y: 12 },
  { x: 4096, y: -4096 },
];

describe("worldToView at orientation 0", () => {
  it("is the identity — pixel-lock regression for today's unrotated view", () => {
    for (const p of SAMPLE_POINTS) {
      expect(worldToView(p, 0)).toEqual(p);
      expect(viewToWorld(p, 0)).toEqual(p);
    }
  });
});

describe("worldToView", () => {
  it("matches the derived rotation table at each orientation", () => {
    const p = { x: 1, y: 0 }; // world east
    expect(worldToView(p, 0)).toEqual({ x: 1, y: 0 });
    expect(worldToView(p, 90)).toEqual({ x: 0, y: -1 });
    expect(worldToView(p, 180)).toEqual({ x: -1, y: 0 });
    expect(worldToView(p, 270)).toEqual({ x: 0, y: 1 });
  });

  it("world north (0, -1) rotates the same way", () => {
    const p = { x: 0, y: -1 };
    expect(worldToView(p, 0)).toEqual({ x: 0, y: -1 });
    expect(worldToView(p, 90)).toEqual({ x: -1, y: 0 });
    expect(worldToView(p, 180)).toEqual({ x: 0, y: 1 });
    expect(worldToView(p, 270)).toEqual({ x: 1, y: 0 });
  });
});

describe("round trip", () => {
  it("viewToWorld(worldToView(p)) === p for every sample point at every orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const p of SAMPLE_POINTS) {
        expect(viewToWorld(worldToView(p, orientation), orientation)).toEqual(p);
      }
    }
  });

  it("worldToView(viewToWorld(p)) === p for every sample point at every orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const p of SAMPLE_POINTS) {
        expect(worldToView(viewToWorld(p, orientation), orientation)).toEqual(p);
      }
    }
  });
});

describe("rotation is distance-preserving", () => {
  it("preserves distance from origin at every orientation (a pure rotation, no scale/skew)", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const p of SAMPLE_POINTS) {
        const v = worldToView(p, orientation);
        const worldDistSq = p.x * p.x + p.y * p.y;
        const viewDistSq = v.x * v.x + v.y * v.y;
        expect(viewDistSq).toBeCloseTo(worldDistSq, 9);
      }
    }
  });
});

describe("tile-index mapping (worldTileToView / viewTileToWorld)", () => {
  const SAMPLE_TILES: readonly Point[] = [
    { x: 0, y: 0 },
    { x: 5, y: 8 },
    { x: -3, y: 7 },
    { x: 31, y: 0 },
    { x: 15, y: 40 },
  ];
  const INTERIOR_OFFSETS = [0.01, 0.25, 0.5, 0.99];

  it("is the identity at orientation 0", () => {
    for (const t of SAMPLE_TILES) expect(worldTileToView(t, 0)).toEqual(t);
  });

  it("agrees with the continuous transform on EVERY interior point of the tile", () => {
    // The regression that motivated these helpers: entities (continuous positions)
    // drifted one cell from their floor tile (index positions) at 90/180/270 because
    // a bare index through the pure rotation lands in the neighboring cell's interior.
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const t of SAMPLE_TILES) {
        const cell = worldTileToView(t, orientation);
        for (const ox of INTERIOR_OFFSETS) {
          for (const oy of INTERIOR_OFFSETS) {
            const v = worldToView({ x: t.x + ox, y: t.y + oy }, orientation);
            expect({ x: Math.floor(v.x), y: Math.floor(v.y) }).toEqual(cell);
          }
        }
      }
    }
  });

  it("viewTileToWorld is the exact inverse of worldTileToView at every orientation", () => {
    for (const orientation of VIEW_ORIENTATIONS) {
      for (const t of SAMPLE_TILES) {
        expect(viewTileToWorld(worldTileToView(t, orientation), orientation)).toEqual(t);
        expect(worldTileToView(viewTileToWorld(t, orientation), orientation)).toEqual(t);
      }
    }
  });
});
