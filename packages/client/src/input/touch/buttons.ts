/**
 * Pure press/release bookkeeping for the three touch action buttons, keyed by
 * pointerId so a second finger can't steal a button another finger is already
 * holding (attack while moving — multi-touch safe).
 */
import type { TouchButtonState, TouchInputState } from "./state.js";

export type TouchButtonId = keyof TouchButtonState;

/** Claims a button for a pointer; a no-op if it's already held by a (different) finger. */
export function pressButton(state: TouchInputState, button: TouchButtonId, pointerId: number): void {
  if (state.buttons[button] === null) state.buttons[button] = pointerId;
}

/** Releases a button, only if the releasing pointer is the one currently holding it. */
export function releaseButton(state: TouchInputState, button: TouchButtonId, pointerId: number): void {
  if (state.buttons[button] === pointerId) state.buttons[button] = null;
}

export function isButtonHeld(state: TouchInputState, button: TouchButtonId): boolean {
  return state.buttons[button] !== null;
}

/** Releases every button currently held by this pointer (e.g. on pointerupoutside/cancel). */
export function releaseAllForPointer(state: TouchInputState, pointerId: number): void {
  for (const button of Object.keys(state.buttons) as TouchButtonId[]) releaseButton(state, button, pointerId);
}
