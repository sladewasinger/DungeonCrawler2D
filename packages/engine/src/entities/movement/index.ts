import { MOVE_SPEED, RUN_SPEED_MULTIPLIER } from "../../core/constants.js";
import type { WorldView } from "../../world/types.js";
import { moveHorizontal } from "./collision.js";
import { resolveVerticalMotion, updateJumpState } from "./physics.js";

/**
 * Shared movement physics facade. The server runs this authoritatively
 * for every entity kind; the client runs the *same function* to
 * predict its own body and to replay unacknowledged inputs.
 * Determinism matters: fixed dt in, pure float math, no randomness.
 */

export type { BodyState, MoveInput, StepOpts, StepResult } from "./state.js";
export { BODY_RADIUS, NEUTRAL_INPUT, applyKnockback, cloneBody, createBody } from "./state.js";

import type { BodyState, MoveInput, StepOpts, StepResult } from "./state.js";

/** Advance one body by one fixed timestep. Mutates `body`. Tick order:
 * jump state, then horizontal collision, then vertical physics — this
 * exact order is what makes chained platform jumps feel right.
 *
 * `input.run` (Epic 7.12) scales whatever speed the caller supplied by
 * RUN_SPEED_MULTIPLIER — applied here, once, so the server (authoritative)
 * and the client's prediction/replay (same function, no opts) can never
 * drift apart on what "running" is worth. */
export function stepBody(
  world: WorldView,
  body: BodyState,
  input: MoveInput,
  dt: number,
  opts: StepOpts = {},
): StepResult {
  const speed = (opts.speed ?? MOVE_SPEED) * (input.run ? RUN_SPEED_MULTIPLIER : 1);

  updateJumpState(body, input, dt);
  moveHorizontal(world, body, input, dt, speed, opts);
  const terrain = world.groundAt(body.x, body.y);
  return resolveVerticalMotion(body, terrain, dt);
}
