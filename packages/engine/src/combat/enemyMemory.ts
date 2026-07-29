import type { Entity } from "../entities/entity.js";
import type { EnemyBrain, RememberedEnemyTarget } from "./ai.js";

export function ageEnemyMemory(brain: EnemyBrain, dt: number): void {
  brain.memorySecondsRemaining = Math.max(
    0,
    brain.memorySecondsRemaining - dt,
  );
  if (brain.memorySecondsRemaining === 0) brain.rememberedTarget = null;
}

export function rememberEnemyTarget(
  brain: EnemyBrain,
  target: Entity,
  memorySeconds: number,
): void {
  brain.rememberedTarget = {
    targetId: target.id,
    x: target.body.x,
    y: target.body.y,
    z: target.body.z,
  };
  brain.memorySecondsRemaining = memorySeconds;
}

export function forgetEnemyTarget(
  brain: EnemyBrain,
  targetId: string,
): void {
  if (brain.rememberedTarget?.targetId !== targetId) return;
  brain.rememberedTarget = null;
  brain.memorySecondsRemaining = 0;
}

export function activeEnemyMemory(
  brain: EnemyBrain,
): RememberedEnemyTarget | null {
  return brain.memorySecondsRemaining > 0 ? brain.rememberedTarget : null;
}
