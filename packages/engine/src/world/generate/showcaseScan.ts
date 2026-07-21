// Scan half of the floor-1 elevation showcase (see showcase.ts's module doc):
// the entry-anchor spiral, the shared 2x2-block geometry, and the "does a
// clean platform/pit already exist near the entry" finders. Pure reads over
// chunk-local arrays — the carve half (showcase.ts) owns all mutation.
import { WALL_FACE_MIN_DROP } from "../../core/constants.js";
import { CHUNK_SIZE, TILE } from "../types.js";

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
export const SHOWCASE_RADIUS = 24;
export const SHOWCASE_RISE = 1; // z1 platform — the jumpable tier (height.ts's ROOM_RISE)
export const SHOWCASE_DEPTH = -1; // z-1 pit, exited via its rim stair tread
export const BLOCK = 2; // 2x2 feature interior
export const EPS = 0.01;
/** A ring cell must sit at least a face-drop below a platform top (1 - 0.75). */
const RING_MAX_H = SHOWCASE_RISE - WALL_FACE_MIN_DROP;
/** A pit rim cell must sit at least a face-drop above the pit floor (-1 + 0.75). */
const RIM_MIN_H = SHOWCASE_DEPTH + WALL_FACE_MIN_DROP;
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

/** Nearest non-Wall cell to local (0,0), by the same expanding Chebyshev-ring
 * spiral spawn.ts's findWalkableNear walks (out-of-chunk candidates skipped). */
export function entryAnchor(tiles: Uint8Array): Cell {
  for (let radius = 0; radius < CHUNK_SIZE; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        if (dx < 0 || dy < 0) continue;
        if ((tiles[dy * CHUNK_SIZE + dx] ?? TILE.Wall) !== TILE.Wall) return [dx, dy];
      }
    }
  }
  return [0, 0];
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
  const cells: Cell[] = [];
  for (let y = by - 1; y <= by + BLOCK; y++) {
    for (let x = bx - 1; x <= bx + BLOCK; x++) {
      const inBlock = x >= bx && x < bx + BLOCK && y >= by && y < by + BLOCK;
      if (!inBlock) cells.push([x, y]);
    }
  }
  return cells;
}

export function blockCells(bx: number, by: number): Cell[] {
  return [
    [bx, by],
    [bx + 1, by],
    [bx, by + 1],
    [bx + 1, by + 1],
  ];
}

/** All 4 block cells are Floor within EPS of `h`, ring fully inside the chunk. */
function blockAt(g: Grid, bx: number, by: number, h: number): boolean {
  if (bx < 1 || by < 1 || bx + BLOCK > CHUNK_SIZE - 1 || by + BLOCK > CHUNK_SIZE - 1) return false;
  return blockCells(bx, by).every(
    ([x, y]) => at(g.tiles, x, y) === TILE.Floor && Math.abs(at(g.height, x, y) - h) <= EPS,
  );
}

/** A clean z1 platform: 2x2 Floor at z1 whose whole ring is lower open ground. */
export function hasCleanPlatform(g: Grid, anchor: Cell): boolean {
  for (let by = 1; by < CHUNK_SIZE; by++) {
    for (let bx = 1; bx < CHUNK_SIZE; bx++) {
      if (blockDistance(anchor, bx, by) > SHOWCASE_RADIUS) continue;
      if (!blockAt(g, bx, by, SHOWCASE_RISE)) continue;
      const ok = ringCells(bx, by).every(
        ([x, y]) => at(g.tiles, x, y) !== TILE.Wall && at(g.height, x, y) <= RING_MAX_H + EPS,
      );
      if (ok) return true;
    }
  }
  return false;
}

/** A clean z-1 pit: 2x2 Floor at z-1, ring open, near-flat rim, >=1 rim stair tread. */
export function hasCleanPit(g: Grid, anchor: Cell): boolean {
  for (let by = 1; by < CHUNK_SIZE; by++) {
    for (let bx = 1; bx < CHUNK_SIZE; bx++) {
      if (blockDistance(anchor, bx, by) > SHOWCASE_RADIUS) continue;
      if (!blockAt(g, bx, by, SHOWCASE_DEPTH)) continue;
      let treads = 0;
      const ok = ringCells(bx, by).every(([x, y]) => {
        const t = at(g.tiles, x, y);
        if (t === TILE.Wall) return false;
        if (t === TILE.Stairs && Math.abs(at(g.height, x, y) - TREAD_H) <= EPS) {
          treads++;
          return true;
        }
        return at(g.height, x, y) >= RIM_MIN_H - EPS;
      });
      if (ok && treads >= 1) return true;
    }
  }
  return false;
}
