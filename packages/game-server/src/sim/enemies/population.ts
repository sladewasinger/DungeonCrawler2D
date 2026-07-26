import {
  CHUNK_SIZE,
  isRoomChunk,
  LEVEL,
  platformLootSpots,
} from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "../helpers.js";
import { resolveSpawnAnchor } from "../spawn.js";
import type { SimState } from "../state.js";
import { populateTestZoneChunk } from "../testzone.js";
import { spawnMiniBossEncounter } from "./miniBossPopulation.js";
import { randomChunkSpot, randomNearbySpot } from "./populationPlacement.js";
import { pickEnemyDef, pickNativeEnemyDef } from "./populationRoster.js";

export const NEAR_SPAWN_RADIUS_TILES = 60;
const NEAR_SPAWN_BONUS_ENEMIES = 2;
const ENEMY_CAP = 150;
const PLATFORM_LOOT = [
  "bandage", "torch", "vodka-bottle", "knife", "water-flask",
];

export function isNearSpawnChunk(sim: SimState, cx: number, cy: number): boolean {
  if (sim.world.floor !== 1) return false;
  const anchor = resolveSpawnAnchor(sim);
  const centerX = cx * CHUNK_SIZE + CHUNK_SIZE / 2;
  const centerY = cy * CHUNK_SIZE + CHUNK_SIZE / 2;
  return Math.hypot(centerX - anchor.x, centerY - anchor.y) <=
    NEAR_SPAWN_RADIUS_TILES;
}

export function activateChunksNearPlayers(sim: SimState): void {
  if (sim.world.level === LEVEL.Sandbox && !sim.opts.testFixtures) return;
  for (const slot of sim.players.values()) {
    const ccx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
    const ccy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    activateChunkSquare(sim, ccx, ccy);
  }
}

function activateChunkSquare(sim: SimState, ccx: number, ccy: number): void {
  for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
    for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
      const chunkKey = `${cx},${cy}`;
      if (sim.activatedChunks.has(chunkKey)) continue;
      sim.activatedChunks.add(chunkKey);
      populateChunk(sim, cx, cy);
    }
  }
}

function populateChunk(sim: SimState, cx: number, cy: number): void {
  if (isRoomChunk(cy)) return;
  if (sim.world.level === LEVEL.Sandbox) {
    if (sim.opts.testFixtures) populateTestZoneChunk(sim, cx, cy);
    return;
  }
  spawnPlatformLoot(sim, cx, cy);
  if (sim.enemies.size >= ENEMY_CAP) return;
  spawnMiniBossEncounter(sim, cx, cy);
  spawnEnemyPack(sim, cx, cy);
}

function spawnPlatformLoot(sim: SimState, cx: number, cy: number): void {
  const spots = platformLootSpots(sim.world.worldSeed, sim.world.floor, cx, cy);
  for (const spot of spots) {
    if (sim.rng.next() >= 0.6) continue;
    const index = Math.floor(sim.rng.next() * PLATFORM_LOOT.length);
    spawnItem(sim, PLATFORM_LOOT[index]!, spot.x, spot.y, 1);
  }
}

export function spawnEnemyPack(sim: SimState, cx: number, cy: number): void {
  const bonus = isNearSpawnChunk(sim, cx, cy) ? NEAR_SPAWN_BONUS_ENEMIES : 0;
  const count = 2 + Math.floor(sim.rng.next() * 3) + bonus;
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const packDef = pickNativeEnemyDef(sim, anchor.x, anchor.y);
  const outlierIndex = count > 2 && sim.rng.next() < 0.35 ? count - 1 : -1;
  for (let index = 0; index < count && sim.enemies.size < ENEMY_CAP; index++) {
    const spot = index === 0 ? anchor : randomNearbySpot(sim, anchor, 5);
    if (!spot) continue;
    const defId = index === outlierIndex
      ? pickEnemyDef(sim, spot.x, spot.y)
      : packDef;
    spawnEnemy(sim, defId, spot.x + 0.5, spot.y + 0.5);
  }
}
