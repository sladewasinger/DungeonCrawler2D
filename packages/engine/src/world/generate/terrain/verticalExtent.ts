// The z+1 vertical-extent rule (user-decreed 2026-07-19, docs/VISUAL_DIRECTION.md,
// ROADMAP.md Epic 7.7): a raised surface of height z must span >= z+1 tiles
// north-to-south, or it reads as all face and no platform. Two safety-net repair
// passes, run once after every other height/wall pass so they catch violations
// regardless of source (a corridor slicing a landmark tier, a pocket-sealing pass
// walling off a single tile, a mesa's tier ring pinched by a clearance guard).
// Door/portal cutouts are the rule's one intentional hole (VISUAL_DIRECTION.md) —
// both passes treat door tiles as a run boundary, never as something to fix.

import { WALL_FACE_MIN_DROP } from "../../../core/constants.js";
import { TILE, TOPOLOGY } from "../../core/types.js";

const HEIGHT_EPS = 0.01;
const MAX_PASSES = 4;

/** Minimum north-to-south floor span that can visually support a raised cap. */
export function minimumRaisedSurfaceDepth(height: number): number {
  return Math.max(1, Math.round(height) + 1);
}

interface HeightGrid {
  tiles: Uint8Array;
  height: Float32Array;
  chunkSize: number;
}

const DOOR_TILES: ReadonlySet<number> = new Set([
  TILE.DoorSafeRoom,
  TILE.DoorPersonal,
  TILE.DoorParty,
  TILE.DoorExit,
]);

function tileAt({ tiles, chunkSize, x, y }: Pick<HeightGrid, "tiles" | "chunkSize"> & { x: number; y: number }): number {
  return tiles[y * chunkSize + x] ?? TOPOLOGY.Uncarved;
}

/** True for a tile a north-south run never spans across — a wall, a ramp, or a door cutout. */
function isRunBreak(tile: number): boolean {
  return tile === TOPOLOGY.Uncarved ||
    tile === TILE.Void ||
    tile === TILE.Bedrock ||
    tile === TILE.Stairs ||
    DOOR_TILES.has(tile);
}

/** The last row (inclusive) of the contiguous TOPOLOGY.Uncarved run starting at (x, y). */
function wallRunEnd({ tiles, chunkSize, x, y }: Pick<HeightGrid, "tiles" | "chunkSize"> & { x: number; y: number }): number {
  let y2 = y;
  while (y2 + 1 < chunkSize && tileAt({ tiles, chunkSize, x, y: y2 + 1 }) === TOPOLOGY.Uncarved) y2++;
  return y2;
}

/**
 * Thin free-standing walls merge into floor: a TOPOLOGY.Uncarved run less than 2
 * deep, open to both its north AND south (strictly inside the chunk — a run
 * touching the chunk edge may continue, unknown, into the neighbor chunk, so
 * it's left alone), can never show a top cap distinct from its own face —
 * "all face, no platform" (VISUAL_DIRECTION.md). Merging is always
 * connectivity-safe: it only ever opens floor, never consumes it, so it
 * can't sever a room or corridor.
 */
export function resolveThinWalls(tiles: Uint8Array, chunkSize: number): void {
  for (let x = 0; x < chunkSize; x++) resolveThinWallsColumn({ tiles, chunkSize, x });
}

function resolveThinWallsColumn({ tiles, chunkSize, x }: { tiles: Uint8Array; chunkSize: number; x: number }): void {
  for (let y = 0; y < chunkSize;) {
    const run = thinWallRunAt({ tiles, chunkSize, x, y });
    if (run) replaceWallRunWithFloor({ tiles, chunkSize, x, y, y2: run.y2 });
    y = run ? run.y2 + 1 : y + 1;
  }
}

function thinWallRunAt({ tiles, chunkSize, x, y }: { tiles: Uint8Array; chunkSize: number; x: number; y: number }): { y2: number } | null {
  if (tileAt({ tiles, chunkSize, x, y }) !== TOPOLOGY.Uncarved) return null;
  const y2 = wallRunEnd({ tiles, chunkSize, x, y });
  return isThinWallRun({ tiles, chunkSize, x, y, y2 }) ? { y2 } : null;
}

