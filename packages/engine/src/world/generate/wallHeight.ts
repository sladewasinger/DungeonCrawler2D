// Wall-height finishing pass: every Wall tile rises WALL_RISE above its
// ground by default (a clean single jump, per core/constants.ts's z-scale
// doctrine) — EXCEPT a fully-enclosed interior fill cell (all 8 neighbors
// also Wall), which has no ground-facing side a player could ever stand
// against or jump onto. Those rise further, above the jump apex, so they
// read (and generate) as solid rock, not a secret rooftop. Rim/thin walls
// — anything with at least one open neighbor — keep the ordinary,
// jumpable WALL_RISE.

import { WALL_RISE } from "../../core/constants.js";
import { TILE } from "../types.js";

// Apex is ~1.07 (JUMP_VELOCITY^2 / 2*GRAVITY) — see walls.test.ts's own
// computation. 2 clears it with margin without inventing a new constant
// this file would have to keep in sync with the physics tuning.
export const INTERIOR_WALL_RISE = 2;

/** True when every one of (x, y)'s 8 neighbors is also Wall (out-of-chunk treated as Wall — a mass rarely ends exactly at a chunk seam). */
function isInteriorFill(tiles: Uint8Array, chunkSize: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= chunkSize || ny >= chunkSize) continue;
      if (tiles[ny * chunkSize + nx] !== TILE.Wall) return false;
    }
  }
  return true;
}

/** Raise every Wall tile: WALL_RISE for a rim/thin wall, INTERIOR_WALL_RISE for a fully-enclosed fill cell. */
export function applyWallHeight(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  for (let y = 0; y < chunkSize; y++) {
    for (let x = 0; x < chunkSize; x++) {
      const i = y * chunkSize + x;
      if (tiles[i] !== TILE.Wall) continue;
      const rise = isInteriorFill(tiles, chunkSize, x, y) ? INTERIOR_WALL_RISE : WALL_RISE;
      height[i] = (height[i] ?? 0) + rise;
    }
  }
}
