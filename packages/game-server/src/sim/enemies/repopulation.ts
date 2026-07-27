import {
  AOI_RADIUS,
  CHASM_DEATH_Z,
  CHUNK_SIZE,
  isRoomChunk,
  LEVEL,
  TICK_RATE,
} from "@dc2d/engine";
import { spawnEnemy } from "../helpers.js";
import { WARDEN_DEF_ID } from "../floors/constants.js";
import type { SimState } from "../state.js";
import { spawnMiniBossEncounter } from "./miniBossPopulation.js";
import { NEAR_SPAWN_RADIUS_TILES } from "./population.js";
import { tooCloseToPlayer } from "./populationPlacement.js";
import { pickEnemyDef } from "./populationRoster.js";

/**
 * Chunks populate only once, while their enemies remain allocated after
 * players leave. Recycling inactive hostiles prevents the global cap from
 * starving occupied areas as the shared world is explored.
 */
/** A cleared active area begins recovering within 30 seconds. */
export const REPOPULATE_INTERVAL_TICKS = 30 * TICK_RATE;
/** Target density for each occupied area before the shared global cap is divided. */
const NEAR_SPAWN_TARGET_COUNT = 16;
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
  const targetPerCenter = Math.min(
    NEAR_SPAWN_TARGET_COUNT,
    Math.max(4, Math.floor(ENEMY_CAP / centers.length)),
  );
  for (const center of centers) {
    restoreMiniBossEncounters(sim, center);
    const deficit = targetPerCenter -
      countEnemiesWithin(sim, center, NEAR_SPAWN_RADIUS_TILES);
    for (let n = 0; n < deficit && sim.enemies.size < ENEMY_CAP; n++) {
      const spot = randomSpotNear(sim, center, NEAR_SPAWN_RADIUS_TILES);
      if (spot) {
        spawnEnemy(
          sim,
          pickEnemyDef(sim, spot.x, spot.y),
          spot.x + 0.5,
          spot.y + 0.5,
        );
      }
    }
  }
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
    if (enemy.def.id === WARDEN_DEF_ID) continue;
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
    if (Math.hypot(enemy.entity.body.x - anchor.x, enemy.entity.body.y - anchor.y) <= radius) count++;
  }
  return count;
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
    const angle = sim.rng.next() * Math.PI * 2;
    const dist = Math.sqrt(sim.rng.next()) * radius;
    const wx = Math.floor(anchor.x + Math.cos(angle) * dist);
    const wy = Math.floor(anchor.y + Math.sin(angle) * dist);
    if (!sim.world.isWalkable(wx, wy) || sim.world.isSanctuary(wx, wy)) continue;
    if (sim.world.heightAt(wx, wy) <= CHASM_DEATH_Z) continue;
    if (tooCloseToPlayer(sim, wx, wy)) continue;
    return { x: wx, y: wy };
  }
  return null;
}
