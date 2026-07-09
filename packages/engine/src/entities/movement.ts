import { GRAVITY, JUMP_VELOCITY, KNOCKBACK_DECAY, MOVE_SPEED, STEP_UP } from "../core/constants";
import type { WorldView } from "../world/types";

/**
 * Shared movement physics. The server runs this authoritatively for
 * every entity kind; the client runs the *same function* to predict
 * its own body and to replay unacknowledged inputs. Determinism
 * matters: fixed dt in, pure float math, no randomness.
 */

export interface BodyState {
  x: number;
  y: number;
  /** Height above the floor plane; equals terrain height when grounded. */
  z: number;
  zVel: number;
  grounded: boolean;
  /** Ground z where the body last left the ground. Fall damage is the
   * DROP below your takeoff point — jumping off a platform hurts
   * exactly as much as walking off it, never "platform + jump apex". */
  fallStart: number;
  /** Knockback velocity (decays per step; a PvP ledge-shove weapon). */
  kx: number;
  ky: number;
}

export interface MoveInput {
  /** -1, 0, or 1. */
  moveX: number;
  moveY: number;
  jump: boolean;
}

export interface StepResult {
  landed?: { fallHeight: number };
}

export interface StepOpts {
  /** Tiles/s; defaults to the player MOVE_SPEED. */
  speed?: number;
  /** sticky-feet: immune to knockback (ledge-grip). */
  stickyFeet?: boolean;
  /** Extra tile veto (e.g. enemies never enter sanctuary). */
  blocked?: (tileX: number, tileY: number) => boolean;
}

export const NEUTRAL_INPUT: MoveInput = { moveX: 0, moveY: 0, jump: false };

export function createBody(x: number, y: number, z: number): BodyState {
  return { x, y, z, zVel: 0, grounded: true, fallStart: z, kx: 0, ky: 0 };
}

export function cloneBody(body: BodyState): BodyState {
  return { ...body };
}

/** Shove a body (melee knockback, explosions). sticky-feet resists at step time. */
export function applyKnockback(body: BodyState, dirX: number, dirY: number, force: number): void {
  const len = Math.hypot(dirX, dirY);
  if (len === 0) return;
  body.kx += (dirX / len) * force;
  body.ky += (dirY / len) * force;
}

function clampAxis(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Body half-width for tile collision. Point collision let the sprite
 * sink halfway into wall faces when pushing against them sideways;
 * checking the leading edge's two corners keeps the visual body out of
 * the tile. Small enough to pass 1-wide doorways (0.5-wide band). */
export const BODY_RADIUS = 0.25;

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
  // Leading-edge corners in the movement direction (the trailing side
  // was already valid). Both corners must accept the move.
  const ex = nx + Math.sign(dx) * BODY_RADIUS;
  const ey = ny + Math.sign(dy) * BODY_RADIUS;
  const corners: Array<[number, number]> =
    dx !== 0
      ? [
          [ex, body.y - BODY_RADIUS],
          [ex, body.y + BODY_RADIUS],
        ]
      : [
          [body.x - BODY_RADIUS, ey],
          [body.x + BODY_RADIUS, ey],
        ];
  for (const [cx, cy] of corners) {
    const tileX = Math.floor(cx);
    const tileY = Math.floor(cy);
    if (!world.isWalkable(tileX, tileY)) return;
    if (blocked?.(tileX, tileY)) return;
    // Continuous ground: stair tiles ramp with position. The grounded
    // gate is the rise ACROSS THIS MOVE at the corner (target ground
    // minus the ground where that corner is now) — on flat tiles this
    // is the same tile-to-tile delta as ever (walls still block), and
    // on ramps it's the true slope of the step taken, so a staircase
    // never reads as a wall just because the corner looks ahead.
    const terrain = world.groundAt(cx, cy);
    if (body.grounded) {
      if (terrain - world.groundAt(cx - dx, cy - dy) > STEP_UP) return;
    } else if (terrain > body.z) {
      return;
    }
  }
  body.x = nx;
  body.y = ny;
}

/** Advance one body by one fixed timestep. Mutates `body`. */
export function stepBody(
  world: WorldView,
  body: BodyState,
  input: MoveInput,
  dt: number,
  opts: StepOpts = {},
): StepResult {
  const result: StepResult = {};
  const speed = opts.speed ?? MOVE_SPEED;

  if (input.jump && body.grounded) {
    body.zVel = JUMP_VELOCITY;
    body.grounded = false;
    body.fallStart = body.z;
  }

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

  const terrain = world.groundAt(body.x, body.y);

  if (body.grounded) {
    if (terrain >= body.z) {
      body.z = terrain;
    } else if (body.z - terrain <= STEP_UP) {
      body.z = terrain;
    } else {
      body.grounded = false;
      body.zVel = 0;
      body.fallStart = body.z;
    }
  }

  if (!body.grounded) {
    body.z += body.zVel * dt;
    body.zVel -= GRAVITY * dt;
    if (body.zVel <= 0 && body.z <= terrain) {
      const fallHeight = Math.max(0, body.fallStart - terrain);
      body.z = terrain;
      body.zVel = 0;
      body.grounded = true;
      body.fallStart = terrain;
      result.landed = { fallHeight };
    }
  }

  return result;
}
