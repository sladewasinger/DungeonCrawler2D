// Elevation showcase guarantee (docs/ROADMAP.md PANEL ROUND 3b blocker #3):
// within ~20 tiles of the floor-1 entry anchor (showcaseScan.ts's spiral —
// the same "nearest walkable to world origin" rule the spawn anchor uses),
// guarantee at least one clean raised platform (z1, 2x2) and one clean pit
// (z-1, 2x2 interior with its rim stair). Find-or-carve: if the ordinary
// generator already produced a qualifying feature near the entry, nothing
// changes; otherwise carve one into the CLOSEST flat open clearing. Pure and
// deterministic — fixed scan order over chunk-local data, no RNG — so the
// byte-determinism networking invariant holds untouched. Runs LAST in
// generateChunk, after every safety net: an earlier slot let the nets rework a
// natural feature the find phase had already accepted (resolveShallowPlateaus
// clamping a found platform, demoteOrphanedStairs eating a counted tread —
// observed live across the 10-seed invariant). The carve itself re-violates
// nothing the nets police, by construction: every edge it creates is a sheer
// full-tier (+/-1) drop repairCliffs deliberately leaves alone, the platform is
// exactly the z+1 rule's 2-deep minimum, the tread's climb axis straddles a
// checked-flat threshold and the pit floor, and no Wall/pocket topology
// changes at all.
import { CHUNK_SIZE, TILE, ZONE } from "../types.js";
import { isNearDescent, isNearLandmark } from "./landmarks/guard.js";
import {
  at,
  BLOCK,
  blockCells,
  blockDistance,
  type Cell,
  EPS,
  entryAnchor,
  type Grid,
  hasCleanPit,
  hasCleanPlatform,
  ringCells,
  SHOWCASE_DEPTH,
  SHOWCASE_RISE,
  TREAD_H,
} from "./showcaseScan.js";
import type { Rect } from "./types.js";

export { SHOWCASE_RADIUS } from "./showcaseScan.js";

/** Stair-side candidates for a carved pit, tried in this fixed order. */
const STAIR_DIRS: ReadonlyArray<readonly [number, number]> = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];

/** Every cell is in-chunk, plain FLAT open floor, outside reserved zones — flat
 * is non-negotiable (this runs after every repair net, so carving against
 * anything but level-0 ground could mint an unrepaired sub-tier graze). This
 * also makes double-claiming structurally impossible: a cell the platform
 * carve raised is no longer flat, so no pit site can include it. Corridor-
 * carved cells are deliberately fair game, block included: the fully-open flat
 * ring this requires means any route through the block detours around it on
 * level ground (and a doorway/tight passage can never qualify — its flanking
 * walls would sit in the ring), so no guaranteed path is ever jump-gated. */
function cellsCarvable(g: Grid, cells: readonly Cell[]): boolean {
  return cells.every(([x, y]) => {
    if (x < 0 || y < 0 || x >= CHUNK_SIZE || y >= CHUNK_SIZE) return false;
    if (at(g.tiles, x, y) !== TILE.Floor || at(g.zones, x, y) !== ZONE.None) return false;
    return Math.abs(at(g.height, x, y)) <= EPS;
  });
}

function guardsClear(worldSeed: number, floor: number, bx: number, by: number): boolean {
  const r: Rect = { x0: bx - 1, y0: by - 1, x1: bx + BLOCK, y1: by + BLOCK };
  return !isNearLandmark(worldSeed, floor, 0, 0, r) && !isNearDescent(worldSeed, floor, 0, 0, r);
}

/** A 2x2-plus-ring clearing at (bx, by) this pass may carve into (no mutation). */
function platformViable(g: Grid, worldSeed: number, floor: number, bx: number, by: number): boolean {
  const block = blockCells(bx, by);
  if (!cellsCarvable(g, [...block, ...ringCells(bx, by)])) return false;
  return guardsClear(worldSeed, floor, bx, by);
}

/** Raise the 2x2 to z1 — the surrounding ring stays z0, every edge sheer full-tier. */
function carvePlatformAt(g: Grid, bx: number, by: number): void {
  for (const [x, y] of blockCells(bx, by)) g.height[y * CHUNK_SIZE + x] = SHOWCASE_RISE;
}

/** The ring cell a pit's tread occupies for stair side (dx, dy), and the
 * threshold cell one further out (kept z0 so the climb axis is real —
 * height.ts's carveRamp shape). */
function pitStair(bx: number, by: number, dx: number, dy: number): { tread: Cell; threshold: Cell } {
  const tread: Cell = [bx + (dx === 1 ? BLOCK : dx === -1 ? -1 : 0), by + (dy === 1 ? BLOCK : dy === -1 ? -1 : 0)];
  return { tread, threshold: [tread[0] + dx, tread[1] + dy] };
}

/** First workable stair side for a pit at (bx, by), or null if none (no mutation). */
function pitViable(g: Grid, worldSeed: number, floor: number, bx: number, by: number): Cell | null {
  const block = blockCells(bx, by);
  if (!cellsCarvable(g, [...block, ...ringCells(bx, by)]) || !guardsClear(worldSeed, floor, bx, by)) return null;
  for (const [dx, dy] of STAIR_DIRS) {
    const { threshold } = pitStair(bx, by, dx, dy);
    if (cellsCarvable(g, [threshold])) return [dx, dy];
  }
  return null;
}

/** Sink the 2x2 to z-1 with one compact rim-stair tread at -0.5 on side `dir`. */
function carvePitAt(g: Grid, bx: number, by: number, dir: Cell): void {
  for (const [x, y] of blockCells(bx, by)) g.height[y * CHUNK_SIZE + x] = SHOWCASE_DEPTH;
  const { tread } = pitStair(bx, by, dir[0], dir[1]);
  g.tiles[tread[1] * CHUNK_SIZE + tread[0]] = TILE.Stairs;
  g.height[tread[1] * CHUNK_SIZE + tread[0]] = TREAD_H;
}

/** The viable block CLOSEST to the entry anchor (ties broken row-major), so a
 * carved showcase lands as near the player's first steps as the chunk allows. */
function closestViable(anchor: Cell, viable: (bx: number, by: number) => boolean): Cell | null {
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (let by = 1; by < CHUNK_SIZE; by++) {
    for (let bx = 1; bx < CHUNK_SIZE; bx++) {
      const d = blockDistance(anchor, bx, by);
      if (d >= bestDist) continue;
      if (!viable(bx, by)) continue;
      best = [bx, by];
      bestDist = d;
    }
  }
  return best;
}

/** Find-or-carve the floor-1 entry showcase (module doc). Chunk (0,0) floor 1 only. */
export function applyShowcase(
  worldSeed: number,
  floor: number,
  cx: number,
  cy: number,
  tiles: Uint8Array,
  height: Float32Array,
  zones: Uint8Array,
): void {
  if (floor !== 1 || cx !== 0 || cy !== 0) return;
  const g: Grid = { tiles, height, zones };
  const anchor = entryAnchor(tiles);
  if (!hasCleanPlatform(g, anchor)) {
    const spot = closestViable(anchor, (bx, by) => platformViable(g, worldSeed, floor, bx, by));
    if (spot) carvePlatformAt(g, spot[0], spot[1]);
  }
  if (!hasCleanPit(g, anchor)) {
    const spot = closestViable(anchor, (bx, by) => pitViable(g, worldSeed, floor, bx, by) !== null);
    if (spot) {
      const dir = pitViable(g, worldSeed, floor, spot[0], spot[1]);
      if (dir) carvePitAt(g, spot[0], spot[1], dir);
    }
  }
}
