// Wall-height finishing pass: every Wall tile rises WALL_RISE above its
// ground by default (a clean single jump, per core/constants.ts's z-scale
// doctrine) — EXCEPT a fully-enclosed interior fill cell (all 8 neighbors
// also Wall), which has no ground-facing side a player could ever stand
// against or jump onto. Those rise further, above the jump apex, so they
// read (and generate) as deep raised terrain, not a secret rooftop. Rim/thin boundaries
// — anything with at least one open neighbor — keep the ordinary,
// jumpable WALL_RISE.

import { WALL_RISE } from "../../../core/constants.js";
import { TOPOLOGY } from "../../core/types.js";
import { WORLD_GENERATION_TUNING } from "../tuning.js";

// Apex is ~1.07 (JUMP_VELOCITY^2 / 2*GRAVITY) — see walls.test.ts's own
// computation. 2 clears it with margin without inventing a new constant
// this file would have to keep in sync with the physics tuning.
export const INTERIOR_WALL_RISE =
  WORLD_GENERATION_TUNING.heightFeatures.interiorWallRise;
const ADJACENT_OFFSETS = [
  [-1, -1], [0, -1], [1, -1], [-1, 0],
  [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;

interface HeightGrid {
  tiles: Uint8Array;
  height: Float32Array;
  chunkSize: number;
}

function highestAdjacentHeight({ height, chunkSize, x, y }: Pick<HeightGrid, "height" | "chunkSize"> & { x: number; y: number }): number | null {
  let highest: number | null = null;
  for (const [dx, dy] of ADJACENT_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= chunkSize || ny >= chunkSize) continue;
    highest = Math.max(highest ?? -Infinity, height[ny * chunkSize + nx] ?? 0);
  }
  return highest;
}

function capVoidTowers({ tiles, height, chunkSize }: HeightGrid): void {
  for (let pass = 0; pass < chunkSize; pass++) {
    if (!capVoidTowerPass({ tiles, height, chunkSize })) return;
  }
}

function capVoidTowerPass({ tiles, height, chunkSize }: HeightGrid): boolean {
  const before = height.slice();
  let changed = false;
  for (let y = 0; y < chunkSize; y++) changed = capVoidTowerRow({ tiles, height, before, chunkSize, y }) || changed;
  return changed;
}

function capVoidTowerRow({ tiles, height, before, chunkSize, y }: HeightGrid & { before: Float32Array; y: number }): boolean {
  let changed = false;
  for (let x = 0; x < chunkSize; x++) changed = capVoidTowerCell({ tiles, height, before, chunkSize, x, y }) || changed;
  return changed;
}

function capVoidTowerCell({ tiles, height, before, chunkSize, x, y }: HeightGrid & { before: Float32Array; x: number; y: number }): boolean {
  const index = y * chunkSize + x;
  if (tiles[index] !== TOPOLOGY.Uncarved) return false;
  const adjacent = highestAdjacentHeight({ height: before, chunkSize, x, y });
  if (adjacent === null || (height[index] ?? 0) <= adjacent + 1) return false;
  height[index] = adjacent + 1;
  return true;
}

/** True when every one of (x, y)'s 8 neighbors is also Wall (out-of-chunk treated as Wall — a mass rarely ends exactly at a chunk seam). */
function isInteriorFill({ tiles, chunkSize, x, y }: Pick<HeightGrid, "tiles" | "chunkSize"> & { x: number; y: number }): boolean {
  return ADJACENT_OFFSETS.every(([dx, dy]) => isWallOrOutside({ tiles, chunkSize, x: x + dx, y: y + dy }));
}

function isWallOrOutside({ tiles, chunkSize, x, y }: Pick<HeightGrid, "tiles" | "chunkSize"> & { x: number; y: number }): boolean {
  if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) return true;
  return tiles[y * chunkSize + x] === TOPOLOGY.Uncarved;
}

/** Raise every Wall tile: WALL_RISE for a rim/thin wall, INTERIOR_WALL_RISE for a fully-enclosed fill cell. */
export function applyWallHeight(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  for (let y = 0; y < chunkSize; y++) applyWallHeightRow({ tiles, height, chunkSize, y });
  capVoidTowers({ tiles, height, chunkSize });
}

function applyWallHeightRow({ tiles, height, chunkSize, y }: HeightGrid & { y: number }): void {
  for (let x = 0; x < chunkSize; x++) applyWallHeightCell({ tiles, height, chunkSize, x, y });
}

function applyWallHeightCell({ tiles, height, chunkSize, x, y }: HeightGrid & { x: number; y: number }): void {
  const index = y * chunkSize + x;
  if (tiles[index] !== TOPOLOGY.Uncarved) return;
  const rise = isInteriorFill({ tiles, chunkSize, x, y }) ? INTERIOR_WALL_RISE : WALL_RISE;
  height[index] = (height[index] ?? 0) + rise;
}
