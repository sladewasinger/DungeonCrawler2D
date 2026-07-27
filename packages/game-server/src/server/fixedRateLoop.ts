import { TICK_RATE } from "@dc2d/engine";

export const MAX_SERVER_CATCH_UP_TICKS = 4;

export interface FixedRateStepPlan {
  steps: number;
  nextTickAt: number;
}

export interface FixedRateStepInput {
  now: number;
  nextTickAt: number;
  tickMilliseconds: number;
  maxSteps?: number;
}

export function fixedRateStepPlan(input: FixedRateStepInput): FixedRateStepPlan {
  const { now, nextTickAt, tickMilliseconds, maxSteps = MAX_SERVER_CATCH_UP_TICKS } = input;
  if (now < nextTickAt) return { steps: 0, nextTickAt };
  const owed = Math.floor((now - nextTickAt) / tickMilliseconds) + 1;
  const steps = Math.min(owed, maxSteps);
  return {
    steps,
    nextTickAt: owed > maxSteps
      ? now + tickMilliseconds
      : nextTickAt + steps * tickMilliseconds,
  };
}

export function startFixedRateLoop(step: () => void): () => void {
  const tickMilliseconds = 1000 / TICK_RATE;
  let nextTickAt = performance.now() + tickMilliseconds;
  const timer = setInterval(() => {
    const plan = fixedRateStepPlan({ now: performance.now(), nextTickAt, tickMilliseconds });
    nextTickAt = plan.nextTickAt;
    for (let index = 0; index < plan.steps; index++) step();
  }, tickMilliseconds / 2);
  return () => clearInterval(timer);
}
