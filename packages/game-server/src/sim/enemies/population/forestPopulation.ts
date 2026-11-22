/** Spawns outdoor forest wildlife (wolf packs, bears, spiders, boars), landmark POIs, and natural forage. */
import { CHUNK_SIZE, TILE } from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "../../core/helpers.js";
import type { SimState } from "../../state/state.js";
import {
  canAddNearSpawnEnemies,
  isInsideSpawnEnemyExclusion,
  isNearSpawnPopulationPosition,
} from "./nearSpawn.js";
import { populateChunkLandmarks } from "./forestLandmarksPopulation.js";
import { randomChunkSpot, randomNearbySpot } from "../populationPlacement.js";

const ENEMY_CAP = 150;
const ROAMING_SOLO_MOBS = ["forest-spider", "wild-boar", "slime", "chort"] as const;

export function populateForestChunkFeatures(
  sim: SimState,
  cx: number,
  cy: number,
): void {
  spawnNaturalForage(sim, cx, cy);
  if (sim.enemies.size >= ENEMY_CAP) return;
  const hasLandmark = populateChunkLandmarks(sim, cx, cy);
  spawnWolfPackOrRoamingMobs(sim, cx, cy);
  if (!hasLandmark) spawnSolitaryGrizzly(sim, cx, cy);
}

function spawnNaturalForage(sim: SimState, cx: number, cy: number): void {
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  for (let i = 0; i < 3; i++) {
    const tx = baseX + 3 + Math.floor(sim.rng.next() * (CHUNK_SIZE - 6));
    const ty = baseY + 3 + Math.floor(sim.rng.next() * (CHUNK_SIZE - 6));
    if (!sim.world.isWalkable(tx, ty)) continue;
    const defId = forageDefForTile(sim.world.tileAt(tx, ty), sim.rng.next());
    spawnItem(sim, { defId, x: tx + 0.5, y: ty + 0.5, qty: 1 });
  }
}

function forageDefForTile(tile: number, roll: number): string {
  if (tile === TILE.Bush) return "herb";
  if (roll < 0.4) return "herb";
  return roll < 0.75 ? "stick" : "flint";
}

function spawnWolfPackOrRoamingMobs(sim: SimState, cx: number, cy: number): void {
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const center = { x: anchor.x + 0.5, y: anchor.y + 0.5 };
  if (isInsideSpawnEnemyExclusion(sim, center)) return;
  if (sim.rng.next() < 0.5) {
    trySpawnWolfPack(sim, anchor);
    return;
  }
  const defId = ROAMING_SOLO_MOBS[Math.floor(sim.rng.next() * ROAMING_SOLO_MOBS.length)]!;
  trySpawnCheckedEnemy(sim, defId, anchor);
}

function trySpawnWolfPack(sim: SimState, anchor: { x: number; y: number }): void {
  const spots = collectWolfPackSpots(sim, anchor);
  const nearDefs = spots
    .filter((s) => isNearSpawnPopulationPosition(sim, { x: s.x + 0.5, y: s.y + 0.5 }))
    .map(() => "wolf");
  if (!canAddNearSpawnEnemies(sim, nearDefs)) return;
  for (const spot of spots) {
    trySpawnCheckedEnemy(sim, "wolf", spot);
  }
}

function collectWolfPackSpots(sim: SimState, anchor: { x: number; y: number }) {
  const packSize = 2 + Math.floor(sim.rng.next() * 2);
  const spots = [anchor];
  for (let i = 1; i < packSize; i++) {
    const next = randomNearbySpot(sim, anchor, 4);
    if (next) spots.push(next);
  }
  return spots;
}

function spawnSolitaryGrizzly(sim: SimState, cx: number, cy: number): void {
  const spot = randomChunkSpot(sim, cx, cy);
  if (!spot) return;
  const center = { x: spot.x + 0.5, y: spot.y + 0.5 };
  if (isNearSpawnPopulationPosition(sim, center) || isInsideSpawnEnemyExclusion(sim, center)) {
    return;
  }
  if (sim.rng.next() < 0.3 && sim.enemies.size < ENEMY_CAP) {
    spawnEnemy(sim, { defId: "grizzly-bear", x: center.x, y: center.y });
  }
}

function trySpawnCheckedEnemy(sim: SimState, defId: string, spot: { x: number; y: number }): void {
  if (sim.enemies.size >= ENEMY_CAP) return;
  const center = { x: spot.x + 0.5, y: spot.y + 0.5 };
  if (isInsideSpawnEnemyExclusion(sim, center)) return;
  if (isNearSpawnPopulationPosition(sim, center) && !canAddNearSpawnEnemies(sim, [defId])) return;
  spawnEnemy(sim, { defId, x: center.x, y: center.y });
}
