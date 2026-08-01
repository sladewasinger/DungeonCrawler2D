import { forgetEnemyTarget } from "@dc2d/engine";
import { isSpawnProtected } from "../spawnSafety/spawnSafety.js";
import type { EnemySlot, SimState } from "../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";

function isTargetablePlayer(sim: SimState, playerId: string): boolean {
  const slot = sim.players.get(playerId);
  return slot !== undefined &&
    slot.connected &&
    slot.entity.hp > 0 &&
    slot.downedAtTick === null &&
    !isSpawnProtected(slot, sim.tickCount) &&
    !sim.effects.inSanctuary(slot.entity);
}

function clearEnemyTarget(enemy: EnemySlot, playerId: string): void {
  const matchedBrain = enemy.brain.targetId === playerId;
  if (matchedBrain) enemy.brain.targetId = null;
  if (clearPendingRangedTarget(enemy, playerId)) return;
  clearWindupOrMeleeTarget(enemy, playerId, matchedBrain);
}

function clearPendingRangedTarget(enemy: EnemySlot, playerId: string): boolean {
  if (enemy.animation.state !== "spit") return false;
  if (enemy.animation.target?.targetId !== playerId) return false;
  if ((enemy.animation.releasesRemaining ?? 0) <= 0) return false;
  enemy.animation = {
    state: "recover",
    ticksRemaining: ENEMY_SIMULATION_TUNING.animationTicks.rangedRecovery,
  };
  delete enemy.elementalAttack;
  return true;
}

function clearWindupOrMeleeTarget(
  enemy: EnemySlot,
  playerId: string,
  matchedBrain: boolean,
): void {
  const matchedWindup = enemy.animation.state === "windup" &&
    enemy.animation.target?.targetId === playerId;
  const matchedMelee = matchedBrain && enemy.animation.state === "attack";
  if (!matchedWindup && !matchedMelee) return;
  if (matchedWindup || matchedMelee) {
    enemy.animation = { state: "idle", ticksRemaining: 0 };
    delete enemy.elementalAttack;
  }
}

function clearEnemyTargetAndMemory(
  enemy: EnemySlot,
  playerId: string,
): void {
  clearEnemyTarget(enemy, playerId);
  forgetEnemyTarget(enemy.brain, playerId);
}

export function revalidateEnemyTarget(
  sim: SimState,
  enemy: EnemySlot,
  assignedTargetId: string | undefined,
): void {
  clearInvalidTarget({
    sim,
    enemy,
    targetId: enemy.brain.targetId,
    assignedTargetId,
  });
  const windupTargetId = enemy.animation.state === "windup"
    ? enemy.animation.target?.targetId
    : undefined;
  clearInvalidTarget({ sim, enemy, targetId: windupTargetId, assignedTargetId });
  adoptAssignedTarget({
    sim,
    enemy,
    targetId: undefined,
    assignedTargetId,
  });
}

function adoptAssignedTarget(input: TargetValidity): void {
  const { sim, enemy, assignedTargetId } = input;
  if (assignedTargetId === undefined || enemy.brain.targetId !== null) return;
  if (isTargetablePlayer(sim, assignedTargetId)) {
    enemy.brain.targetId = assignedTargetId;
  }
}

interface TargetValidity {
  readonly sim: SimState;
  readonly enemy: EnemySlot;
  readonly targetId: string | null | undefined;
  readonly assignedTargetId: string | undefined;
}

function clearInvalidTarget(input: TargetValidity): void {
  const { sim, enemy, targetId, assignedTargetId } = input;
  if (targetId === null || targetId === undefined) return;
  if (!isTargetablePlayer(sim, targetId)) {
    clearEnemyTargetAndMemory(enemy, targetId);
    return;
  }
  if (targetId === assignedTargetId) return;
  clearEnemyTarget(enemy, targetId);
}

export function clearEnemyTargetsForPlayer(sim: SimState, playerId: string): void {
  for (const enemy of sim.enemies.values()) {
    clearEnemyTargetAndMemory(enemy, playerId);
  }
}
