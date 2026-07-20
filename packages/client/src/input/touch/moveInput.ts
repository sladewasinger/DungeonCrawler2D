/**
 * Merges the touch source into the same MoveInput shape keys.ts produces, so
 * prediction (net/connection.ts's sampleInput) sees one intent shape regardless
 * of source — the controller never forks intent logic for touch.
 */
import type { MoveInput } from "@dc2d/engine";
import { isButtonHeld } from "./buttons.js";
import { stickIsRunning, stickMoveAxes } from "./joystick.js";
import type { TouchInputState } from "./state.js";

/** This tick's move input from the touch stick + jump button alone (keyboard is merged by the caller).
 * Full stick deflection stands in for held-Shift run (Epic 7.12, ASSUMPTION #65) — mobile has no Shift key. */
export function touchMoveInput(state: TouchInputState): MoveInput {
  const { moveX, moveY } = stickMoveAxes(state);
  return { moveX, moveY, jump: isButtonHeld(state, "jump"), run: stickIsRunning(state) };
}

/** Touch wins on each axis when it's non-neutral; jump/run are held-by-either unions. */
export function mergeMoveInputs(keyboard: MoveInput, touch: MoveInput): MoveInput {
  return {
    moveX: touch.moveX !== 0 ? touch.moveX : keyboard.moveX,
    moveY: touch.moveY !== 0 ? touch.moveY : keyboard.moveY,
    jump: keyboard.jump || touch.jump,
    run: !!keyboard.run || !!touch.run,
  };
}

/** Remembers the last non-zero move direction for facing-based touch attacks (no mouse aim on touch). */
export function updateLastFacing(state: TouchInputState, moveX: number, moveY: number): void {
  if (moveX === 0 && moveY === 0) return;
  state.lastFacing = { x: moveX, y: moveY };
}