function isThinWallRun({ tiles, chunkSize, x, y, y2 }: { tiles: Uint8Array; chunkSize: number; x: number; y: number; y2: number }): boolean {
  const northOpen = y > 0 && tileAt({ tiles, chunkSize, x, y: y - 1 }) !== TOPOLOGY.Uncarved;
  const southOpen = y2 < chunkSize - 1 && tileAt({ tiles, chunkSize, x, y: y2 + 1 }) !== TOPOLOGY.Uncarved;
  return y2 === y && northOpen && southOpen;
}

function replaceWallRunWithFloor({ tiles, chunkSize, x, y, y2 }: { tiles: Uint8Array; chunkSize: number; x: number; y: number; y2: number }): void {
  for (let yy = y; yy <= y2; yy++) tiles[yy * chunkSize + x] = TILE.Floor;
}

/** True when (x, y) can START a floor-plateau run: real floor, a whole-number height >= 1. */
function startsPlateau({ tiles, height, chunkSize, x, y }: HeightGrid & { x: number; y: number }): boolean {
  const t = tileAt({ tiles, chunkSize, x, y });
  const h = height[y * chunkSize + x] ?? 0;
  const rounded = Math.round(h);
  return !isRunBreak(t) && rounded >= 1 && Math.abs(h - rounded) <= HEIGHT_EPS;
}

/** The last row (inclusive) of the same-height plateau run starting at (x, y0) with height h. */
function plateauRunEnd({ tiles, height, chunkSize, x, y0, h }: HeightGrid & { x: number; y0: number; h: number }): number {
  let y2 = y0;
  while (y2 + 1 < chunkSize) {
    const nt = tileAt({ tiles, chunkSize, x, y: y2 + 1 });
    const nh = height[(y2 + 1) * chunkSize + x] ?? 0;
    if (isRunBreak(nt) || Math.abs(nh - h) > HEIGHT_EPS) break;
    y2++;
  }
  return y2;
}

/** One column's next same-height plateau run at/after `y0`, or null past the chunk edge. */
function nextFloorRun({ tiles, height, chunkSize, x, y0 }: HeightGrid & { x: number; y0: number }): { y: number; y2: number; h: number } | null {
  let y = y0;
  while (y < chunkSize && !startsPlateau({ tiles, height, chunkSize, x, y })) y++;
  if (y >= chunkSize) return null;
  const rounded = Math.round(height[y * chunkSize + x] ?? 0);
  return { y, y2: plateauRunEnd({ tiles, height, chunkSize, x, y0: y, h: rounded }), h: rounded };
}

/** Whether a run of height `h` ending at `y2` drops to genuinely open ground just south of it. */
function dropsToOpenGround({ tiles, height, chunkSize, x, y2, h }: HeightGrid & { x: number; y2: number; h: number }): boolean {
  if (y2 >= chunkSize - 1) return false; // chunk-edge truncated: true depth unknown, leave it
  const southT = tileAt({ tiles, chunkSize, x, y: y2 + 1 });
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
  for (let x = 0; x < chunkSize; x++) changed = resolveShallowPlateausColumn({ tiles, height, chunkSize, x }) || changed;
  return changed;
}

function resolveShallowPlateausColumn({ tiles, height, chunkSize, x }: HeightGrid & { x: number }): boolean {
  let changed = false;
  for (let y = 0; y < chunkSize;) {
    const run = nextFloorRun({ tiles, height, chunkSize, x, y0: y });
    if (!run) return changed;
    changed = capShallowRun({ tiles, height, chunkSize, x, run }) || changed;
    y = run.y2 + 1;
  }
  return changed;
}

function capShallowRun({ tiles, height, chunkSize, x, run }: HeightGrid & { x: number; run: { y: number; y2: number; h: number } }): boolean {
  const depth = run.y2 - run.y + 1;
  if (depth >= minimumRaisedSurfaceDepth(run.h) ||
      !dropsToOpenGround({ tiles, height, chunkSize, x, y2: run.y2, h: run.h })) return false;
  const capped = Math.max(0, depth - 1);
  for (let y = run.y; y <= run.y2; y++) height[y * chunkSize + x] = capped;
  return true;
}

export function resolveShallowPlateaus(
  tiles: Uint8Array,
  height: Float32Array,
  chunkSize: number,
): boolean {
  let changed = false;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const passChanged = resolveShallowPlateausOnce(tiles, height, chunkSize);
    if (!passChanged) return changed;
    changed = true;
  }
  return changed;
}
