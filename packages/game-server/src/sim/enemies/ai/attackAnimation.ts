import { faceEntity } from "@dc2d/engine";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";
import { launchSpit } from "./combat.js";

export function beginWindup(
  enemy: EnemySlot,
  target: { targetId: string; x: number; y: number; z: number },
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

/** Returns true while the enemy is committed to an attack pose. */
export function advanceAttackAnimation(
  sim: SimState,
  enemy: EnemySlot,
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
  if (!enemy.def.attack.ranged ||
      enemy.animation.state === "idle" ||
      enemy.animation.state === "walk") return false;
  return advanceRangedPose(sim, enemy);
}

function tickPose(
  enemy: EnemySlot,
  next: () => EnemySlot["animation"],
): boolean {
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining <= 0) enemy.animation = next();
  return true;
}

function advanceRangedPose(sim: SimState, enemy: EnemySlot): boolean {
  enemy.animation.ticksRemaining -= 1;
  if (enemy.animation.ticksRemaining > 0) return true;
  if (enemy.animation.state === "windup") return finishWindup(sim, enemy);
  enemy.animation = nextRangedAnimation(enemy);
  return true;
}

function finishWindup(sim: SimState, enemy: EnemySlot): boolean {
  const target = enemy.animation.target;
  if (target) {
    launchSpit({
      sim,
      entity: enemy.entity,
      tags: enemy.def.tags,
      target,
    });
  }
  enemy.animation = target ? spitAnimation(target) : spitAnimation();
  return true;
}

function spitAnimation(
  target?: EnemySlot["animation"]["target"],
): EnemySlot["animation"] {
  const animation = {
    state: "spit" as const,
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedAttack,
  };
  return target ? { ...animation, target } : animation;
}

function nextRangedAnimation(enemy: EnemySlot): EnemySlot["animation"] {
  return enemy.animation.state === "spit"
    ? {
      state: "recover",
      ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedRecovery,
    }
    : { state: "idle", ticksRemaining: 0 };
}
