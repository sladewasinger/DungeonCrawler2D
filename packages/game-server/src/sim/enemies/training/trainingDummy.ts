import {
  COMBAT_SANDBOX_LAYOUT,
  LEVEL,
  TICK_RATE,
  type CombatSandboxPoint,
  type Entity,
} from "@dc2d/engine";
import type { EnemySlot, PendingEnemyRespawn } from "../../state/enemyState.js";
import type { SimState } from "../../state/state.js";
import { spawnEnemy } from "../enemySpawner.js";

export const TRAINING_DUMMY_DEF_ID = "training-dummy";
export const SWORD_TRAINING_DUMMY_DEF_ID = "sword-training-dummy";

const TRAINING_TARGETS = [
  {
    defId: TRAINING_DUMMY_DEF_ID,
    position: COMBAT_SANDBOX_LAYOUT.trainingDummies.passive,
  },
  {
    defId: SWORD_TRAINING_DUMMY_DEF_ID,
    position: COMBAT_SANDBOX_LAYOUT.trainingDummies.sword,
  },
] as const;

interface TrainingTarget {
  readonly defId: string;
  readonly position: CombatSandboxPoint & {
    readonly facing?: { readonly x: number; readonly y: number };
  };
}

/** Keeps both configured targets available only in the combat sandbox. */
export function ensureCombatSandboxTrainingDummies(sim: SimState): void {
  if (sim.world.level !== LEVEL.CombatSandbox) return;
  for (const target of TRAINING_TARGETS) ensureTrainingTarget(sim, target);
}

function ensureTrainingTarget(
  sim: SimState,
  target: TrainingTarget,
): void {
  if (!sim.content.enemies.has(target.defId) || trainingTargetExists(sim, target.defId)) return;
  const entity = spawnEnemy(sim, { defId: target.defId, ...target.position });
  applyConfiguredFacing(entity, target.position.facing);
}

function applyConfiguredFacing(
  entity: Entity,
  facing: { readonly x: number; readonly y: number } | undefined,
): void {
  if (facing) entity.facing = { ...facing };
}

function trainingTargetExists(sim: SimState, defId: string): boolean {
  const alive = [...sim.enemies.values()].some(
    (enemy) => enemy.def.id === defId,
  );
  return alive || sim.pendingEnemyRespawns.some(
    (request) => request.defId === defId,
  );
}

/** Defeated training targets rebuild only in the combat sandbox that owns them. */
export function scheduleTrainingDummyRespawn(
  sim: SimState,
  enemy: EnemySlot,
): void {
  const delay = enemy.def.respawnDelaySeconds;
  if (sim.world.level !== LEVEL.CombatSandbox || delay === undefined) return;
  sim.pendingEnemyRespawns.push({
    defId: enemy.def.id,
    x: enemy.entity.body.x,
    y: enemy.entity.body.y,
    dueTick: sim.tickCount + Math.round(delay * TICK_RATE),
  });
}

/** Restores due targets at their authored spot with fresh health and statuses. */
export function respawnTrainingDummies(sim: SimState): void {
  const pending: PendingEnemyRespawn[] = [];
  for (const request of sim.pendingEnemyRespawns) {
    if (request.dueTick > sim.tickCount) {
      pending.push(request);
      continue;
    }
    const entity = spawnEnemy(sim, request);
    applyConfiguredFacing(entity, configuredFacingFor(request.defId));
  }
  sim.pendingEnemyRespawns.splice(0, sim.pendingEnemyRespawns.length, ...pending);
}

function configuredFacingFor(
  defId: string,
): { readonly x: number; readonly y: number } | undefined {
  return defId === SWORD_TRAINING_DUMMY_DEF_ID
    ? COMBAT_SANDBOX_LAYOUT.trainingDummies.sword.facing
    : undefined;
}
