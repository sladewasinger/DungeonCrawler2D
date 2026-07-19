/**
 * Pure joystick geometry: drag-vector -> deadzoned 8-way move axes, plus the
 * stick's begin/move/end lifecycle over TouchInputState. No Phaser — the
 * vector->axes mapping is the piece under headless test (deadzone, sectors,
 * release).
 */
import type { TouchInputState } from "./state.js";

/** Matches the base ring's drawn radius in ui/widgets/hud/touchStick.ts (logical px, pre-hudScale). */
export const STICK_RADIUS_PX = 44;
const DEADZONE_RATIO = 0.25;
const SECTOR_RAD = Math.PI / 4;

export interface MoveAxes {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
}

const NEUTRAL_AXES: MoveAxes = { moveX: 0, moveY: 0 };

/** 8 sectors of 45° each, indexed by angle-from-positive-x-axis (screen space, y-down),
 * starting at 0 = right and going clockwise — matches Math.atan2(dy, dx)'s sign convention. */
const SECTORS: readonly MoveAxes[] = [
  { moveX: 1, moveY: 0 },
  { moveX: 1, moveY: 1 },
  { moveX: 0, moveY: 1 },
  { moveX: -1, moveY: 1 },
  { moveX: -1, moveY: 0 },
  { moveX: -1, moveY: -1 },
  { moveX: 0, moveY: -1 },
  { moveX: 1, moveY: -1 },
];

/** Maps a raw drag vector to one of 8 deadzoned move directions; neutral inside the deadzone. */
export function vectorToMoveAxes(dx: number, dy: number, radius: number = STICK_RADIUS_PX): MoveAxes {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < radius * DEADZONE_RATIO) return NEUTRAL_AXES;
  const raw = Math.round(Math.atan2(dy, dx) / SECTOR_RAD);
  const sector = ((raw % 8) + 8) % 8;
  // sector is always 0-7 (the double-modulo above guarantees it) — the fallback
  // only satisfies noUncheckedIndexedAccess, it can never actually be hit.
  return SECTORS[sector] ?? NEUTRAL_AXES;
}

/** Summons the floating stick at the touch point — the pointerdown that starts a drag. */
export function beginStick(state: TouchInputState, pointerId: number, x: number, y: number): void {
  state.stick = { pointerId, originX: x, originY: y, curX: x, curY: y };
}

/** Updates the live drag position; ignored for any pointer that isn't the active stick's. */
export function moveStick(state: TouchInputState, pointerId: number, x: number, y: number): void {
  if (!state.stick || state.stick.pointerId !== pointerId) return;
  state.stick.curX = x;
  state.stick.curY = y;
}

/** Releases the stick, resetting the vector to neutral; ignored for a non-matching pointer. */
export function endStick(state: TouchInputState, pointerId: number): void {
  if (!state.stick || state.stick.pointerId !== pointerId) return;
  state.stick = null;
}

/** The live analog move axes from the current drag, or neutral when the stick is idle. */
export function stickMoveAxes(state: TouchInputState): MoveAxes {
  if (!state.stick) return NEUTRAL_AXES;
  const { curX, curY, originX, originY } = state.stick;
  return vectorToMoveAxes(curX - originX, curY - originY);
}
