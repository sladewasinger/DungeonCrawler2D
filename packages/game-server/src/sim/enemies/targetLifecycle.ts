import { forgetEnemyTarget } from "@dc2d/engine";
import { isSpawnProtected } from "../spawnSafety/spawnSafety.js";
import type { EnemySlot, SimState } from "../state/state.js";

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
  const matchedWindup = enemy.animation.state === "windup" &&
    enemy.animation.target?.targetId === playerId;
  if (matchedBrain) enemy.brain.targetId = null;
  if (matchedWindup || (matchedBrain && enemy.animation.state === "attack")) {
    enemy.animation = { state: "idle", ticksRemaining: 0 };
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
