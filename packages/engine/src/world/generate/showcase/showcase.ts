// Elevation showcase guarantee (docs/ROADMAP.md PANEL ROUND 3b blocker #3):
// within ~20 tiles of the floor-1 entry anchor (showcaseScan.ts's spiral —
// the same "nearest walkable to world origin" rule the spawn anchor uses),
// guarantee at least one clean flat VOID plateau (the former raised 2x2 mass)
// and one clean pit
// (z-1, 2x2 interior with its rim stair). Find-or-carve: if the ordinary
// generator already produced a qualifying feature near the entry, nothing
// changes; otherwise carve one into the CLOSEST flat open clearing. Pure and
// deterministic — fixed scan order over chunk-local data, no RNG — so the
// byte-determinism networking invariant holds untouched. Runs LAST in
// generateChunk, after every safety net: an earlier slot let the nets rework a
// natural feature the find phase had already accepted (resolveShallowPlateaus
// clamping a found platform, demoteOrphanedStairs eating a counted tread —
// observed live across the 10-seed invariant). The carve itself re-violates
// nothing the nets police, by construction: the plateau is explicit
// infinite-height VOID and therefore has no height edge for repairCliffs to
// reinterpret, while the pit retains its checked-flat threshold and floor.
// No Wall/pocket topology changes at all.
import { TILE, ZONE } from "../../core/types.js";
import { GENERATION_CHUNK_SIZE as CHUNK_SIZE } from "../layout/scale.js";
import { isNearDescent, isNearLandmark } from "../landmarks/guard.js";
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
import type { Rect } from "../types.js";

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

function guardsClear(...[worldSeed, floor, bx, by]: [number, number, number, number]): boolean {
  const r: Rect = { x0: bx - 1, y0: by - 1, x1: bx + BLOCK, y1: by + BLOCK };
  const context = { worldSeed, floor, cx: 0, cy: 0, rect: r };
  return !isNearLandmark(context) && !isNearDescent(context);
}

/** A 2x2-plus-ring clearing at (bx, by) this pass may carve into (no mutation). */
function platformViable(...[g, worldSeed, floor, bx, by]: [Grid, number, number, number, number]): boolean {
  const block = blockCells(bx, by);
  if (!cellsCarvable(g, [...block, ...ringCells(bx, by)])) return false;
  return guardsClear(worldSeed, floor, bx, by);
}

/** Convert the 2x2 plateau to explicit VOID; its surrounding ring stays z0. */
function carveVoidPlateauAt(g: Grid, bx: number, by: number): void {
  for (const [x, y] of blockCells(bx, by)) {
    const index = y * CHUNK_SIZE + x;
    g.tiles[index] = TILE.Void;
    g.height[index] = 0;
  }
}

function carveRaisedPlatformAt(g: Grid, bx: number, by: number): void {
  for (const [x, y] of blockCells(bx, by)) {
    g.tiles[y * CHUNK_SIZE + x] = TILE.Floor;
    g.height[y * CHUNK_SIZE + x] = SHOWCASE_RISE;
  }
}

/** The ring cell a pit's tread occupies for stair side (dx, dy), and the
 * threshold cell one further out (kept z0 so the climb axis is real —
 * height.ts's carveRamp shape). */
function stairOffset(direction: number): number {
  if (direction === 1) return BLOCK;
  if (direction === -1) return -1;
  return 0;
}

function pitStair({ bx, by, dx, dy }: { bx: number; by: number; dx: number; dy: number }): { tread: Cell; threshold: Cell } {
  const tread: Cell = [bx + stairOffset(dx), by + stairOffset(dy)];
  return { tread, threshold: [tread[0] + dx, tread[1] + dy] };
}

interface PitSite {
  readonly g: Grid; readonly worldSeed: number; readonly floor: number;
  readonly bx: number; readonly by: number; readonly voidTerrain: boolean;
}

