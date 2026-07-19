/**
 * Shared mutable state for the virtual touch input source (joystick + action
 * buttons): one instance owned by the InputController facade (input/index.ts),
 * threaded through the sibling pure modules in this folder. Never imported by
 * anything outside input/touch — consumers go through touch/index.ts.
 */

export interface TouchStickState {
  pointerId: number;
  originX: number;
  originY: number;
  curX: number;
  curY: number;
}

/** Which pointerId (if any) currently holds each button down — multi-touch safe. */
export interface TouchButtonState {
  attack: number | null;
  jump: number | null;
  interact: number | null;
}

export interface TouchInputState {
  stick: TouchStickState | null;
  buttons: TouchButtonState;
  /** Last non-zero move direction seen from any input source — attack aim on
   * touch, where there is no mouse to aim with (docs request: "facing"). */
  lastFacing: { x: number; y: number };
}

export function createTouchInputState(): TouchInputState {
  return {
    stick: null,
    buttons: { attack: null, jump: null, interact: null },
    lastFacing: { x: 1, y: 0 },
  };
}
