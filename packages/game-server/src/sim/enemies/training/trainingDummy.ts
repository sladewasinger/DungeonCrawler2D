import { LEVEL, TICK_RATE } from "@dc2d/engine";
import type { EnemySlot, PendingEnemyRespawn } from "../../state/enemyState.js";
import type { SimState } from "../../state/state.js";
import { findWalkableNear } from "../../spawn/spawn.js";
import { spawnEnemy } from "../enemySpawner.js";

export const TRAINING_DUMMY_DEF_ID = "training-dummy";
const TRAINING_DUMMY_ANCHOR = { x: 33.5, y: 28.5 };

/** Keeps one canonical target available in every live sandbox. */
export function ensureSandboxTrainingDummy(sim: SimState): void {
  if (!canSeedTrainingDummy(sim) || trainingDummyExists(sim)) return;
  const tile = findWalkableNear({
    sim,
    ...TRAINING_DUMMY_ANCHOR,
    maxRadius: 16,
    avoid: new Set(),
  });
  if (!tile) return;
  spawnEnemy(sim, {
    defId: TRAINING_DUMMY_DEF_ID,
    x: tile.x + 0.5,
    y: tile.y + 0.5,
  });
}

function canSeedTrainingDummy(sim: SimState): boolean {
  return sim.world.level === LEVEL.Sandbox &&
    sim.content.enemies.has(TRAINING_DUMMY_DEF_ID);
}

function trainingDummyExists(sim: SimState): boolean {
  const alive = [...sim.enemies.values()].some(
    (enemy) => enemy.def.id === TRAINING_DUMMY_DEF_ID,
  );
  return alive || sim.pendingEnemyRespawns.some(
    (request) => request.defId === TRAINING_DUMMY_DEF_ID,
  );
}

/** Defeated training targets rebuild only in the sandbox that owns them. */
export function scheduleTrainingDummyRespawn(
  sim: SimState,
  enemy: EnemySlot,
): void {
  const delay = enemy.def.respawnDelaySeconds;
  if (sim.world.level !== LEVEL.Sandbox || delay === undefined) return;
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
    spawnEnemy(sim, request);
  }
  sim.pendingEnemyRespawns.splice(0, sim.pendingEnemyRespawns.length, ...pending);
}
