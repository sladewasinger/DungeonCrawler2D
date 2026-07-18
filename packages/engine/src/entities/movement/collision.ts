import { AIRBORNE_LEDGE_CLEARANCE, KNOCKBACK_DECAY, STEP_UP } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import { BODY_RADIUS, type BodyState, type MoveInput, type StepOpts } from "./state.js";

/**
 * Horizontal step + tile collision: knockback blending, diagonal
 * normalization, and the leading-edge corner check that keeps bodies
 * out of wall faces while letting stairs ramp underfoot.
 */

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

// Continuous ground: stair tiles ramp with position. The grounded gate is
// the rise ACROSS THIS MOVE at the corner (target ground minus the ground
// where that corner is now) — on flat tiles this is the same tile-to-tile
// delta as ever (walls still block), and on ramps it's the true slope of
// the step taken, so a staircase never reads as a wall just because the
// corner looks ahead.
function cornerBlocksMove(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  blocked?: StepOpts["blocked"],
): boolean {
  const tileX = Math.floor(cx);
  const tileY = Math.floor(cy);
  if (!world.isWalkable(tileX, tileY)) return true;
  if (blocked?.(tileX, tileY)) return true;
  const terrain = world.groundAt(cx, cy);
  if (body.grounded) return terrain - world.groundAt(cx - dx, cy - dy) > STEP_UP;
  return terrain > body.z + AIRBORNE_LEDGE_CLEARANCE;
}

function tryAxisMove(
  world: WorldView,
  body: BodyState,
  dx: number,
  dy: number,
  blocked?: StepOpts["blocked"],
): void {
  if (dx === 0 && dy === 0) return;
  const nx = body.x + dx;
  const ny = body.y + dy;
  for (const [cx, cy] of leadingCorners(body, dx, dy, nx, ny)) {
    if (cornerBlocksMove(world, body, dx, dy, cx, cy, blocked)) return;
  }
  body.x = nx;
  body.y = ny;
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

  tryAxisMove(world, body, vx * dt, 0, opts.blocked);
  tryAxisMove(world, body, 0, vy * dt, opts.blocked);
}
