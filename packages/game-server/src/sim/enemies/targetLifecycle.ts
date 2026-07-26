import { isSpawnProtected } from "../spawnSafety.js";
import type { EnemySlot, SimState } from "../state.js";

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

export function revalidateEnemyTarget(sim: SimState, enemy: EnemySlot): void {
  const brainTargetId = enemy.brain.targetId;
  if (brainTargetId !== null && !isTargetablePlayer(sim, brainTargetId)) {
    clearEnemyTarget(enemy, brainTargetId);
  }
  const windupTargetId = enemy.animation.state === "windup"
    ? enemy.animation.target?.targetId
    : undefined;
  if (windupTargetId !== undefined && !isTargetablePlayer(sim, windupTargetId)) {
    clearEnemyTarget(enemy, windupTargetId);
  }
}

export function clearEnemyTargetsForPlayer(sim: SimState, playerId: string): void {
  for (const enemy of sim.enemies.values()) clearEnemyTarget(enemy, playerId);
}
