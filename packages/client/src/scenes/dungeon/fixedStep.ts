// Fixed-step accumulator math for DungeonScene: how many prediction ticks a variable
// frame delta owes, plus the leftover-time alpha used to interpolate the render pose
// between the last two ticks. Pure so the accumulator math is testable without Phaser.
import { TICK_RATE } from "@dc2d/engine";

export const STEP_MS = 1000 / TICK_RATE;
export const MAX_STEPS_PER_FRAME = 4;

export interface StepResult {
  /** Fixed ticks owed this frame — usually 0 or 1, occasionally more after a stall. */
  readonly steps: number;
  /** Leftover time carried into next frame. */
  readonly accumulatorMs: number;
}

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Consumes bounded fixed steps and discards whole overdue ticks after a long stall. */
export function consumeFixedSteps(accumulatorMs: number, deltaMs: number): StepResult {
  const elapsed = Math.max(0, accumulatorMs + deltaMs);
  const owedSteps = Math.floor(elapsed / STEP_MS);
  const steps = Math.min(owedSteps, MAX_STEPS_PER_FRAME);
  return { steps, accumulatorMs: elapsed - owedSteps * STEP_MS };
}

/** How far (0..1) through the next tick the leftover accumulator time sits. */
export function interpolationAlpha(accumulatorMs: number): number {
  return Math.min(1, Math.max(0, accumulatorMs / STEP_MS));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function translatePose(pose: Pose | null, correction: Pose): Pose | null {
  if (!pose) return null;
  return {
    x: pose.x + correction.x,
    y: pose.y + correction.y,
    z: pose.z + correction.z,
  };
}
