import type { Entity } from "../../entities/entity.js";
import type { EnemyBrain, RememberedEnemyTarget } from "./types.js";

export function ageEnemyMemory(brain: EnemyBrain, dt: number): void {
  if (brain.memoryPhase === "searching") {
    ageEnemySearch(brain, dt);
    return;
  }
  brain.memorySecondsRemaining = Math.max(
    0,
    brain.memorySecondsRemaining - dt,
  );
  if (brain.memorySecondsRemaining === 0) clearEnemyMemory(brain);
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
  brain.memoryPhase = "pursuing";
  brain.memorySearchSecondsRemaining = 0;
}

export function beginEnemySearch(
  brain: EnemyBrain,
  searchSeconds: number,
): void {
  if (brain.memoryPhase === "searching") return;
  brain.memoryPhase = "searching";
  brain.memorySearchSecondsRemaining = Math.max(0, searchSeconds);
  if (brain.memorySearchSecondsRemaining === 0) clearEnemyMemory(brain);
}

export function forgetEnemyTarget(
  brain: EnemyBrain,
  targetId: string,
): void {
  if (brain.rememberedTarget?.targetId !== targetId) return;
  clearEnemyMemory(brain);
}

export function activeEnemyMemory(
  brain: EnemyBrain,
): RememberedEnemyTarget | null {
  if (!brain.rememberedTarget) return null;
  const remaining = brain.memoryPhase === "searching"
    ? brain.memorySearchSecondsRemaining ?? 0
    : brain.memorySecondsRemaining;
  return remaining > 0 ? brain.rememberedTarget : null;
}

function ageEnemySearch(brain: EnemyBrain, dt: number): void {
  brain.memorySearchSecondsRemaining = Math.max(
    0,
    (brain.memorySearchSecondsRemaining ?? 0) - dt,
  );
  if (brain.memorySearchSecondsRemaining === 0) clearEnemyMemory(brain);
}

function clearEnemyMemory(brain: EnemyBrain): void {
  brain.rememberedTarget = null;
  brain.memorySecondsRemaining = 0;
  brain.memoryPhase = "pursuing";
  brain.memorySearchSecondsRemaining = 0;
}
