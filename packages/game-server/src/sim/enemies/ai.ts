import {
  ageEnemyMemory,
  TICK_DT,
  ENEMY_ACTIVE_RADIUS,
  type EffectEvent,
} from "@dc2d/engine";
import { isBodyInChasm } from "../core/helpers.js";
import { gracedClearanceCenters } from "../spawnSafety/spawnSafety.js";
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
import {
  activeEnemiesNearPlayers,
  assignVisibleEnemyTargets,
} from "./ai/enemyTargeting.js";
import { enemyPursuitMove } from "./ai/enemyNavigation.js";
import { enemyPlayerSets } from "./ai/enemyPlayerSets.js";
import { thinkForEnemy } from "./ai/decision/enemyThought.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";
import { prepareMiniBossArenaEnemy } from "./miniBossArena/aggro.js";
import { removeProtectedRoomEnemies } from "./roomIsolation/enemyRoomIsolation.js";

/** Per-tick enemy AI: think, move/attack, and advance attack animations. */

export function stepEnemies(sim: SimState, effectEvents: EffectEvent[]): void {
  removeProtectedRoomEnemies(sim);
  const { activePlayers, targetablePlayers } = enemyPlayerSets(sim);
  // Panel round 4 (Grinder's drift-in leak): while a player is graced,
  // hostiles may not MOVE into their clearance radius — moveEnemy clamps
  // at the boundary. Computed once per tick, not per enemy.
  const graced = gracedClearanceCenters(sim);
  const activeEnemies = activeEnemiesNearPlayers(
    sim.enemies.values(),
    activePlayers,
    ENEMY_ACTIVE_RADIUS,
  );
  const targets = assignVisibleEnemyTargets(
    sim,
    activeEnemies,
    targetablePlayers,
  );
  const activeEnemyIds = new Set(
    activeEnemies.map((enemy) => enemy.entity.id),
  );
  for (const enemy of sim.enemies.values()) {
    stepEnemy({
      sim,
      enemy,
      active: activeEnemyIds.has(enemy.entity.id),
      target: targets.get(enemy.entity.id),
      graced,
      effectEvents,
    });
  }
}

interface EnemyStepInput {
  sim: SimState;
  enemy: EnemySlot;
  active: boolean;
  target: EnemySlot["entity"] | undefined;
  graced: ReadonlyArray<{ x: number; y: number }>;
  effectEvents: EffectEvent[];
}

function stepEnemy(input: EnemyStepInput): void {
  const { sim, enemy, active } = input;
  sim.replicationMotion.set(enemy.entity.id, { x: 0, y: 0 });
  if (enemy.def.stationary) {
    enemy.entity.body.kx = 0;
    enemy.entity.body.ky = 0;
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
  const decision = thinkForEnemy(input);
  if (decision.shoot) {
    beginWindup(enemy, decision.shoot);
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
  if (decision.strike) resolveEnemyStrike({
    sim,
    enemy,
    targetId: decision.strike.targetId,
    effectEvents,
    attackTicks: ENEMY_SIMULATION_TUNING.animationTicks.meleeAttack,
  });
}
