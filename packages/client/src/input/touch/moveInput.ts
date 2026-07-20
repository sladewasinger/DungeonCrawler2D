/**
 * Merges the touch source into the same MoveInput shape keys.ts produces, so
 * prediction (net/connection.ts's sampleInput) sees one intent shape regardless
 * of source — the controller never forks intent logic for touch.
 */
import type { MoveInput } from "@dc2d/engine";
import { isButtonHeld } from "./buttons.js";
import { stickDragVector, stickIsRunning, stickMoveVector } from "./joystick.js";
import type { TouchInputState } from "./state.js";

/** This tick's move input from the touch stick + jump button alone (keyboard is merged
 * by the caller). The stick's direction and its ramped move magnitude are derived
 * together (joystick.ts's stickMoveVector) so the wave-9 face band can turn the
 * character (lastFacing) without moving the body: direction goes live at the deadzone,
 * magnitude stays 0 until the face band ends. Full extension also stands in for
 * held-Shift run (Epic 7.12, ASSUMPTION #65) — mobile has no Shift key. */
export function touchMoveInput(state: TouchInputState): MoveInput {
  const drag = stickDragVector(state);
  if (!drag) return { moveX: 0, moveY: 0, jump: isButtonHeld(state, "jump"), run: false };
  const { direction, moveX, moveY } = stickMoveVector(drag.dx, drag.dy);
  if (direction.moveX !== 0 || direction.moveY !== 0) updateLastFacing(state, direction.moveX, direction.moveY);
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
