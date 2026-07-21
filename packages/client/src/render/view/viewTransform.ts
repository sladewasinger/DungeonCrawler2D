// The seam's point mapping: every terrain/entity draw decision that needs a screen
// position must go world coordinate -> worldToView -> screen pixels, never straight
// world -> screen. World axes follow the engine's existing convention (north = -y,
// east = +x, per stairFrame.ts's NEIGHBORS table); `ViewOrientation` names which world
// compass direction currently renders "up" on screen: 0 = north-up (today's identity,
// pixel-locked by viewTransform.test.ts), 90 = east-up, 180 = south-up, 270 = west-up.
// Each step is a pure 90-degree rotation matrix (no floating trig — exact integer/half
// swaps so tile-grid math stays exact at every orientation).
import type { ViewOrientation } from "./viewOrientation.js";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Negating 0 in the tables below yields -0, which is numerically equal to 0 but trips
 * up deep-equality assertions (and is a needless surprise for anything that formats or
 * hashes the coordinate) — this collapses -0 back to 0. */
function noNegativeZero(n: number): number {
  return n === 0 ? 0 : n;
}

function point(x: number, y: number): Point {
  return { x: noNegativeZero(x), y: noNegativeZero(y) };
}

/** World (continuous tile units) -> view-space (continuous tile units, pre-pixel-scale). */
export function worldToView(world: Point, orientation: ViewOrientation): Point {
  switch (orientation) {
    case 0:
      return point(world.x, world.y);
    case 90:
      return point(world.y, -world.x);
    case 180:
      return point(-world.x, -world.y);
    case 270:
      return point(-world.y, world.x);
  }
}

/** View-space -> world (continuous tile units). Exact inverse of worldToView. */
export function viewToWorld(view: Point, orientation: ViewOrientation): Point {
  switch (orientation) {
    case 0:
      return point(view.x, view.y);
    case 90:
      return point(-view.y, view.x);
    case 180:
      return point(-view.x, -view.y);
    case 270:
      return point(view.y, -view.x);
  }
}

// TILE-INDEX mapping. A tile index is not a point: tile t spans the half-open interval
// [t, t+1), and a pure rotation negates axes, sending that interior into (-t-1, -t) —
// tile -t-1, NOT tile -t. Feeding a bare index through the continuous functions above
// therefore lands one cell off on every negated axis, disagreeing with every interior
// point of the same tile (entities drifted a tile from their floor at 90/180/270 this
// way). Mapping the tile's CENTER and flooring keeps the index in lockstep with the
// continuous mapping of all its interior points — the one convention the terrain grid,
// entities, and pointer picks must share.

/** World tile index -> the view-space cell that displays it at `orientation`. */
export function worldTileToView(tile: Point, orientation: ViewOrientation): Point {
  const v = worldToView({ x: tile.x + 0.5, y: tile.y + 0.5 }, orientation);
  return point(Math.floor(v.x), Math.floor(v.y));
}

/** View-space cell -> the world tile it displays at `orientation`. Exact inverse of
 * worldTileToView. */
export function viewTileToWorld(tile: Point, orientation: ViewOrientation): Point {
  const w = viewToWorld({ x: tile.x + 0.5, y: tile.y + 0.5 }, orientation);
  return point(Math.floor(w.x), Math.floor(w.y));
}
