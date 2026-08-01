import { faceEntity, type EffectEvent } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import {
  advanceElementalEnemyAttack,
  beginElementalEnemyAttack,
} from "../elemental/elementalEnemyAttack.js";
import { launchSpit } from "./combat.js";
import { rangeReleaseTarget, spitAnimation } from "./attackAnimation/helpers.js";

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
    if (elementalComplete) enemy.animation = rangedRecovery();
    return true;
  }
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining > 0) return true;
  if (enemy.animation.state === "windup") return finishWindup(sim, enemy);
  enemy.animation = nextRangedAnimation(enemy);
  return true;
}

function finishWindup(sim: SimState, enemy: EnemySlot): boolean {
  if (!enemy.animation.target) {
    enemy.animation = spitAnimation();
    return true;
  }
  const target = rangeReleaseTarget(sim, enemy, enemy.animation.target);
  if (target && !beginElementalEnemyAttack({ sim, enemy, target })) {
    launchSpit({
      sim,
      enemy,
      target,
    });
  }
  enemy.animation = target ? spitAnimation(target) : spitAnimation();
  return true;
}

function nextRangedAnimation(enemy: EnemySlot): EnemySlot["animation"] {
  return enemy.animation.state === "spit"
    ? rangedRecovery()
    : { state: "idle", ticksRemaining: 0 };
}

function rangedRecovery(): EnemySlot["animation"] {
  return {
    state: "recover",
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedRecovery,
  };
}
