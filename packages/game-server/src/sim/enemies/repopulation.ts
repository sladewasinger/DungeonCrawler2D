import {
  AOI_RADIUS,
  CHUNK_SIZE,
  isRoomChunk,
  LEVEL,
  TICK_RATE,
} from "@dc2d/engine";
import { spawnEnemy } from "../core/helpers.js";
import { WARDEN_DEF_ID } from "../floors/constants.js";
import type { EnemySlot, SimState } from "../state/state.js";
import { spawnMiniBossEncounter } from "./miniBossArena/population.js";
import {
  canAddNearSpawnEnemy,
  isNearSpawnPopulationPosition,
  nearSpawnPopulationCenter,
  NEAR_SPAWN_POPULATION_RADIUS_TILES,
  usesNearSpawnPopulationRules,
} from "./population/nearSpawn.js";
import { randomSpawnWithinRadius } from "./populationPlacement.js";
import { pickAllowedEnemyDef, pickEnemyDef } from "./populationRoster.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";

/**
 * Chunks populate only once, while their enemies remain allocated after
 * players leave. Recycling inactive hostiles prevents the global cap from
 * starving occupied areas as the shared world is explored.
 */
/** A cleared active area begins recovering within 30 seconds. */
export const REPOPULATE_INTERVAL_TICKS = 30 * TICK_RATE;
/** Target density for each occupied area before the shared global cap is divided. */
const REPOPULATE_ATTEMPTS_PER_ENEMY = 40;
const ENEMY_CAP = 150;
const RETAIN_RADIUS_TILES =
  ENEMY_SIMULATION_TUNING.population.occupiedAreaRadiusTiles + AOI_RADIUS;

interface PopulationCenter {
  x: number;
  y: number;
}

/** Recycles inactive hostiles and tops up occupied overworld areas on every dungeon floor. */
export function repopulateNearSpawn(sim: SimState): void {
  if (sim.world.level !== LEVEL.Dungeon) return;
  const centers = populationCenters(sim);
  if (centers.length === 0) return;
  recycleInactiveEnemies(sim, centers);
  for (const center of centers) {
    repopulateCenter(sim, center, centers.length);
  }
}

function targetCount(sim: SimState, center: PopulationCenter, centerCount: number): number {
  if (usesNearSpawnPopulationRules(sim, center)) {
    return ENEMY_SIMULATION_TUNING.population.nearSpawnTargetCount;
  }
  return Math.min(
    ENEMY_SIMULATION_TUNING.population.occupiedAreaTargetCount,
    Math.max(4, Math.floor(ENEMY_CAP / centerCount)),
  );
}

function repopulateCenter(
  sim: SimState,
  center: PopulationCenter,
  centerCount: number,
): void {
  restoreMiniBossEncounters(sim, center);
  const nearSpawn = usesNearSpawnPopulationRules(sim, center);
  const anchor = nearSpawn ? nearSpawnPopulationCenter() : center;
  const target = targetCount(sim, center, centerCount);
  const radius = nearSpawn
    ? NEAR_SPAWN_POPULATION_RADIUS_TILES
    : ENEMY_SIMULATION_TUNING.population.occupiedAreaRadiusTiles;
  const deficit = target - countEnemiesWithin(sim, anchor, radius);
  for (let count = 0; count < deficit && sim.enemies.size < ENEMY_CAP; count++) {
    spawnRandomEnemyNear({ sim, center: anchor, radius });
  }
}

interface RandomEnemyPopulation {
  readonly sim: SimState;
  readonly center: PopulationCenter;
  readonly radius: number;
}

function spawnRandomEnemyNear(input: RandomEnemyPopulation): void {
  const { sim, center, radius } = input;
  const spot = randomSpawnWithinRadius({
    sim,
    anchor: center,
    radius,
    attempts: REPOPULATE_ATTEMPTS_PER_ENEMY,
  });
  if (!spot) return;
  const defId = repopulationEnemyDef(sim, spot);
  if (!defId) return;
  spawnEnemy(sim, { defId, x: spot.x + 0.5, y: spot.y + 0.5 });
}

function repopulationEnemyDef(
  sim: SimState,
  spot: PopulationCenter,
): string | null {
  if (!isNearSpawnPopulationPosition(sim, spot)) {
    return pickEnemyDef(sim, spot.x, spot.y);
  }
  return pickAllowedEnemyDef({
    sim,
    x: spot.x,
    y: spot.y,
    isAllowed: (defId) => canAddNearSpawnEnemy(sim, defId),
  });
}

function restoreMiniBossEncounters(sim: SimState, center: PopulationCenter): void {
  const ccx = Math.floor(center.x / CHUNK_SIZE);
  const ccy = Math.floor(center.y / CHUNK_SIZE);
  for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
    for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
      spawnMiniBossEncounter(sim, cx, cy);
    }
  }
}

function populationCenters(sim: SimState): PopulationCenter[] {
  const centers: PopulationCenter[] = [];
  for (const slot of sim.players.values()) {
    if (!slot.connected) continue;
    const cy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    if (isRoomChunk(cy)) continue;
    centers.push({ x: slot.entity.body.x, y: slot.entity.body.y });
  }
  return centers;
}

function recycleInactiveEnemies(sim: SimState, centers: PopulationCenter[]): void {
  for (const [id, enemy] of sim.enemies) {
    if (enemy.def.id === WARDEN_DEF_ID || enemy.arenaKey) continue;
    const retained = centers.some((center) =>
      Math.hypot(enemy.entity.body.x - center.x, enemy.entity.body.y - center.y) <=
        RETAIN_RADIUS_TILES
    );
    if (retained) continue;
    sim.enemies.delete(id);
    sim.replicationMotion.delete(id);
  }
}

function countEnemiesWithin(sim: SimState, anchor: { x: number; y: number }, radius: number): number {
  let count = 0;
  for (const enemy of sim.enemies.values()) {
    if (!countsTowardPopulation(enemy)) continue;
    if (Math.hypot(enemy.entity.body.x - anchor.x, enemy.entity.body.y - anchor.y) <= radius) count++;
  }
  return count;
}

function countsTowardPopulation(enemy: EnemySlot): boolean {
  return enemy.entity.hp > 0 &&
    enemy.def.id !== WARDEN_DEF_ID &&
    enemy.arenaKey === undefined;
}
