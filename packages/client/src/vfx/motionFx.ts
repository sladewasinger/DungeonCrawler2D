// Pure motion edge-triggers for movement juice: jump/land/turn detection and a fixed
// footstep cadence while sprinting — VISUAL_DIRECTION's "movement feel" rule, kept
// Phaser-free so the triggers are unit-testable on their own (mirrors hitFlash.ts's shape).
import { isRunningPace } from "../render/entities/playerMotion.js";

export interface MotionSample {
  readonly x: number;
  readonly y: number;
  readonly air: boolean;
  readonly faceX: number;
}

export type MotionEvent = "jumped" | "landed" | "turned";

const MOVING_EPS_TILES_PER_SEC = 0.4;
const FOOTSTEP_INTERVAL_MS = 260;

/** Edge-triggered motion events between two consecutive samples. Empty on the first sample (no prior state). */
export function motionEvents(prev: MotionSample | undefined, curr: MotionSample): MotionEvent[] {
  if (!prev) return [];
  const events: MotionEvent[] = [];
  if (!prev.air && curr.air) events.push("jumped");
  if (prev.air && !curr.air) events.push("landed");
  if (turned(prev.faceX, curr.faceX)) events.push("turned");
  return events;
}

function turned(prevFaceX: number, currFaceX: number): boolean {
  return Math.sign(prevFaceX) !== 0 && Math.sign(currFaceX) !== 0 && Math.sign(prevFaceX) !== Math.sign(currFaceX);
}

/** True once a sample's ground speed crosses the "moving" threshold since the previous sample. */
export function isMoving(prev: MotionSample | undefined, curr: MotionSample, dtSeconds: number): boolean {
  if (!prev || dtSeconds <= 0) return false;
  return Math.hypot(curr.x - prev.x, curr.y - prev.y) / dtSeconds > MOVING_EPS_TILES_PER_SEC;
}

/** True on the frame that crosses a FOOTSTEP_INTERVAL_MS boundary while grounded and moving — a fixed cadence. */
export function footstepDue(prevFrameMs: number, nowMs: number, grounded: boolean, moving: boolean): boolean {
  if (!grounded || !moving) return false;
  return Math.floor(prevFrameMs / FOOTSTEP_INTERVAL_MS) !== Math.floor(nowMs / FOOTSTEP_INTERVAL_MS);
}

/** True once the ground speed between two samples reads as running, not walking (Epic 7.12) —
 * shares its threshold with the animation cadence bump (render/entities/playerMotion.ts), so
 * the dust and the faster loop always agree on what counts as "running". */
export function isRunning(prev: MotionSample | undefined, curr: MotionSample, dtSeconds: number): boolean {
  if (!prev) return false;
  return isRunningPace(curr.x - prev.x, curr.y - prev.y, dtSeconds);
}
