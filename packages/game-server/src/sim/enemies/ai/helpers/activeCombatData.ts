import { ENEMY_ACTIVE_RADIUS, type EnemyDecision } from "@dc2d/engine";
import { gracedClearanceCenters } from "../../../spawnSafety/spawnSafety.js";
import type { EnemySlot, SimState } from "../../../state/state.js";
import { activeEnemiesNearPlayers, assignVisibleEnemyTargets } from "../enemyTargeting.js";
import { applyAttackSpacing } from "../attackSpacing/index.js";
import { enemyPlayerSets } from "../enemyPlayerSets.js";
import { enemyDecisionsForActiveEnemies } from "./aiHelpers.js";
import { isCommittedAttackAnimation } from "./combatState.js";

export interface ActiveCombatData {
  readonly graced: ReadonlyArray<{ x: number; y: number }>;
  readonly targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  readonly decisions: ReadonlyMap<string, EnemyDecision>;
  readonly activeEnemyIds: Set<string>;
}

export function activeCombatData(sim: SimState): ActiveCombatData {
  const players = enemyPlayerSets(sim);
  const graced = gracedClearanceCenters(sim);
  const activeEnemies = activeEnemiesNearPlayers(
    sim.enemies.values(),
    players.activePlayers,
    ENEMY_ACTIVE_RADIUS,
  );
  const targets = assignVisibleEnemyTargets(
    sim,
    activeEnemies,
    players.targetablePlayers,
  );
  const { thinkingEnemies } = splitByAnimationState(
    activeEnemies,
  );
  const decisions = enemyDecisionsForActiveEnemies({
    sim,
    enemies: thinkingEnemies,
    targets,
  });
  return applyActiveCombatData({
    sim,
    activeEnemies,
    targets,
    decisions,
    graced,
  });
}

function splitByAnimationState(activeEnemies: readonly EnemySlot[]): {
  thinkingEnemies: readonly EnemySlot[];
} {
  const thinkingEnemies = activeEnemies.filter((enemy) =>
    !isCommittedAttackAnimation(enemy)
  );
  return { thinkingEnemies };
}

function applyActiveCombatData(input: {
  sim: SimState;
  activeEnemies: readonly EnemySlot[];
  targets: ReadonlyMap<string, EnemySlot["entity"] | undefined>;
  decisions: Map<string, EnemyDecision>;
  graced: ReadonlyArray<{ x: number; y: number }>;
}): ActiveCombatData {
  return {
    graced: input.graced,
    targets: input.targets,
    decisions: applyAttackSpacing({
      sim: input.sim,
      enemies: input.activeEnemies,
      targets: input.targets,
      decisions: input.decisions,
    }),
    activeEnemyIds: new Set(input.activeEnemies.map((enemy) => enemy.entity.id)),
  };
}