/** First workable stair side for a pit at (bx, by), or null if none (no mutation). */
function pitViable({ g, worldSeed, floor, bx, by, voidTerrain }: PitSite): Cell | null {
  const block = blockCells(bx, by);
  if (!cellsCarvable(g, [...block, ...ringCells(bx, by)]) || !guardsClear(worldSeed, floor, bx, by)) return null;
  for (const [dx, dy] of STAIR_DIRS) {
    const { tread, threshold } = pitStair({ bx, by, dx, dy });
    if (cellsCarvable(g, [threshold]) && (!voidTerrain || !touchesVoid(g, tread))) return [dx, dy];
  }
  return null;
}

function touchesVoid(g: Grid, [x, y]: Cell): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (at(g.tiles, x + dx, y + dy) === TILE.Void) return true;
    }
  }
  return false;
}

/** Sink the 2x2 to z-1 with one compact rim-stair tread at -0.5 on side `dir`. */
function carvePitAt(...[g, bx, by, dir]: [Grid, number, number, Cell]): void {
  for (const [x, y] of blockCells(bx, by)) g.height[y * CHUNK_SIZE + x] = SHOWCASE_DEPTH;
  const { tread } = pitStair({ bx, by, dx: dir[0], dy: dir[1] });
  g.tiles[tread[1] * CHUNK_SIZE + tread[0]] = TILE.Stairs;
  g.height[tread[1] * CHUNK_SIZE + tread[0]] = TREAD_H;
}

/** The viable block CLOSEST to the entry anchor (ties broken row-major), so a
 * carved showcase lands as near the player's first steps as the chunk allows. */
function closestViable(anchor: Cell, viable: (bx: number, by: number) => boolean): Cell | null {
  let best: Cell | null = null;
  let bestDist = Infinity;
  for (const candidate of blockCandidates()) {
    const distance = blockDistance(anchor, candidate[0], candidate[1]);
    if (distance < bestDist && viable(candidate[0], candidate[1])) {
      best = candidate;
      bestDist = distance;
    }
  }
  return best;
}

function blockCandidates(): Cell[] {
  const cells: Cell[] = [];
  for (let by = 1; by < CHUNK_SIZE; by++) {
    for (let bx = 1; bx < CHUNK_SIZE; bx++) cells.push([bx, by]);
  }
  return cells;
}

/** Find-or-carve the floor-1 entry showcase (module doc). Chunk (0,0) floor 1 only. */
interface ShowcaseContext {
  g: Grid;
  anchor: Cell;
  worldSeed: number;
  floor: number;
  voidTerrain: boolean;
}

function ensurePlatform({ g, anchor, worldSeed, floor, voidTerrain }: ShowcaseContext): void {
  if (hasCleanPlatform(g, anchor, voidTerrain)) return;
  const spot = closestViable(anchor, (bx, by) => platformViable(g, worldSeed, floor, bx, by));
  if (!spot) return;
  if (voidTerrain) carveVoidPlateauAt(g, spot[0], spot[1]);
  else carveRaisedPlatformAt(g, spot[0], spot[1]);
}

function ensurePit(context: ShowcaseContext): void {
  const { g, anchor, worldSeed, floor, voidTerrain } = context;
  if (hasCleanPit(g, anchor)) return;
  const site = (bx: number, by: number): PitSite => ({ g, worldSeed, floor, bx, by, voidTerrain });
  const spot = closestViable(anchor, (bx, by) => pitViable(site(bx, by)) !== null);
  if (!spot) return;
  const direction = pitViable(site(spot[0], spot[1]));
  if (direction) carvePitAt(g, spot[0], spot[1], direction);
}

export interface ShowcaseRequest {
  readonly worldSeed: number; readonly floor: number; readonly cx: number; readonly cy: number;
  readonly tiles: Uint8Array; readonly height: Float32Array; readonly zones: Uint8Array;
  readonly voidTerrain: boolean;
}

export function applyShowcase({ worldSeed, floor, cx, cy, tiles, height, zones, voidTerrain }: ShowcaseRequest): void {
  if (floor !== 1 || cx !== 0 || cy !== 0) return;
  const g: Grid = { tiles, height, zones };
  const anchor = entryAnchor(tiles);
  const context = { g, anchor, worldSeed, floor, voidTerrain };
  ensurePlatform(context);
  ensurePit(context);
}
