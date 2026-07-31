import type { PetBehaviorDecision, PetBehaviorDefinition } from "../types.js";

const DOUX_TAIL_CHASE_CHANCE = 0.35;

export const DOUX_BEHAVIOR: PetBehaviorDefinition = {
  decisionIntervalTicks: 3 * 20,
  choose(context): PetBehaviorDecision | undefined {
    if (!context.waiting || context.sim.rng.next() >= DOUX_TAIL_CHASE_CHANCE) {
      return undefined;
    }
    return {
      behavior: "tail_chase",
      durationTicks: 3 * 20,
      cooldownTicks: 10 * 20,
    };
  },
};
