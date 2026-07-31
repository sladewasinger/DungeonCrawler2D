import type {
  PetBehaviorContext,
  PetBehaviorDecision,
  PetBehaviorDefinition,
} from "../types.js";

const TARD_IDLE_TOOT_CHANCE = 0.08;

export const TARD_BEHAVIOR: PetBehaviorDefinition = {
  decisionIntervalTicks: 20,
  choose(context): PetBehaviorDecision | undefined {
    if (movementStarted(context)) return tootDecision();
    if (!context.waiting || context.sim.rng.next() >= TARD_IDLE_TOOT_CHANCE) return undefined;
    return tootDecision();
  },
};

function movementStarted(context: PetBehaviorContext): boolean {
  return context.ownerStartedMoving || context.petStartedMoving;
}

function tootDecision(): PetBehaviorDecision {
  return {
    behavior: "toot",
    durationTicks: 24,
    cooldownTicks: 8 * 20,
  };
}
