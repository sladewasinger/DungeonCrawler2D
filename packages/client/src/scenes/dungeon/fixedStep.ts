// Fixed-step accumulator math for DungeonScene: how many prediction ticks a variable
// frame delta owes and the leftover time used for render-only partial-tick prediction.
// Pure so the accumulator math is testable without Phaser.
import { TICK_RATE } from "@dc2d/engine";

export const STEP_MS = 1000 / TICK_RATE;
export const MAX_STEPS_PER_FRAME = 4;

export interface StepResult {
  /** Fixed ticks owed this frame — usually 0 or 1, occasionally more after a stall. */
  readonly steps: number;
  /** Leftover time carried into next frame. */
  readonly accumulatorMs: number;
}

/** Consumes bounded fixed steps and discards whole overdue ticks after a long stall. */
export function consumeFixedSteps(accumulatorMs: number, deltaMs: number): StepResult {
  const elapsed = Math.max(0, accumulatorMs + deltaMs);
  const owedSteps = Math.floor(elapsed / STEP_MS);
  const steps = Math.min(owedSteps, MAX_STEPS_PER_FRAME);
  return { steps, accumulatorMs: elapsed - owedSteps * STEP_MS };
}

