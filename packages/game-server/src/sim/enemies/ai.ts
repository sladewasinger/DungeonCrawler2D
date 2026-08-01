import {
  ageEnemyMemory,
  commitEnemyAttack,
  TICK_DT,
  type EffectEvent,
} from "@dc2d/engine";
import { isBodyInChasm } from "../core/helpers.js";
import type { EnemySlot, SimState } from "../state/state.js";
import { revalidateEnemyTarget } from "./targetLifecycle.js";
import {
  resolveEnemyStrike,
} from "./ai/combat.js";
import {
  continueAirborneEnemyPhysics,
  moveEnemy,
} from "./ai/enemyMovement.js";
import {
  advanceAttackAnimation,
  beginWindup,
} from "./ai/attackAnimation.js";
import { enemyPursuitMove } from "./ai/enemyNavigation.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";
import { stepTrainingDummyAttack } from "./training/trainingDummyAttack.js";
import { prepareMiniBossArenaEnemy } from "./miniBossArena/aggro.js";
import { removeProtectedRoomEnemies } from "./roomIsolation/enemyRoomIsolation.js";
import {
  type EnemyStepInput,
} from "./ai/helpers/aiHelpers.js";
import { activeCombatData } from "./ai/helpers/activeCombatData.js";

/** Per-tick enemy AI: think, move/attack, and advance attack animations. */

export function stepEnemies(sim: SimState, effectEvents: EffectEvent[]): void {
  removeProtectedRoomEnemies(sim);
  const activeData = activeCombatData(sim);
  const spacedDecisions = activeData.decisions;
  for (const enemy of sim.enemies.values()) {
    stepEnemy({
      sim,
      enemy,
      active: activeData.activeEnemyIds.has(enemy.entity.id),
      target: activeData.targets.get(enemy.entity.id),
      decision: spacedDecisions.get(enemy.entity.id),
      graced: activeData.graced,
      effectEvents,
    });
  }
}

function stepEnemy(input: EnemyStepInput): void {
  const { sim, enemy, active } = input;
  sim.replicationMotion.set(enemy.entity.id, { x: 0, y: 0 });
  if (enemy.def.stationary) {
    enemy.entity.body.kx = 0;
    enemy.entity.body.ky = 0;
    stepTrainingDummyAttack(sim, enemy, input.effectEvents);
    return;
  }
  const arenaActive = prepareMiniBossArenaEnemy(sim, enemy);
  revalidateEnemyTarget(sim, enemy, input.target?.id);
  if (!active || !arenaActive) {
    ageEnemyMemory(enemy.brain, TICK_DT);
    continueAirborneEnemyPhysics(input);
    killEnemyInChasm(sim, enemy);
    return;
  }
  if (killEnemyInChasm(sim, enemy)) return;
  if (advanceAttackAnimation(sim, enemy, input.effectEvents)) {
    continueAirborneEnemyPhysics(input);
    killEnemyInChasm(sim, enemy);
    return;
  }
  executeEnemyDecision(input);
}

function killEnemyInChasm(sim: SimState, enemy: EnemySlot): boolean {
  if (!isBodyInChasm(sim.world, enemy.entity.body)) return false;
  enemy.entity.hp = 0;
  return true;
}

function executeEnemyDecision(input: EnemyStepInput): void {
  const { sim, enemy, graced, effectEvents } = input;
  if (!input.decision) return;
  const { decision } = input;
  if (decision.shoot) {
    beginWindup(enemy, decision.shoot);
    commitEnemyAttack(enemy.brain, enemy.def.attack.cooldown);
    return;
  }
  moveEnemy({
    sim,
    enemy,
    move: enemyPursuitMove({
      sim,
      enemy,
      visibleTarget: input.target,
      decision,
    }),
    graced,
  });
  if (!decision.strike) return;
  const accepted = resolveEnemyStrike({
    sim,
    enemy,
    targetId: decision.strike.targetId,
    effectEvents,
    attackTicks: ENEMY_SIMULATION_TUNING.animationTicks.meleeAttack,
  });
  if (accepted) commitEnemyAttack(enemy.brain, enemy.def.attack.cooldown);
}
