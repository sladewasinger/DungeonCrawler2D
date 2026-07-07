import {
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  STEP_UP,
} from "../core/constants";
import type { WorldView } from "../world/types";

/**
 * Shared movement physics. The server runs this authoritatively; the
 * client runs the *same function* to predict its own body and to
 * replay unacknowledged inputs after reconciliation. Determinism
 * matters: fixed dt in, pure float math, no randomness.
 */

export interface BodyState {
  x: number;
  y: number;
  /** Height above the floor plane; equals terrain height when grounded. */
  z: number;
  zVel: number;
  grounded: boolean;
  /** Highest z reached since leaving the ground — for fall-height on landing. */
  fallPeak: number;
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

export const NEUTRAL_INPUT: MoveInput = { moveX: 0, moveY: 0, jump: false };

export function createBody(x: number, y: number, z: number): BodyState {
  return { x, y, z, zVel: 0, grounded: true, fallPeak: z };
}

export function cloneBody(body: BodyState): BodyState {
  return { ...body };
}

function clampAxis(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

function tryAxisMove(world: WorldView, body: BodyState, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const nx = body.x + dx;
  const ny = body.y + dy;
  const tileX = Math.floor(nx);
  const tileY = Math.floor(ny);
  if (!world.isWalkable(tileX, tileY)) return; // wall
  const terrain = world.heightAt(tileX, tileY);
  if (body.grounded) {
    if (terrain - body.z > STEP_UP) return; // cliff too tall to walk up
  } else if (terrain > body.z) {
    return; // airborne: can't clip into terrain above current height
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
): StepResult {
  const result: StepResult = {};

  if (input.jump && body.grounded) {
    body.zVel = JUMP_VELOCITY;
    body.grounded = false;
    body.fallPeak = body.z;
  }

  let dirX = clampAxis(input.moveX);
  let dirY = clampAxis(input.moveY);
  if (dirX !== 0 && dirY !== 0) {
    dirX *= Math.SQRT1_2;
    dirY *= Math.SQRT1_2;
  }
  tryAxisMove(world, body, dirX * MOVE_SPEED * dt, 0);
  tryAxisMove(world, body, 0, dirY * MOVE_SPEED * dt);

  const terrain = world.heightAt(Math.floor(body.x), Math.floor(body.y));

  if (body.grounded) {
    if (terrain >= body.z) {
      body.z = terrain; // stepped up (≤ STEP_UP, enforced during the move)
    } else if (body.z - terrain <= STEP_UP) {
      body.z = terrain; // small step down: stay grounded
    } else {
      body.grounded = false; // walked off a ledge
      body.zVel = 0;
      body.fallPeak = body.z;
    }
  }

  if (!body.grounded) {
    body.z += body.zVel * dt;
    body.zVel -= GRAVITY * dt;
    if (body.z > body.fallPeak) body.fallPeak = body.z;
    if (body.zVel <= 0 && body.z <= terrain) {
      const fallHeight = Math.max(0, body.fallPeak - terrain);
      body.z = terrain;
      body.zVel = 0;
      body.grounded = true;
      body.fallPeak = terrain;
      result.landed = { fallHeight };
    }
  }

  return result;
}
