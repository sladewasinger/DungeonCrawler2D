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
import { NEAR_SPAWN_RADIUS_TILES } from "./population.js";
import { validEnemySpawn } from "./populationPlacement.js";
import { pickEnemyDef } from "./populationRoster.js";
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
const RETAIN_RADIUS_TILES = NEAR_SPAWN_RADIUS_TILES + AOI_RADIUS;

interface PopulationCenter {
  x: number;
  y: number;
}

/** Recycles inactive hostiles and tops up occupied overworld areas on every dungeon floor. */
export function repopulateNearSpawn(sim: SimState): void {
  if (sim.world.level === LEVEL.Sandbox) return;
  const centers = populationCenters(sim);
  if (centers.length === 0) return;
  recycleInactiveEnemies(sim, centers);
  const targetPerCenter = targetCount(centers.length);
  for (const center of centers) {
    repopulateCenter(sim, center, targetPerCenter);
  }
}

function targetCount(centerCount: number): number {
  return Math.min(
    ENEMY_SIMULATION_TUNING.population.occupiedAreaTargetCount,
    Math.max(4, Math.floor(ENEMY_CAP / centerCount)),
  );
}

function repopulateCenter(sim: SimState, center: PopulationCenter, target: number): void {
  restoreMiniBossEncounters(sim, center);
  const deficit = target - countEnemiesWithin(sim, center, NEAR_SPAWN_RADIUS_TILES);
  for (let count = 0; count < deficit && sim.enemies.size < ENEMY_CAP; count++) {
    spawnRandomEnemyNear(sim, center);
  }
}

function spawnRandomEnemyNear(sim: SimState, center: PopulationCenter): void {
  const spot = randomSpotNear(sim, center, NEAR_SPAWN_RADIUS_TILES);
  if (!spot) return;
  spawnEnemy(sim, { defId: pickEnemyDef(sim, spot.x, spot.y), x: spot.x + 0.5, y: spot.y + 0.5 });
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

/** Random valid placement within `radius` of `anchor` — mirrors spawn.ts's
 * sampleWithinRadius, but this module owns its own placement validity
 * (chasm/sanctuary/player-clearance), same rules population.ts seeds with. */
function randomSpotNear(
  sim: SimState,
  anchor: { x: number; y: number },
  radius: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < REPOPULATE_ATTEMPTS_PER_ENEMY; attempt++) {
    const spot = randomRadiusTile(sim, anchor, radius);
    if (validEnemySpawn(sim, spot.x, spot.y)) return spot;
  }
  return null;
}

function randomRadiusTile(sim: SimState, anchor: PopulationCenter, radius: number): PopulationCenter {
  const angle = sim.rng.next() * Math.PI * 2;
  const distance = Math.sqrt(sim.rng.next()) * radius;
  return {
    x: Math.floor(anchor.x + Math.cos(angle) * distance),
    y: Math.floor(anchor.y + Math.sin(angle) * distance),
  };
}
