/**
 * Touch input source facade: the only file outside this folder may import from.
 * Owns nothing (the InputController facade in input/index.ts holds the single
 * TouchInputState instance, same as it holds InputState for keys) — this just
 * re-exports the operations and adds the one bit of routing geometry
 * (lower-left quadrant test) other input modules need.
 */
import type { TouchInputState } from "./state.js";

export { createTouchInputState } from "./state.js";
export type { TouchButtonState, TouchInputState, TouchStickState } from "./state.js";
export {
  beginStick,
  endStick,
  moveStick,
  stickDragVector,
  stickIsRunning,
  stickMoveVector,
  STICK_RADIUS_PX,
  vectorToStickDirection,
} from "./joystick.js";
export type { StickDirection } from "./joystick.js";
export { isButtonHeld, pressButton, releaseAllForPointer, releaseButton } from "./buttons.js";
export type { TouchButtonId } from "./buttons.js";
export { mergeMoveInputs, touchMoveInput, updateLastFacing } from "./moveInput.js";

/** True when (x, y) falls in the screen's lower-left quadrant — the floating
 * joystick's summon zone, so a thumb resting anywhere down there gets a stick
 * under it instead of only a fixed hot corner. */
export function isInLowerLeftQuadrant(x: number, y: number, viewportWidth: number, viewportHeight: number): boolean {
  return x < viewportWidth / 2 && y > viewportHeight / 2;
}

/** Read-only projection of touch state for the HUD widgets to render — never mutated by ui/. */
export interface TouchVisualSnapshot {
  stick: { x: number; y: number; dx: number; dy: number } | null;
  buttons: { attack: boolean; jump: boolean; interact: boolean };
}

export function touchVisualSnapshot(state: TouchInputState): TouchVisualSnapshot {
  const stick = state.stick
    ? { x: state.stick.originX, y: state.stick.originY, dx: state.stick.curX - state.stick.originX, dy: state.stick.curY - state.stick.originY }
    : null;
  return {
    stick,
    buttons: {
      attack: state.buttons.attack !== null,
      jump: state.buttons.jump !== null,
      interact: state.buttons.interact !== null,
    },
  };
}
