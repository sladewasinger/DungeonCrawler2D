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
  const wallFace = world.wallFaceAt?.(tileX, tileY);
  if (wallFace) {
    if (body.z + AIRBORNE_LEDGE_CLEARANCE < wallFace.top) return true;
  } else if (!world.isWalkable(tileX, tileY)) {
    return true;
  }
  if (blocked?.(tileX, tileY)) return true;
  const terrain = world.groundAt(cx, cy);
  if (body.grounded) return terrain - body.z > STEP_UP;
  return terrain > body.z + AIRBORNE_LEDGE_CLEARANCE;
}

/** True where (x, y) is solid ground with no facade of its own — a legal eject landing. */
function isClearGround(world: WorldView, x: number, y: number): boolean {
  return world.isWalkable(x, y) && !world.wallFaceAt?.(x, y);
}

/**
 * A body may cross a projected facade while above its top. If it falls back
 * below that top before clearing the tile, put it at the visible south base
 * so it cannot land inside the brick projection — PAST the whole span, not
 * just one row, since a multi-row facade's brick mass extends further than
 * a single tile. The immediate landing row can itself be blocked (a 1-wide
 * slot backed by another wall); walk further south, up to span+1 rows, for
 * the first clear cell. If the whole run is walled off, there is nowhere
 * legal to stand south of it — pin the body to the source's top instead of
 * leaving it inside the wall.
 */
export function ejectBodyBelowWallFace(world: WorldView, body: BodyState): void {
  const tileX = Math.floor(body.x);
  const tileY = Math.floor(body.y);
  const wallFace = world.wallFaceAt?.(tileX, tileY);
  if (!wallFace || body.z + AIRBORNE_LEDGE_CLEARANCE >= wallFace.top) return;
  const pastSpan = wallFace.sourceY + wallFace.span + 1;
  for (let row = pastSpan; row <= pastSpan + wallFace.span; row++) {
    if (!isClearGround(world, tileX, row)) continue;
    body.y = row + BODY_RADIUS;
    return;
  }
  body.z = wallFace.top;
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
    if (cornerBlocksMove(world, body, cx, cy, blocked)) return;
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
