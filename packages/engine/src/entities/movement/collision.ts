import { AIRBORNE_LEDGE_CLEARANCE, KNOCKBACK_DECAY, STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import {
  BODY_RADIUS,
  CORNER_SLIDE_WINDOW,
  type BodyState,
  type MoveInput,
  type StepOpts,
} from "./state.js";

/**
 * Horizontal step + tile collision: knockback blending, diagonal
 * normalization, the leading-edge corner check that keeps bodies out of
 * raised terrain while letting stairs ramp underfoot, and the corner-
 * slide assist that turns an off-center approach to a 1-wide gap into a
 * smooth entry instead of a wall.
 */

/** Scan resolution for the corner-slide search, in tiles. Small enough
 * that the nudge lands within a fraction of a pixel of the true gap
 * edge; cheap since the search only runs on a blocked tick. */
const CORNER_SLIDE_PROBE_STEP = 0.01;

function clampAxis(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

// Leading-edge corners in the movement direction (the trailing side was
// already valid). Both corners must accept the move.
function leadingCorners(
  body: BodyState,
  dx: number,
  dy: number,
  nx: number,
  ny: number,
): Array<[number, number]> {
  const ex = nx + Math.sign(dx) * BODY_RADIUS;
  const ey = ny + Math.sign(dy) * BODY_RADIUS;
  return dx !== 0
    ? [
        [ex, body.y - BODY_RADIUS],
        [ex, body.y + BODY_RADIUS],
      ]
    : [
        [body.x - BODY_RADIUS, ey],
        [body.x + BODY_RADIUS, ey],
      ];
}

// Continuous ground: stair tiles ramp with position. The grounded gate
// compares the corner's target terrain against the body's OWN current z —
// how far it must rise to stand there — not against groundAt some nearby
// "before" point. That nearby-point version used to reconstruct the
// pre-move corner as (cx - dx, cy - dy), but BODY_RADIUS pushes a
// diagonal leading corner across two tile boundaries (the direction of
// travel AND the perpendicular one) at once: for a lone raised corner
// tile that is diagonally adjacent to the body's start position, both
// the target corner and its "before" point can land on that SAME
// too-tall tile, netting a false zero rise and letting a grounded body
// walk straight up a cliff it was only ever diagonally brushing. Body.z
// has no such blind spot, and stays safe for real ramps too: current
// content's steepest ramp (rise 2 over STAIR_RUN_LENGTH 2.5) only rises
// ~(BODY_RADIUS + one tick's travel) * slope ahead of the body each
// step, well under STEP_UP.
function cornerBlocksMove(
  world: WorldView,
  body: BodyState,
  cx: number,
  cy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  const tileX = Math.floor(cx);
  const tileY = Math.floor(cy);
  if (!world.isWalkable(tileX, tileY)) return true;
  if (blocked?.(tileX, tileY)) return true;
  const terrain = world.groundAt(cx, cy);
  if (body.grounded) return terrain - body.z > STEP_UP;
  return terrain > body.z + AIRBORNE_LEDGE_CLEARANCE;
}

// Pure predicate version of the leading-corner check, so the corner-slide
// search can probe hypothetical positions without mutating `body`.
function canMoveAxis(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  const nx = body.x + dx;
  const ny = body.y + dy;
  for (const [cx, cy] of leadingCorners(body, dx, dy, nx, ny)) {
    if (cornerBlocksMove(world, body, cx, cy, blocked)) return false;
  }
  return true;
}

/** Attempt one axis move; mutates `body` and reports whether it moved. */
function tryAxisMove(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  if (dx === 0 && dy === 0) return true;
  if (!canMoveAxis(world, body, dx, dy, blocked)) return false;
  body.x += dx;
  body.y += dy;
  return true;
}

// Scan outward (smallest magnitude first, both signs) from the body's
// current perpendicular position for the nearest offset within
// CORNER_SLIDE_WINDOW at which the blocked move would succeed — the
// centerline nudge target for a 1-wide gap the body is approaching
// slightly off-axis. Exactly one of dx/dy is nonzero (the blocked axis).
function findGapOffset(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): number | null {
  const steps = Math.round(CORNER_SLIDE_WINDOW / CORNER_SLIDE_PROBE_STEP);
  for (let i = 1; i <= steps; i++) {
    const magnitude = i * CORNER_SLIDE_PROBE_STEP;
    for (const sign of [1, -1] as const) {
      const offset = magnitude * sign;
      const probe = dx !== 0 ? { ...body, y: body.y + offset } : { ...body, x: body.x + offset };
      if (canMoveAxis(world, probe, dx, dy, blocked)) return offset;
    }
  }
  return null;
}

// A blocked axis move redirects its own (unused) speed budget into a
// perpendicular nudge toward a nearby gap's centerline instead of
// stalling — the classic Zelda-style corner assist. The nudge itself
// still runs through tryAxisMove's ordinary collision check, so it can
// never land the body in a wall/void the plain move couldn't legally
// enter; it only ever narrows the gap between "blocked" and "through".
function attemptCornerSlide(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): void {
  const budget = Math.abs(dx !== 0 ? dx : dy);
  const offset = findGapOffset(world, body, dx, dy, blocked);
  if (offset === null) return;
  const nudge = Math.sign(offset) * Math.min(Math.abs(offset), budget);
  if (dx !== 0) tryAxisMove(world, body, 0, nudge, blocked);
  else tryAxisMove(world, body, nudge, 0, blocked);
}

/** Blend knockback into intent, decay it, and resolve the two axis moves. */
export function moveHorizontal(
  world: WorldView,
  body: BodyState,
  input: MoveInput,
  dt: number,
  speed: number,
  opts: StepOpts,
): void {
  let dirX = clampAxis(input.moveX);
  let dirY = clampAxis(input.moveY);
  if (dirX !== 0 && dirY !== 0) {
    dirX *= Math.SQRT1_2;
    dirY *= Math.SQRT1_2;
  }

  // Knockback: an external velocity that decays; sticky-feet grips.
  if (opts.stickyFeet) {
    body.kx = 0;
    body.ky = 0;
  }
  const vx = dirX * speed + body.kx;
  const vy = dirY * speed + body.ky;
  body.kx *= KNOCKBACK_DECAY;
  body.ky *= KNOCKBACK_DECAY;
  if (Math.abs(body.kx) < 0.05) body.kx = 0;
  if (Math.abs(body.ky) < 0.05) body.ky = 0;

  const dx = vx * dt;
  const dy = vy * dt;
  if (!tryAxisMove(world, body, dx, 0, opts.blocked) && dx !== 0) {
    attemptCornerSlide(world, body, dx, 0, opts.blocked);
  }
  if (!tryAxisMove(world, body, 0, dy, opts.blocked) && dy !== 0) {
    attemptCornerSlide(world, body, 0, dy, opts.blocked);
  }
}
