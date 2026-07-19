// Safety net after room/corridor/height stamping: a corridor between two
// rooms can graze a third room's rect in between (BSP can stack rooms in
// a column) without an explicit doorway there, leaving an un-ramped
// height jump at that room's boundary — the same is true of a chasm
// room's boundary, whose drop is deliberately too steep for a single
// stair tile. Rather than trying to route corridors/thresholds around
// every case, sweep the grid and ramp any orthogonally-adjacent pair that
// violates the STEP_UP walk rule — the same after-the-fact cleanup
// sealInteriorPockets does for wall topology.

import { STEP_UP } from "../../core/constants.js";
import { TILE } from "../types.js";

const MAX_PASSES = 8;

export function repairCliffs(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (!sweep(tiles, height, chunkSize)) return;
  }
}

/** One east+south sweep; ramps every violating edge toward its midpoint. Returns whether anything changed. */
function sweep(tiles: Uint8Array, height: Float32Array, chunkSize: number): boolean {
  let changed = false;
  for (let y = 0; y < chunkSize; y++) {
    for (let x = 0; x < chunkSize; x++) {
      const i = y * chunkSize + x;
      if (tiles[i] === TILE.Wall) continue;
      if (x + 1 < chunkSize && ramp(tiles, height, i, i + 1)) changed = true;
      if (y + 1 < chunkSize && ramp(tiles, height, i, i + chunkSize)) changed = true;
    }
  }
  return changed;
}

/** If the edge (i, n) exceeds the walk rule, pull `n` toward `i` — a single-tile ramp. */
function ramp(tiles: Uint8Array, height: Float32Array, i: number, n: number): boolean {
  if (tiles[n] === TILE.Wall) return false;
  const hi = height[i] ?? 0;
  const hn = height[n] ?? 0;
  const delta = hn - hi;
  if (Math.abs(delta) <= STEP_UP) return false;
  height[n] = hi + delta / 2;
  tiles[n] = TILE.Stairs;
  return true;
}
