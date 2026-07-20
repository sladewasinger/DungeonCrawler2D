/**
 * Pure joystick geometry: drag-vector -> 8-way direction + ramped move magnitude,
 * plus the stick's begin/move/end lifecycle over TouchInputState. No Phaser — the
 * vector->direction/magnitude mapping is the piece under headless test (deadzone,
 * face band, walk ramp, run threshold, release).
 */
import type { TouchInputState } from "./state.js";

/** Matches the base ring's drawn radius in ui/widgets/hud/touchStick.ts (logical px,
 * pre-hudScale). Raised from 32 (wave-9 user spec: "movement joystick and buttons need
 * to be slightly bigger" — walking back part of the wave-6 shrink) — still comfortably
 * inside a thumb's natural drag range. */
export const STICK_RADIUS_PX = 40;

/** Below this fraction of the radius, the drag is dead: no facing change, no movement
 * (wave-9 spec: "deadzone smaller"). Cut from 0.25. */
const DEADZONE_RATIO = 0.12;
/** From DEADZONE_RATIO out to here, the drag only turns the character (lastFacing) —
 * the body doesn't move yet (wave-9 spec: "as I move very close to the deadzone, the
 * direction of my character changes, but no movement"). */
const FACE_BAND_END_RATIO = 0.2;
/** Move magnitude right at FACE_BAND_END_RATIO — a soft creep into the walk ramp, not
 * a standing start (wave-9 spec: "...then as I slowly move further away from the
 * deadzone I walk and then increase walk speed until I'm at max"). */
const WALK_START_MAGNITUDE = 0.35;
const MAX_MAGNITUDE = 1;
/** Near-full deflection also stands in for holding run (Epic 7.12, ASSUMPTION #65:
 * mobile has no Shift key) — "the max extent" per the wave-9 spec. Raised from 0.85
 * now that the ramp below it has room to build up to full walk speed first. */
const RUN_DEFLECTION_RATIO = 0.95;

const SECTOR_RAD = Math.PI / 4;

/** 8-way sector direction; each axis is -1, 0, or 1 (unnormalized — diagonals have
 * length sqrt(2), matching keyboard's raw axis pair). Used for facing, where only the
 * sign matters. */
export interface StickDirection {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
}

const NEUTRAL_DIRECTION: StickDirection = { moveX: 0, moveY: 0 };

/** 8 sectors of 45° each, indexed by angle-from-positive-x-axis (screen space, y-down),
 * starting at 0 = right and going clockwise — matches Math.atan2(dy, dx)'s sign convention. */
const SECTORS: readonly StickDirection[] = [
  { moveX: 1, moveY: 0 },
  { moveX: 1, moveY: 1 },
  { moveX: 0, moveY: 1 },
  { moveX: -1, moveY: 1 },
  { moveX: -1, moveY: 0 },
  { moveX: -1, moveY: -1 },
  { moveX: 0, moveY: -1 },
  { moveX: 1, moveY: -1 },
];

/** Maps a raw drag vector to one of 8 directions; neutral inside the deadzone. */
export function vectorToStickDirection(dx: number, dy: number, radius: number = STICK_RADIUS_PX): StickDirection {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude < radius * DEADZONE_RATIO) return NEUTRAL_DIRECTION;
  const raw = Math.round(Math.atan2(dy, dx) / SECTOR_RAD);
  const sector = ((raw % 8) + 8) % 8;
  // sector is always 0-7 (the double-modulo above guarantees it) — the fallback
  // only satisfies noUncheckedIndexedAccess, it can never actually be hit.
  return SECTORS[sector] ?? NEUTRAL_DIRECTION;
}

/** direction, normalized to unit length so scaling it by a [0,1] magnitude produces a
 * move vector whose length IS that magnitude — cardinal and diagonal drags then walk
 * at the same ramped speed for the same deflection, matching engine/collision.ts's
 * scaledDirection contract ("an analog magnitude in [0,1] passes through unchanged"). */
function unitDirection(direction: StickDirection): { x: number; y: number } {
  const length = Math.hypot(direction.moveX, direction.moveY);
  return length === 0 ? { x: 0, y: 0 } : { x: direction.moveX / length, y: direction.moveY / length };
}

/** Ramped 0..1 move magnitude from a raw drag vector: 0 through the deadzone and face
 * band, then linear WALK_START_MAGNITUDE -> MAX_MAGNITUDE out to full deflection —
 * wave-9 spec's "linearly increasing until I move my thumb to the max extent". Drags
 * past the ring (ratio > 1) still cap at MAX_MAGNITUDE. */
function moveMagnitude(dx: number, dy: number, radius: number): number {
  const ratio = Math.min(Math.hypot(dx, dy) / radius, 1);
  if (ratio < FACE_BAND_END_RATIO) return 0;
  const t = (ratio - FACE_BAND_END_RATIO) / (1 - FACE_BAND_END_RATIO);
  return WALK_START_MAGNITUDE + t * (MAX_MAGNITUDE - WALK_START_MAGNITUDE);
}

/** The direction sector (for facing) and the analog move vector (direction * ramped
 * magnitude, for MoveInput) a raw drag vector resolves to this tick. */
export function stickMoveVector(
  dx: number,
  dy: number,
  radius: number = STICK_RADIUS_PX,
): { direction: StickDirection; moveX: number; moveY: number } {
  const direction = vectorToStickDirection(dx, dy, radius);
  const magnitude = moveMagnitude(dx, dy, radius);
  const unit = unitDirection(direction);
  return { direction, moveX: unit.x * magnitude, moveY: unit.y * magnitude };
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

/** The live drag vector (dx, dy from origin), or null when the stick is idle. */
export function stickDragVector(state: TouchInputState): { dx: number; dy: number } | null {
  if (!state.stick) return null;
  const { curX, curY, originX, originY } = state.stick;
  return { dx: curX - originX, dy: curY - originY };
}

/** True once the drag is pushed past RUN_DEFLECTION_RATIO of the stick's radius — full-deflection-to-run. */
export function stickIsRunning(state: TouchInputState, radius: number = STICK_RADIUS_PX): boolean {
  const drag = stickDragVector(state);
  if (!drag) return false;
  return Math.hypot(drag.dx, drag.dy) >= radius * RUN_DEFLECTION_RATIO;
}
