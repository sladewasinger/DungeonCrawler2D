// Fixed-step accumulator math for DungeonScene: how many prediction ticks a variable
// frame delta owes, plus the leftover-time alpha used to interpolate the render pose
// between the last two ticks. Pure so the accumulator math is testable without Phaser.
import { TICK_RATE } from "@dc2d/engine";

export const STEP_MS = 1000 / TICK_RATE;

export interface StepResult {
  /** Fixed ticks owed this frame — usually 0 or 1, occasionally more after a stall. */
  readonly steps: number;
  /** Leftover time carried into next frame. */
  readonly accumulatorMs: number;
}

/** Consumes as many fixed steps as the accumulated frame time covers. */
export function consumeFixedSteps(accumulatorMs: number, deltaMs: number): StepResult {
  let remaining = accumulatorMs + deltaMs;
  let steps = 0;
  while (remaining >= STEP_MS) {
    remaining -= STEP_MS;
    steps++;
  }
  return { steps, accumulatorMs: remaining };
}

/** How far (0..1) through the next tick the leftover accumulator time sits. */
export function interpolationAlpha(accumulatorMs: number): number {
  return Math.min(1, Math.max(0, accumulatorMs / STEP_MS));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
