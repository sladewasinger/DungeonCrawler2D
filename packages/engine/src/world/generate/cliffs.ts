// Safety net after room/corridor/height stamping: a corridor between two
// rooms can graze a third room's rect in between (BSP can stack rooms in
// a column) without an explicit doorway there, leaving an un-ramped
// height jump at that room's boundary. Sweep the grid and ramp any
// orthogonally-adjacent pair that violates the STEP_UP walk rule but is
// still SHORT of a full deliberate tier (WALL_RISE/ROOM_RISE, the
// jump-apex-gated step every other system in this generator uses) — the
// same after-the-fact cleanup sealInteriorPockets does for wall topology.
// A full-tier-or-taller edge (a room's own un-ramped secondary doorway, a
// landmark tier boundary) is left sheer ON PURPOSE: those are deliberate
// jump gates (height.ts's one-staircase-per-room rule, the tower's
// "climbable tier by tier" doc comment), not accidents this net should
// paper over with an ad hoc stair fan.

import { STEP_UP, WALL_RISE } from "../../core/constants.js";
import { entryClimbDir, stairRampAt, type StairView } from "../stairs.js";
import { TILE } from "../types.js";
import { MAX_STAIR_SLOPE } from "./height.js";

const MAX_PASSES = 8;
// Deltas at or above this are a deliberate jump-gated tier, not an
// accidental graze — see the module doc.
const MAX_AUTO_RAMP_DELTA = WALL_RISE;

export function repairCliffs(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    if (!sweep(tiles, height, chunkSize)) return;
  }
}

/**
 * Final safety net, run once after all authoring and repair passes: a
 * Stairs tile can still end up with no valid climb axis at a corner where
 * several unrelated height regions meet (e.g. a ramp's second width-column
 * losing its flat far neighbor to a corridor bend) — geometry no single
 * pass fully anticipates. Such a tile provides zero ramping value already
 * (stairRampAt only reads a Stairs tile via a valid entryClimbDir), so
 * keeping it tagged Stairs is pure downside: a rule-1 violation
 * (stairsInvariant.test.ts) and render clutter (dangling tread art) for no
 * gameplay benefit. Demote it back to plain Floor at its current height —
 * a real, if occasionally un-ramped, edge, exactly like any other
 * un-ramped secondary doorway.
 */
export function demoteOrphanedStairs(tiles: Uint8Array, height: Float32Array, chunkSize: number): void {
  const view = localView(tiles, height, chunkSize);
  for (let y = 0; y < chunkSize; y++) {
    for (let x = 0; x < chunkSize; x++) {
      const i = y * chunkSize + x;
      if (tiles[i] === TILE.Stairs && entryClimbDir(view, x, y) === null) tiles[i] = TILE.Floor;
    }
  }
}

/** Read-only chunk-local StairView so an edge already smoothed by an authored ramp's virtual padding (world/stairs.ts's RUN_PADDING) isn't re-flagged. */
function localView(tiles: Uint8Array, height: Float32Array, chunkSize: number): StairView {
  const at = (arr: Uint8Array | Float32Array, x: number, y: number, fallback: number): number => {
    if (x < 0 || y < 0 || x >= chunkSize || y >= chunkSize) return fallback;
    return arr[y * chunkSize + x] ?? fallback;
  };
  return {
    tileAt: (x, y) => at(tiles, x, y, TILE.Wall),
    heightAt: (x, y) => at(height, x, y, 0),
  };
}

/** One east+south sweep; ramps every violating edge one slope-step at a time. Returns whether anything changed. */
function sweep(tiles: Uint8Array, height: Float32Array, chunkSize: number): boolean {
  let changed = false;
  const view = localView(tiles, height, chunkSize);
  for (let y = 0; y < chunkSize; y++) {
    for (let x = 0; x < chunkSize; x++) {
      const i = y * chunkSize + x;
      if (tiles[i] === TILE.Wall) continue;
      if (x + 1 < chunkSize && ramp(tiles, height, view, i, i + 1, x + 1, y)) changed = true;
      if (y + 1 < chunkSize && ramp(tiles, height, view, i, i + chunkSize, x, y + 1)) changed = true;
    }
  }
  return changed;
}

/**
 * If the edge (i, n) exceeds the walk rule but stays under a full
 * deliberate tier, pull `n` one MAX_STAIR_SLOPE step toward `i` — a
 * uniform-slope tread, not a halving cascade (a halved-each-pass step
 * shrinks geometrically, littering ever-smaller fractional-height flecks
 * along the edge instead of one clean short run). Skips edges an authored
 * ramp already smooths via its virtual padding (an adjacent Stairs tile's
 * RUN_PADDING reach) — re-stamping those produces a redundant Stairs tile
 * with no real delta on its far side (a second "flavor without height"
 * source; see stairsInvariant.test.ts).
 */
function ramp(
  tiles: Uint8Array,
  height: Float32Array,
  view: StairView,
  i: number,
  n: number,
  nx: number,
  ny: number,
): boolean {
  if (tiles[n] === TILE.Wall) return false;
  const hi = height[i] ?? 0;
  const hn = height[n] ?? 0;
  const delta = hn - hi;
  const magnitude = Math.abs(delta);
  // A gap already at or under one slope-step needs no ramp: a single
  // MAX_STAIR_SLOPE-sized step (over STEP_UP but a small graceful fall,
  // well under SAFE_FALL_HEIGHT) is fine left sheer. Tagging it Stairs
  // here would move `n` to EXACTLY its own pre-existing height (a no-op)
  // — a Stairs tile with no real delta on its far side, the same "flavor
  // without height" bug this net must not introduce.
  if (magnitude <= STEP_UP || magnitude <= MAX_STAIR_SLOPE || magnitude >= MAX_AUTO_RAMP_DELTA) return false;
  const alreadyRamped = stairRampAt(view, nx + 0.5, ny + 0.5);
  if (alreadyRamped !== null && Math.abs(alreadyRamped - hi) <= STEP_UP) return false;
  const step = Math.sign(delta) * MAX_STAIR_SLOPE;
  height[n] = hi + step;
  tiles[n] = TILE.Stairs;
  return true;
}
