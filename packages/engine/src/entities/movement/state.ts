/**
 * Movement's shared state shape and its plain constructors: the body a
 * physics step advances, the input that drives it, and knockback, which
 * both the horizontal-collision and vertical-physics siblings read.
 */

export interface BodyState {
  x: number;
  y: number;
  /** Height above the floor plane; equals terrain height when grounded. */
  z: number;
  zVel: number;
  grounded: boolean;
  coyoteTime: number;
  jumpBuffer: number;
  jumpHeld: boolean;
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
  /** Hold-to-run intent (Epic 7.12). Optional so every existing caller (AI,
   * feel-harness, editor bench) that never sets it keeps walking unchanged. */
  run?: boolean;
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

/** Body half-width for tile collision. Point collision let the sprite
 * sink halfway into wall faces when pushing against them sideways;
 * checking the leading edge's two corners keeps the visual body out of
 * the tile. Small enough to pass 1-wide doorways (0.5-wide band). */
export const BODY_RADIUS = 0.25;

export function createBody(x: number, y: number, z: number): BodyState {
  return {
    x,
    y,
    z,
    zVel: 0,
    grounded: true,
    coyoteTime: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    fallStart: z,
    kx: 0,
    ky: 0,
  };
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
