import type { EnemyDecision } from "@dc2d/engine";
import type { EffectEvent } from "@dc2d/engine";
import { thinkForEnemy } from "../decision/enemyThought.js";
import type { EnemySlot, SimState } from "../../../state/state.js";

export interface EnemyStepInput {
  sim: SimState;
  enemy: EnemySlot;
  active: boolean;
  target: EnemySlot["entity"] | undefined;
  decision: EnemyDecision | undefined;
  graced: ReadonlyArray<{ x: number; y: number }>;
  effectEvents: EffectEvent[];
}

export function enemyDecisionsForActiveEnemies(input: {
  readonly sim: SimState;
  readonly enemies: readonly EnemySlot[];
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
}): Map<string, EnemyDecision> {
  const activeDecisions = new Map<string, EnemyDecision>();
  for (const enemy of input.enemies) {
    activeDecisions.set(
      enemy.entity.id,
      thinkForEnemy({ sim: input.sim, enemy, target: input.targets.get(enemy.entity.id) }),
    );
  }
  return activeDecisions;
}
