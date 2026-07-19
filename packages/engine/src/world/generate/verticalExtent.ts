// The z+1 vertical-extent rule (user-decreed 2026-07-19, docs/VISUAL_DIRECTION.md,
// ROADMAP.md Epic 7.7): a raised surface of height z must span >= z+1 tiles
// north-to-south, or it reads as all face and no platform. Two safety-net repair
// passes, run once after every other height/wall pass so they catch violations
// regardless of source (a corridor slicing a landmark tier, a pocket-sealing pass
// walling off a single tile, a mesa's tier ring pinched by a clearance guard).
// Door/portal cutouts are the rule's one intentional hole (VISUAL_DIRECTION.md) —
// both passes treat door tiles as a run boundary, never as something to fix.

import { WALL_FACE_MIN_DROP } from "../../core/constants.js";
import { TILE, type TileType } from "../types.js";

const HEIGHT_EPS = 0.01;
const MAX_PASSES = 4;

const DOOR_TILES: ReadonlySet<TileType> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

function tileAt(tiles: Uint8Array, chunkSize: number, x: number, y: number): TileType {
  return (tiles[y * chunkSize + x] ?? TILE.Wall) as TileType;
}

/** True for a tile a north-south run never spans across — a wall, a ramp, or a door cutout. */
function isRunBreak(tile: TileType): boolean {
  return tile === TILE.Wall || tile === TILE.Stairs || DOOR_TILES.has(tile);
}

/** The last row (inclusive) of the contiguous TILE.Wall run starting at (x, y). */
function wallRunEnd(tiles: Uint8Array, chunkSize: number, x: number, y: number): number {
  let y2 = y;
  while (y2 + 1 < chunkSize && tileAt(tiles, chunkSize, x, y2 + 1) === TILE.Wall) y2++;
  return y2;
}

/**
 * Thin free-standing walls merge into floor: a TILE.Wall run less than 2
 * deep, open to both its north AND south (strictly inside the chunk — a run
 * touching the chunk edge may continue, unknown, into the neighbor chunk, so
 * it's left alone), can never show a top cap distinct from its own face —
 * "all face, no platform" (VISUAL_DIRECTION.md). Merging is always
 * connectivity-safe: it only ever opens floor, never consumes it, so it
 * can't sever a room or corridor.
 */
export function resolveThinWalls(tiles: Uint8Array, chunkSize: number): void {
  for (let x = 0; x < chunkSize; x++) {
    let y = 0;
    while (y < chunkSize) {
      if (tileAt(tiles, chunkSize, x, y) !== TILE.Wall) {
        y++;
        continue;
      }
      const y2 = wallRunEnd(tiles, chunkSize, x, y);
      const northOpen = y > 0 && tileAt(tiles, chunkSize, x, y - 1) !== TILE.Wall;
      const southOpen = y2 < chunkSize - 1 && tileAt(tiles, chunkSize, x, y2 + 1) !== TILE.Wall;
      const isThin = y2 - y + 1 < 2;
      if (isThin && northOpen && southOpen) {
        for (let yy = y; yy <= y2; yy++) tiles[yy * chunkSize + x] = TILE.Floor;
      }
      y = y2 + 1;
    }
  }
}

/** True when (x, y) can START a floor-plateau run: real floor, a whole-number height >= 1. */
function startsPlateau(tiles: Uint8Array, height: Float32Array, chunkSize: number, x: number, y: number): boolean {
  const t = tileAt(tiles, chunkSize, x, y);
  const h = height[y * chunkSize + x] ?? 0;
  const rounded = Math.round(h);
  return !isRunBreak(t) && rounded >= 1 && Math.abs(h - rounded) <= HEIGHT_EPS;
}

/** The last row (inclusive) of the same-height plateau run starting at (x, y0) with height h. */
function plateauRunEnd(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  x: number,
  y0: number,
  h: number,
): number {
  let y2 = y0;
  while (y2 + 1 < chunkSize) {
    const nt = tileAt(tiles, chunkSize, x, y2 + 1);
    const nh = height[(y2 + 1) * chunkSize + x] ?? 0;
    if (isRunBreak(nt) || Math.abs(nh - h) > HEIGHT_EPS) break;
    y2++;
  }
  return y2;
}

/** One column's next same-height plateau run at/after `y0`, or null past the chunk edge. */
function nextFloorRun(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  x: number,
  y0: number,
): { y: number; y2: number; h: number } | null {
  let y = y0;
  while (y < chunkSize && !startsPlateau(tiles, height, chunkSize, x, y)) y++;
  if (y >= chunkSize) return null;
  const rounded = Math.round(height[y * chunkSize + x] ?? 0);
  return { y, y2: plateauRunEnd(tiles, height, chunkSize, x, y, rounded), h: rounded };
}

/** Whether a run of height `h` ending at `y2` drops to genuinely open ground just south of it. */
function dropsToOpenGround(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
  x: number,
  y2: number,
  h: number,
): boolean {
  if (y2 >= chunkSize - 1) return false; // chunk-edge truncated: true depth unknown, leave it
  const southT = tileAt(tiles, chunkSize, x, y2 + 1);
  const southH = height[(y2 + 1) * chunkSize + x] ?? 0;
  return !isRunBreak(southT) && h - southH >= WALL_FACE_MIN_DROP;
}

/**
 * A raised FLOOR plateau shallower than its own height demands gets clamped
 * down to the tallest height its actual depth supports. Never widened into a
 * neighbor — that could eat a corridor's guaranteed path or another
 * feature's footprint — only shrunk, so this is safe no matter why the run
 * came up short. Run depth is unchanged; only its height drops, which can
 * only ever shrink a required-depth number that was already satisfied by
 * construction, never break a taller run beside it (that run's own
 * requirement depends only on its own height and depth, never its
 * neighbor's).
 */
function resolveShallowPlateausOnce(tiles: Uint8Array, height: Float32Array, chunkSize: number): boolean {
  let changed = false;
  for (let x = 0; x < chunkSize; x++) {
    let y = 0;
    let run = nextFloorRun(tiles, height, chunkSize, x, y);
    while (run) {
      const depth = run.y2 - run.y + 1;
      const shallow = depth < run.h + 1 && dropsToOpenGround(tiles, height, chunkSize, x, run.y2, run.h);
      if (shallow) {
        const capped = Math.max(0, depth - 1);
        for (let yy = run.y; yy <= run.y2; yy++) height[yy * chunkSize + x] = capped;
        changed = true;
      }
      y = run.y2 + 1;
      run = nextFloorRun(tiles, height, chunkSize, x, y);
    }
  }
  return changed;
}

export function resolveShallowPlateaus(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (!resolveShallowPlateausOnce(tiles, height, chunkSize)) return;
  }
}
