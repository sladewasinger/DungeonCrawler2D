import { STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import type { BodyState } from "./state.js";

/**
 * The stair horizontal-walkability rule (docs/R2-STAIRS-SPEC.md section 3d),
 * split out of collision.ts to keep that file under the repo's line budget.
 */

// Sampling gap on each side of a stair tile boundary, in tiles — small
// enough to stay within the near/far tile it's meant to probe, far enough
// to clear float-equality noise exactly at the boundary.
const STAIR_RIM_PROBE = 0.01;

/** True when (x1,y1) and (x2,y2) fall in the same tile — an intra-tile move never crosses a boundary. */
function sameTile(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.floor(x1) === Math.floor(x2) && Math.floor(y1) === Math.floor(y2);
}

/**
 * On a compact 1.0-slope stair, consecutive foot-center heights differ by
 * 0.4-0.6 per tick (walk/run) — both over STEP_UP — so no foot-to-foot
 * comparison can ever gate a stair without also blocking ordinary climbing.
 * The gate instead tests the BOUNDARY the move crosses this tick: sample
 * groundAt immediately on each side of that tile edge, along the move axis,
 * and block only if that boundary itself is a real discontinuity (a raised
 * ramp's flank, entered from the side) rather than the ramp's own slope
 * (entered along its climb axis, where near/far agree to within the flush
 * seam). Along-axis travel and flat-to-stair entry at a flush edge read
 * near-zero; stepping into a ramp's perpendicular side reads up to ~1
 * (correctly blocked, a real wall); stepping off the ramp's side onto lower
 * flanking floor reads negative (drops are free).
 */
function stairRimBlocks(world: WorldView, body: BodyState, dx: number, dy: number): boolean {
  const sign = Math.sign(dx !== 0 ? dx : dy);
  const axisPos = dx !== 0 ? body.x : body.y;
  const boundary = sign > 0 ? Math.floor(axisPos) + 1 : Math.floor(axisPos);
  const nearAxis = boundary - sign * STAIR_RIM_PROBE;
  const farAxis = boundary + sign * STAIR_RIM_PROBE;
  const near = dx !== 0 ? world.groundAt(nearAxis, body.y) : world.groundAt(body.x, nearAxis);
  const far = dx !== 0 ? world.groundAt(farAxis, body.y) : world.groundAt(body.x, farAxis);
  return far - near > STEP_UP;
}

/**
 * True iff a grounded move into corner (cx, cy) should be BLOCKED under the
 * stair rule, given the body is currently on a stair or moving onto one.
 * An intra-tile move never crosses a boundary, so it's always allowed here.
 */
export function stairGateBlocks(
  world: WorldView,
  body: BodyState,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  if (sameTile(body.x, body.y, cx, cy)) return false;
  return stairRimBlocks(world, body, dx, dy);
}
