import { TILE } from "./types.js";

/** Continuous ground ramping across a staircase's physical run of tiles. */

export interface StairView {
  tileAt(wx: number, wy: number): number;
  heightAt(wx: number, wy: number): number;
}

interface Dir {
  readonly dx: number;
  readonly dy: number;
}

/** Index convention every caller (generator + client renderer) shares: 0=N, 1=E, 2=S, 3=W. */
const DIRS: readonly Dir[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

// Floating-point noise guard only — NOT a design band. A prior version
// required the rise/drop to fall within a fixed magnitude window tuned for
// one specific ramp shape (a lone half-height threshold tile); any other
// authored slope (a multi-tile chasm run, a repaired cliff) landed outside
// that window and silently failed to detect, presenting players a full
// undetected step. Climb direction is a SIGN question — which neighbor is
// higher, which is lower — never a magnitude one.
const DELTA_EPSILON = 0.01;

// Retired to 0 (docs/R2-STAIRS-SPEC.md, Wave R2 compact stairs — Austin's
// ruling: a pit stair reads as one rim-straddling tile, never a multi-tile
// runway). Was 1.5: a virtual flat-approach extension so a body's per-tick
// rise while walking a shallow multi-tile run never brushed STEP_UP. That
// problem is now solved differently and more generally — the on-stair
// GLIDE (entities/movement/physics.ts) ignores STEP_UP entirely while
// grounded on a real Stairs tile, so no virtual padding is needed to keep
// climbing smooth, and a lone tile's ramp is now exactly its own physical
// extent: flush with the low neighbor at one edge, the high neighbor at
// the other, nothing beyond. Kept as a named constant (not deleted/inlined)
// so `runLength = run.length + RUN_PADDING` and `stairVisualAt`'s matching
// formula stay self-documenting about why the term is still there at 0.
const RUN_PADDING = 0;

/** How far (tiles) to look, from a query position that isn't itself on a run, for the nearest one. */
const RUN_SEARCH_RADIUS = 2;

/**
 * Climb direction (index into DIRS) at a Stairs tile: the direction whose
 * immediate neighbor is strictly higher, with the OPPOSITE neighbor
 * strictly lower. This holds identically for a lone threshold tile
 * (flanked by two flat Floor tiles) and for an interior tile of a longer
 * physical run (flanked by two more Stairs tiles one slope-step up/down
 * the same climb) — no special-casing which neighbor type is adjacent.
 * Returns null off a Stairs tile, or where neither axis straddles this
 * tile's own height (a ramp's SIDE, which legitimately has no climb
 * direction — see collision.ts's leading-corner gate; that's a real wall,
 * not a detection gap).
 */
export function entryClimbDir(world: StairView, wx: number, wy: number): number | null {
  if (world.tileAt(wx, wy) !== TILE.Stairs) return null;
  const h = world.heightAt(wx, wy);
  for (let direction = 0; direction < DIRS.length; direction++) {
    const dir = DIRS[direction];
    if (!dir) continue;
    const rise = world.heightAt(wx + dir.dx, wy + dir.dy) - h;
    const drop = world.heightAt(wx - dir.dx, wy - dir.dy) - h;
    if (rise > DELTA_EPSILON && drop < -DELTA_EPSILON) return direction;
  }
  return null;
}

interface StairRun {
  /** World coords of the run's topmost (highest) physical Stairs tile. */
  readonly topX: number;
  readonly topY: number;
  /** DIRS[direction] points from the top tile toward still-higher ground. */
  readonly direction: number;
  /** Count of physical Stairs tiles in the chain (>= 1). */
  readonly length: number;
}

/** Expand one confirmed chain tile to the run's full physical extent by walking while neighbors stay Stairs. */
function buildRun(world: StairView, x: number, y: number, direction: number): StairRun {
  const dir = DIRS[direction];
  if (!dir) return { topX: x, topY: y, direction, length: 1 };
  let topX = x;
  let topY = y;
  let forwardSteps = 0;
  while (world.tileAt(topX + dir.dx, topY + dir.dy) === TILE.Stairs) {
    topX += dir.dx;
    topY += dir.dy;
    forwardSteps++;
  }
  let backwardSteps = 0;
  let bx = x;
  let by = y;
  while (world.tileAt(bx - dir.dx, by - dir.dy) === TILE.Stairs) {
    bx -= dir.dx;
    by -= dir.dy;
    backwardSteps++;
  }
  // +1 for the tile (x, y) itself, which both walks started from.
  return { topX, topY, direction, length: forwardSteps + backwardSteps + 1 };
}

/** Find the nearest run reachable from (tx, ty), searching outward along each candidate axis. */
function stairRunAt(world: StairView, tx: number, ty: number): StairRun | null {
  for (let direction = 0; direction < DIRS.length; direction++) {
    const dir = DIRS[direction];
    if (!dir) continue;
    for (let offset = 0; offset <= RUN_SEARCH_RADIUS; offset++) {
      const sx = tx + dir.dx * offset;
      const sy = ty + dir.dy * offset;
      if (entryClimbDir(world, sx, sy) === direction) return buildRun(world, sx, sy, direction);
    }
  }
  return null;
}

/** Signed distance from the run's high edge (0 at the edge, growing toward the low end). */
function distanceFromTopEdge(run: StairRun, x: number, y: number): number {
  switch (run.direction) {
    case 0:
      return run.topY - y;
    case 1:
      return x - (run.topX + 1);
    case 2:
      return y - (run.topY + 1);
    default:
      return run.topX - x;
  }
}

export function stairRampAt(world: StairView, x: number, y: number): number | null {
  const run = stairRunAt(world, Math.floor(x), Math.floor(y));
  if (!run) return null;
  const dir = DIRS[run.direction];
  if (!dir) return null;
  const runLength = run.length + RUN_PADDING;
  const high = world.heightAt(run.topX + dir.dx, run.topY + dir.dy);
  const low = world.heightAt(run.topX - dir.dx * run.length, run.topY - dir.dy * run.length);
  const t = (distanceFromTopEdge(run, x, y) + runLength) / runLength;
  if (t < 0) return null;
  return low + (high - low) * Math.min(1, t);
}

/** A tile's place on a staircase's visual run, for the renderer's tread art —
 * with RUN_PADDING retired to 0 this is non-null ONLY on a run's own
 * physical Stairs tile(s): a lone rim-adjacent tread reads as exactly one
 * tile's worth of tread art, never a flanking floor tile beyond it (the
 * "no runway" ruling this section's decision summary describes). */
export interface StairVisual {
  /** DIRS index this run climbs toward (its high end). */
  readonly direction: number;
  /** 0 at the run's own low (physical) edge, 1 at its topmost physical tread. */
  readonly t: number;
}

export function stairVisualAt(world: StairView, wx: number, wy: number): StairVisual | null {
  const run = stairRunAt(world, wx, wy);
  if (!run) return null;
  const runLength = run.length + RUN_PADDING;
  const raw = (distanceFromTopEdge(run, wx + 0.5, wy + 0.5) + runLength) / runLength;
  // Unlike the old padded search, a query outside the run's own physical
  // extent must read as "no visual here" (null), not a clamped 0/1 ghost —
  // stairRunAt's RUN_SEARCH_RADIUS still LOOKS outward for a run from a
  // non-run tile (kept for stairRampAt's own null-vs-flush boundary math
  // above), but with no padding a found run's valid [0, 1] span is exactly
  // its physical tiles, so anything outside that range is genuinely off
  // the run, not a fading approach.
  if (raw < 0 || raw > 1) return null;
  return { direction: run.direction, t: raw };
}
