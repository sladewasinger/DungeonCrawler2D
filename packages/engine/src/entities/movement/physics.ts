import {
  AIRBORNE_LEDGE_CLEARANCE,
  APEX_HANG_GRAVITY_MULT,
  APEX_HANG_SPEED_FRACTION,
  COYOTE_TIME,
  GRAVITY,
  GRAVITY_DESCENT_MULT,
  JUMP_BUFFER_TIME,
  JUMP_CUT_GRACE_FRACTION,
  JUMP_CUT_MULTIPLIER,
  JUMP_VELOCITY,
  LANDING_TOLERANCE,
  STEP_UP,
  TERMINAL_FALL_VELOCITY,
} from "../../core/constants.js";
import type { BodyState, MoveInput, StepResult } from "./state.js";

/**
 * Vertical physics: jump buffering, coyote time, variable-height jump
 * cut, asymmetric/apex-hang gravity, and the grounded/airborne
 * transitions that decide when a body lands. Jump feel (the
 * chained-platform regression tests) depends on this exact ordering
 * relative to horizontal movement in the facade's step().
 */

// A release only cuts the jump once it's past the grace window (zVel
// has decayed below the fraction) — see JUMP_CUT_GRACE_FRACTION's doc
// comment for why a single-tick tap must not stall a climb.
function applyJumpCut(body: BodyState, input: MoveInput): void {
  if (input.jump || !body.jumpHeld || body.grounded || body.zVel <= 0) return;
  if (body.zVel < JUMP_CUT_GRACE_FRACTION * JUMP_VELOCITY) {
    body.zVel *= JUMP_CUT_MULTIPLIER;
  }
}

/** Buffer/consume jump presses and trigger a jump if grounded or within coyote time. */
export function updateJumpState(body: BodyState, input: MoveInput, dt: number): void {
  applyJumpCut(body, input);
  if (input.jump && !body.jumpHeld) body.jumpBuffer = JUMP_BUFFER_TIME;
  else body.jumpBuffer = Math.max(0, body.jumpBuffer - dt);
  body.jumpHeld = input.jump;

  if (body.grounded) body.coyoteTime = COYOTE_TIME;
  else body.coyoteTime = Math.max(0, body.coyoteTime - dt);

  if (body.jumpBuffer > 0 && (body.grounded || body.coyoteTime > 0)) {
    body.zVel = JUMP_VELOCITY;
    body.grounded = false;
    body.coyoteTime = 0;
    body.jumpBuffer = 0;
    body.fallStart = body.z;
  }
}

// Ascent is GRAVITY; descent is steeper (GRAVITY_DESCENT_MULT) for a
// snappy fall. Near-zero vertical speed (either side of the arc's peak)
// gets a softened gravity for a brief hang at the top.
function effectiveGravity(zVel: number): number {
  const base = zVel > 0 ? GRAVITY : GRAVITY * GRAVITY_DESCENT_MULT;
  const speedFraction = Math.abs(zVel) / JUMP_VELOCITY;
  return speedFraction < APEX_HANG_SPEED_FRACTION ? base * APEX_HANG_GRAVITY_MULT : base;
}

// Airborne but rising into a nearby ledge top: snap onto it rather than
// clipping through, same as walking up to it from the side would.
function tryLandOnLedge(body: BodyState, terrain: number, result: StepResult): void {
  if (
    !body.grounded &&
    body.zVel > 0 &&
    terrain > body.z &&
    terrain - body.z <= AIRBORNE_LEDGE_CLEARANCE
  ) {
    body.z = terrain;
    body.zVel = 0;
    body.grounded = true;
    body.coyoteTime = COYOTE_TIME;
    body.fallStart = terrain;
    result.landed = { fallHeight: 0 };
  }
}

// Grounded bodies track terrain directly (stairs ramp, small steps snap
// up); a rise too tall to step up drops the body into freefall.
function resolveGroundedZ(body: BodyState, terrain: number): void {
  if (!body.grounded) return;
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

function applyGravityAndLand(
  body: BodyState,
  terrain: number,
  dt: number,
  result: StepResult,
): void {
  if (body.grounded) return;
  body.z += body.zVel * dt;
  body.zVel -= effectiveGravity(body.zVel) * dt;
  if (body.zVel < -TERMINAL_FALL_VELOCITY) body.zVel = -TERMINAL_FALL_VELOCITY;
  if (body.zVel <= 0 && body.z <= terrain + LANDING_TOLERANCE) {
    const fallHeight = Math.max(0, body.fallStart - terrain);
    body.z = terrain;
    body.zVel = 0;
    body.grounded = true;
    body.fallStart = terrain;
    result.landed = { fallHeight };
  }
}

/**
 * On-stair glide (docs/R2-STAIRS-SPEC.md section 3c): a grounded body
 * standing on a real Stairs tile rides `terrain` (the continuous ramp)
 * directly, bypassing STEP_UP entirely — a 1.0-slope compact stair rises
 * 0.4-0.6 z/tick at walk/run speed, both over STEP_UP(0.35), so the
 * ordinary grounded step-up gate can never admit it. The glide is
 * velocity-invariant (no new movement constant), so it covers walk, run,
 * and knockback with zero per-entity tuning. Only engages while grounded:
 * `updateJumpState` runs before this in stepBody, so a buffered jump has
 * already cleared `grounded` and fires a normal arc; an airborne body
 * falling ONTO a stair still lands via the unchanged tryLandOnLedge/
 * resolveGroundedZ/applyGravityAndLand path below, then glides on
 * subsequent grounded ticks.
 */
function applyStairGlide(body: BodyState, terrain: number): boolean {
  if (!body.grounded) return false;
  body.z = terrain;
  body.zVel = 0;
  return true;
}

/** After horizontal movement, resolve grounded/airborne z against `terrain`. */
export function resolveVerticalMotion(
  body: BodyState,
  terrain: number,
  dt: number,
  onStair: boolean,
): StepResult {
  const result: StepResult = {};
  if (onStair && applyStairGlide(body, terrain)) return result;
  tryLandOnLedge(body, terrain, result);
  resolveGroundedZ(body, terrain);
  applyGravityAndLand(body, terrain, dt, result);
  return result;
}
