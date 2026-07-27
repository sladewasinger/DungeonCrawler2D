import { TICK_DT } from "../../core/constants.js";
import type { WorldView } from "../../world/core/types.js";
import { createBody, stepBody, type BodyState } from "../movement/index.js";
import { dirVector, fixtureWorld, type CardinalDirection } from "./worldFixture.js";

export interface ClimbResult {
  direction: string;
  success: boolean;
  ticksUsed: number;
  finalHeight: number;
}

interface ClimbAttempt {
  world: WorldView;
  body: BodyState;
  move: { moveX: number; moveY: number };
  targetHeight: number;
  budget: number;
}

function climbToward({ world, body, move, targetHeight, budget }: ClimbAttempt): { success: boolean; ticksUsed: number } {
  stepBody(world, body, { ...move, jump: true }, TICK_DT);
  for (let i = 0; i < budget; i++) {
    stepBody(world, body, { ...move, jump: false }, TICK_DT);
    if (body.grounded && body.z >= targetHeight - 1e-6) return { success: true, ticksUsed: i + 1 };
  }
  return { success: false, ticksUsed: budget };
}

function climbFixture(direction: CardinalDirection, heightAt: (progress: number) => number) {
  const [dx, dy] = dirVector(direction);
  const progress = (x: number, y: number): number => dx ? x * dx : y * dy;
  const world = fixtureWorld((x, y) => heightAt(progress(x, y)));
  return { body: createBody(dx * 7.2 || 5.5, dy * 7.2 || 5.5, 0), move: { moveX: dx, moveY: dy }, world };
}

export function measureLedgeClimb(direction: CardinalDirection): ClimbResult {
  const { body, move, world } = climbFixture(direction, (progress) => progress >= 8 ? 1 : 0);
  const { success, ticksUsed } = climbToward({ world, body, move, targetHeight: 1, budget: 30 });
  return { direction, success, ticksUsed, finalHeight: body.z };
}

function chainedHeight(progress: number): number {
  if (progress >= 12) return 3;
  if (progress >= 10) return 2;
  return progress >= 8 ? 1 : 0;
}

export function measureChainedPlatforms(direction: CardinalDirection): ClimbResult {
  const { body, move, world } = climbFixture(direction, chainedHeight);
  let ticksUsed = 0;
  for (const targetHeight of [1, 2, 3]) {
    const step = climbToward({ world, body, move, targetHeight, budget: 30 });
    ticksUsed += step.ticksUsed;
    if (!step.success) return { direction, success: false, ticksUsed, finalHeight: body.z };
  }
  return { direction, success: true, ticksUsed, finalHeight: body.z };
}
