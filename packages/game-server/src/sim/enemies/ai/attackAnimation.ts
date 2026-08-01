import { faceEntity, type EffectEvent } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import {
  advanceElementalEnemyAttack,
} from "../elemental/elementalEnemyAttack.js";
import {
  hasPendingRelease,
  liveRangedReleaseTarget,
  nextBurstRemainder,
  rangedSpitPose,
  releaseRangedAttack,
  selectBurstRemainder,
} from "./attackAnimation/rangedCadence.js";

export function beginWindup(
  enemy: EnemySlot,
  target: {
    targetId: string;
    x: number;
    y: number;
    z: number;
    spreadX?: number;
    spreadY?: number;
  },
): void {
  faceEntity(
    enemy.entity,
    target.x - enemy.entity.body.x,
    target.y - enemy.entity.body.y,
  );
  enemy.animation = {
    state: "windup",
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedWindup,
    target,
  };
}

export function advanceAttackAnimation(
  sim: SimState,
  enemy: EnemySlot,
  effectEvents: EffectEvent[],
): boolean {
  if (enemy.animation.state === "attack") {
    return tickPose(enemy, () => ({
      state: "recover",
      ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.meleeRecovery,
    }));
  }
  if (enemy.animation.state === "recover" && !enemy.def.attack.ranged) {
    return tickPose(enemy, () => ({ state: "idle", ticksRemaining: 0 }));
  }
  if (!enemy.def.attack.ranged || enemy.animation.state === "idle" || enemy.animation.state === "walk") return false;
  return advanceRangedPose(sim, enemy, effectEvents);
}

function tickPose(
  enemy: EnemySlot,
  next: () => EnemySlot["animation"],
): boolean {
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining <= 0) enemy.animation = next();
  return true;
}

function advanceRangedPose(
  sim: SimState,
  enemy: EnemySlot,
  effectEvents: EffectEvent[],
): boolean {
  const elementalComplete = advanceElementalEnemyAttack({
    sim,
    enemy,
    effectEvents,
  });
  if (elementalComplete !== null) {
    if (elementalComplete) finishRangedRelease(sim, enemy);
    return true;
  }
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining > 0) return true;
  if (enemy.animation.state === "windup") return finishWindup(sim, enemy);
  if (enemy.animation.state === "spit") return finishRangedRelease(sim, enemy);
  enemy.animation = { state: "idle", ticksRemaining: 0 };
  return true;
}

function finishWindup(sim: SimState, enemy: EnemySlot): boolean {
  const target = liveRangedReleaseTarget(sim, enemy);
  if (!target) {
    enemy.animation = rangedRecovery();
    return true;
  }
  const releasesRemaining = selectBurstRemainder(sim, enemy);
  releaseRangedAttack({ sim, enemy, target });
  enemy.animation = rangedSpitPose(enemy, target, releasesRemaining);
  return true;
}

function finishRangedRelease(sim: SimState, enemy: EnemySlot): boolean {
  if (!hasPendingRelease(enemy)) {
    enemy.animation = rangedRecovery();
    return true;
  }
  releasePendingAttack(sim, enemy);
  return true;
}

function releasePendingAttack(sim: SimState, enemy: EnemySlot): void {
  const target = liveRangedReleaseTarget(sim, enemy);
  if (!target) {
    enemy.animation = rangedRecovery();
    return;
  }
  releaseRangedAttack({ sim, enemy, target });
  enemy.animation = rangedSpitPose(enemy, target, nextBurstRemainder(enemy));
}

function rangedRecovery(): EnemySlot["animation"] {
  return {
    state: "recover",
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedRecovery,
  };
}
