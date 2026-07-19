/**
 * Merges the touch source into the same MoveInput shape keys.ts produces, so
 * prediction (net/connection.ts's sampleInput) sees one intent shape regardless
 * of source — the controller never forks intent logic for touch.
 */
import type { MoveInput } from "@dc2d/engine";
import { isButtonHeld } from "./buttons.js";
import { stickMoveAxes } from "./joystick.js";
import type { TouchInputState } from "./state.js";

/** This tick's move input from the touch stick + jump button alone (keyboard is merged by the caller). */
export function touchMoveInput(state: TouchInputState): MoveInput {
  const { moveX, moveY } = stickMoveAxes(state);
  return { moveX, moveY, jump: isButtonHeld(state, "jump") };
}

/** Touch wins on each axis when it's non-neutral; jump is a held-by-either union. */
export function mergeMoveInputs(keyboard: MoveInput, touch: MoveInput): MoveInput {
  return {
    moveX: touch.moveX !== 0 ? touch.moveX : keyboard.moveX,
    moveY: touch.moveY !== 0 ? touch.moveY : keyboard.moveY,
    jump: keyboard.jump || touch.jump,
  };
}

/** Remembers the last non-zero move direction for facing-based touch attacks (no mouse aim on touch). */
export function updateLastFacing(state: TouchInputState, moveX: number, moveY: number): void {
  if (moveX === 0 && moveY === 0) return;
  state.lastFacing = { x: moveX, y: moveY };
}
