import type { EnemyDecision, MoveInput } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { withEnemyMemoryPath } from "./enemyMemoryNavigation.js";
import { withLedgeTransitionJump } from "./enemyPursuit.js";

interface EnemyNavigationInput {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly visibleTarget: EnemySlot["entity"] | undefined;
  readonly decision: EnemyDecision;
}

export function enemyPursuitMove(
  input: EnemyNavigationInput,
): MoveInput {
  const { sim, enemy, visibleTarget, decision } = input;
  const routeMove = withEnemyMemoryPath({
    sim,
    enemy,
    visibleTarget,
    pursuit: decision.pursuit,
    move: decision.move,
  });
  if (!visibleTarget && decision.pursuit) return routeMove;
  return withLedgeTransitionJump({
    world: sim.world,
    enemy: enemy.entity,
    move: routeMove,
  });
}
