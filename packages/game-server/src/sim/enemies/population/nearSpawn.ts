import { spawnRoomExteriorSite } from "@dc2d/engine";
import { WARDEN_DEF_ID } from "../../floors/constants.js";
import type { EnemySlot, SimState } from "../../state/state.js";
import { ENEMY_SIMULATION_TUNING } from "../configuration/enemySimulationTuning.js";

interface PopulationPosition {
  readonly x: number;
  readonly y: number;
}

const TUNING = ENEMY_SIMULATION_TUNING.population;
const SPAWN_CENTER = resolvePopulationCenter();
export const NEAR_SPAWN_POPULATION_RADIUS_TILES =
  TUNING.nearSpawnPopulationRadiusTiles;

export function nearSpawnPopulationCenter(): PopulationPosition {
  return SPAWN_CENTER;
}

function resolvePopulationCenter(): PopulationPosition {
  const site = spawnRoomExteriorSite();
  return site.landingPositions[0] ?? {
    x: site.door.x + 0.5,
    y: site.door.y + 1.5,
  };
}

export function usesNearSpawnPopulationRules(
  sim: SimState,
  position: PopulationPosition,
): boolean {
  return isOnSpawnFloor(sim) &&
    distanceFromSpawn(position) <= TUNING.nearSpawnPlayerRadiusTiles;
}

export function isNearSpawnPopulationPosition(
  sim: SimState,
  position: PopulationPosition,
): boolean {
  return isOnSpawnFloor(sim) &&
    distanceFromSpawn(position) <= NEAR_SPAWN_POPULATION_RADIUS_TILES;
}

export function isInsideSpawnEnemyExclusion(
  sim: SimState,
  position: PopulationPosition,
): boolean {
  return isOnSpawnFloor(sim) &&
    distanceFromSpawn(position) < TUNING.nearSpawnExclusionRadiusTiles;
}

export function canAddNearSpawnEnemy(sim: SimState, defId: string): boolean {
  return canAddNearSpawnEnemies(sim, [defId]);
}

export function canAddNearSpawnEnemies(
  sim: SimState,
  defIds: readonly string[],
): boolean {
  const counts = nearSpawnPopulationCounts(sim);
  if (counts.total + defIds.length > TUNING.nearSpawnTargetCount) return false;
  const additions = new Map<string, number>();
  for (const defId of defIds) {
    const count = (additions.get(defId) ?? 0) + 1;
    additions.set(defId, count);
    if ((counts.byType.get(defId) ?? 0) + count >
        TUNING.nearSpawnMaximumSameType) return false;
  }
  return true;
}

export function nearSpawnPopulationCount(sim: SimState): number {
  return nearSpawnPopulationCounts(sim).total;
}

function nearSpawnPopulationCounts(sim: SimState): {
  total: number;
  byType: Map<string, number>;
} {
  const byType = new Map<string, number>();
  let total = 0;
  for (const enemy of sim.enemies.values()) {
    if (!countsTowardPopulation(enemy)) continue;
    if (!isNearSpawnPopulationPosition(sim, enemy.entity.body)) continue;
    total++;
    byType.set(enemy.def.id, (byType.get(enemy.def.id) ?? 0) + 1);
  }
  return { total, byType };
}

function countsTowardPopulation(enemy: EnemySlot): boolean {
  return enemy.entity.hp > 0 &&
    enemy.def.id !== WARDEN_DEF_ID &&
    enemy.arenaKey === undefined;
}

function isOnSpawnFloor(sim: SimState): boolean {
  return sim.world.floor === 1;
}

function distanceFromSpawn(position: PopulationPosition): number {
  return Math.hypot(position.x - SPAWN_CENTER.x, position.y - SPAWN_CENTER.y);
}
