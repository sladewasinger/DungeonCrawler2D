import {
  AIRBORNE_LEDGE_CLEARANCE,
  COYOTE_TIME,
  GRAVITY,
  JUMP_BUFFER_TIME,
  JUMP_VELOCITY,
  LANDING_TOLERANCE,
  STEP_UP,
} from "../../core/constants.js";
import type { BodyState, MoveInput, StepResult } from "./state.js";

/**
 * Vertical physics: jump buffering, coyote time, gravity, and the
 * grounded/airborne transitions that decide when a body lands. Jump
 * feel (the chained-platform regression tests) depends on this exact
 * ordering relative to horizontal movement in the facade's step().
 */

/** Buffer/consume jump presses and trigger a jump if grounded or within coyote time. */
export function updateJumpState(body: BodyState, input: MoveInput, dt: number): void {
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
  body.zVel -= GRAVITY * dt;
  if (body.zVel <= 0 && body.z <= terrain + LANDING_TOLERANCE) {
    const fallHeight = Math.max(0, body.fallStart - terrain);
    body.z = terrain;
    body.zVel = 0;
    body.grounded = true;
    body.fallStart = terrain;
    result.landed = { fallHeight };
  }
}

/** After horizontal movement, resolve grounded/airborne z against `terrain`. */
export function resolveVerticalMotion(body: BodyState, terrain: number, dt: number): StepResult {
  const result: StepResult = {};
  tryLandOnLedge(body, terrain, result);
  resolveGroundedZ(body, terrain);
  applyGravityAndLand(body, terrain, dt, result);
  return result;
}
