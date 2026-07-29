// Scan half of the floor-1 elevation showcase (see showcase.ts's module doc):
// the entry-anchor spiral, the shared 2x2-block geometry, and the "does a
// clean platform/pit already exist near the entry" finders. Pure reads over
// chunk-local arrays — the carve half (showcase.ts) owns all mutation.
import { CHUNK_SIZE, TILE, TOPOLOGY } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

/** Chebyshev radius around the entry anchor that bounds "near the floor-1
 * entry" — the ~20-tile brief with a small tolerance (docs/ASSUMPTIONS.md row
 * 364): corridor-dense entries sometimes have their nearest fully-clean 4x4
 * clearing a hair past 20 (seed 1637332426's closest sits at 21). The carve
 * always takes the CLOSEST viable site, so this is a worst-case bound, not the
 * typical distance. The anchor mirrors game-server/src/sim/spawn.ts's
 * resolveSpawnAnchor — nearest walkable tile to world origin, same spiral
 * order — restricted to this chunk's own cells (the real spiral may cross into
 * a negative-coordinate neighbor; when it does the two anchors differ by at
 * most a few tiles, inside the same tolerance). */
export const SHOWCASE_RADIUS = WORLD_GENERATION_TUNING.showcase.searchRadius;
export const SHOWCASE_RISE = WORLD_GENERATION_TUNING.showcase.platformRise;
export const SHOWCASE_DEPTH = WORLD_GENERATION_TUNING.showcase.pitDepth;
export const BLOCK = WORLD_GENERATION_TUNING.showcase.featureSpan;
export const EPS = 0.01;
/** A pit rim cell must sit above the pit floor by the wall-face threshold. */
const RIM_MIN_H = SHOWCASE_DEPTH + 0.75;
/** One compact tread, midway (height.ts's one-tread-per-whole-z contract). */
export const TREAD_H = SHOWCASE_DEPTH / 2;

export interface Grid {
  readonly tiles: Uint8Array;
  readonly height: Float32Array;
  readonly zones: Uint8Array;
}

export type Cell = readonly [number, number];

export const at = (a: Uint8Array | Float32Array, x: number, y: number): number =>
  a[y * CHUNK_SIZE + x] ?? 0;

/** Nearest finite-floor cell to local (0,0), by the same expanding
 * Chebyshev-ring spiral spawn.ts's findWalkableNear walks. */
export function entryAnchor(tiles: Uint8Array): Cell {
  for (let radius = 0; radius < CHUNK_SIZE; radius++) {
    const anchor = ringOffsets(radius).find(([x, y]) => isWalkableInChunk(tiles, x, y));
    if (anchor) return anchor;
  }
  return [0, 0];
}

function ringOffsets(radius: number): Cell[] {
  const cells: Cell[] = [];
  for (let x = -radius; x <= radius; x++) cells.push([x, -radius], [x, radius]);
  for (let y = -radius + 1; y < radius; y++) cells.push([-radius, y], [radius, y]);
  return cells;
}

function isWalkableInChunk(tiles: Uint8Array, x: number, y: number): boolean {
  if (x < 0 || y < 0) return false;
  const tile = tiles[y * CHUNK_SIZE + x] ?? TOPOLOGY.Uncarved;
  return tile !== TOPOLOGY.Uncarved && tile !== TILE.Void;
}

/** Chebyshev distance from the anchor to the farthest cell of the 2x2 block. */
export function blockDistance(anchor: Cell, bx: number, by: number): number {
  const [ax, ay] = anchor;
  return Math.max(
    Math.abs(bx - ax),
    Math.abs(bx + BLOCK - 1 - ax),
    Math.abs(by - ay),
    Math.abs(by + BLOCK - 1 - ay),
  );
}

/** The 8 ring cells around the 2x2 block whose top-left is (bx, by). */
export function ringCells(bx: number, by: number): Cell[] {
  return squareCells(bx - 1, by - 1, BLOCK + 2)
    .filter((cell) => !inBlock(cell, [bx, by]));
}

function squareCells(x0: number, y0: number, size: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) cells.push([x, y]);
  }
  return cells;
}

function inBlock([x, y]: Cell, [bx, by]: Cell): boolean {
  return x >= bx && x < bx + BLOCK && y >= by && y < by + BLOCK;
}

export function blockCells(bx: number, by: number): Cell[] {
  return squareCells(bx, by, BLOCK);
}

/** All 4 block cells are Floor within EPS of `h`, ring fully inside the chunk. */
function blockAt({ g, bx, by, height }: { g: Grid; bx: number; by: number; height: number }): boolean {
  if (bx < 1 || by < 1 || bx + BLOCK > CHUNK_SIZE - 1 || by + BLOCK > CHUNK_SIZE - 1) return false;
  return blockCells(bx, by).every(
    ([x, y]) => at(g.tiles, x, y) === TILE.Floor && Math.abs(at(g.height, x, y) - height) <= EPS,
  );
}

function blockCandidates(anchor: Cell): Cell[] {
  return squareCells(1, 1, CHUNK_SIZE - 1).filter(([bx, by]) => blockDistance(anchor, bx, by) <= SHOWCASE_RADIUS);
}

function hasCleanBlock(anchor: Cell, matches: (bx: number, by: number) => boolean): boolean {
  return blockCandidates(anchor).some(([bx, by]) => matches(bx, by));
}

/** A clean platform in the selected world mode, surrounded by open ground. */
export function hasCleanPlatform(g: Grid, anchor: Cell, voidTerrain = true): boolean {
  const matches = voidTerrain ? voidPlatformAt : raisedPlatformAt;
  return hasCleanBlock(anchor, (bx, by) => matches(g, bx, by));
}

function voidPlatformAt(g: Grid, bx: number, by: number): boolean {
  if (bx < 1 || by < 1 || bx + BLOCK > CHUNK_SIZE - 1 || by + BLOCK > CHUNK_SIZE - 1) return false;
  const isVoid = blockCells(bx, by).every(
    ([x, y]) => at(g.tiles, x, y) === TILE.Void && Math.abs(at(g.height, x, y)) <= EPS,
  );
  return isVoid && ringCells(bx, by).every(([x, y]) =>
    at(g.tiles, x, y) === TILE.Floor && at(g.height, x, y) <= 0.25 + EPS,
  );
}

function raisedPlatformAt(g: Grid, bx: number, by: number): boolean {
  if (!blockAt({ g, bx, by, height: SHOWCASE_RISE })) return false;
  return ringCells(bx, by).every(([x, y]) =>
    at(g.tiles, x, y) === TILE.Floor && at(g.height, x, y) <= 0.25 + EPS);
}

/** A clean z-1 pit: 2x2 Floor at z-1, ring open, near-flat rim, >=1 rim stair tread. */
export function hasCleanPit(g: Grid, anchor: Cell): boolean {
  return hasCleanBlock(anchor, (bx, by) => pitAt(g, bx, by));
}

function pitAt(g: Grid, bx: number, by: number): boolean {
  if (!blockAt({ g, bx, by, height: SHOWCASE_DEPTH })) return false;
  const rim = inspectPitRim(g, bx, by);
  return rim.open && rim.treads >= 1;
}

function inspectPitRim(g: Grid, bx: number, by: number): { open: boolean; treads: number } {
  let treads = 0;
  for (const cell of ringCells(bx, by)) {
    const state = pitRimCell(g, cell);
    if (!state.open) return { open: false, treads };
    if (state.tread) treads++;
  }
  return { open: true, treads };
}

function pitRimCell(g: Grid, [x, y]: Cell): { open: boolean; tread: boolean } {
  const tile = at(g.tiles, x, y);
  if (tile === TOPOLOGY.Uncarved) return { open: false, tread: false };
  const tread = tile === TILE.Stairs && Math.abs(at(g.height, x, y) - TREAD_H) <= EPS;
  return { open: tread || at(g.height, x, y) >= RIM_MIN_H - EPS, tread };
}
