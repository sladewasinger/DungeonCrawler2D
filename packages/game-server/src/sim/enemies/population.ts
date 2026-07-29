import {
  CHUNK_SIZE,
  isRoomChunk,
  LEVEL,
  roomLootSpotsForChunk,
} from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "../core/helpers.js";
import { resolveSpawnAnchor } from "../spawn/spawn.js";
import type { SimState } from "../state/state.js";
import { populateTestZoneChunk } from "../core/testzone.js";
import { spawnMiniBossEncounter } from "./miniBossArena/population.js";
import { randomChunkSpot, randomNearbySpot } from "./populationPlacement.js";
import { pickEnemyDef, pickNativeEnemyDef } from "./populationRoster.js";
import { ENEMY_SIMULATION_TUNING } from "./configuration/enemySimulationTuning.js";

export const NEAR_SPAWN_RADIUS_TILES =
  ENEMY_SIMULATION_TUNING.population.nearSpawnRadiusTiles;
const ENEMY_CAP = 150;
const ROOM_LOOT = [
  "bandage", "torch", "vodka-bottle", "knife", "water-flask",
];

function isNearSpawnPosition(
  sim: SimState,
  position: { x: number; y: number },
): boolean {
  if (sim.world.floor !== 1) return false;
  const anchor = resolveSpawnAnchor(sim);
  return Math.hypot(position.x - anchor.x, position.y - anchor.y) <=
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
      activateChunk(sim, cx, cy);
    }
  }
}

function activateChunk(sim: SimState, cx: number, cy: number): void {
  const chunkKey = `${cx},${cy}`;
  if (sim.activatedChunks.has(chunkKey)) return;
  sim.activatedChunks.add(chunkKey);
  populateChunk(sim, cx, cy);
}

function populateChunk(sim: SimState, cx: number, cy: number): void {
  if (isRoomChunk(cy)) return;
  if (sim.world.level === LEVEL.Sandbox) return populateSandboxChunk(sim, cx, cy);
  spawnRoomLoot(sim, cx, cy);
  if (sim.enemies.size >= ENEMY_CAP) return;
  spawnMiniBossEncounter(sim, cx, cy);
  spawnEnemyPack(sim, cx, cy);
}

function populateSandboxChunk(sim: SimState, cx: number, cy: number): void {
  if (sim.opts.testFixtures) populateTestZoneChunk(sim, cx, cy);
}

function spawnRoomLoot(sim: SimState, cx: number, cy: number): void {
  const spots = roomLootSpotsForChunk({
    worldSeed: sim.world.worldSeed,
    floor: sim.world.floor,
    cx,
    cy,
  });
  for (const spot of spots) {
    if (!sim.world.isWalkable(Math.floor(spot.x), Math.floor(spot.y))) continue;
    if (sim.rng.next() >= 0.6) continue;
    const index = Math.floor(sim.rng.next() * ROOM_LOOT.length);
    spawnItem(sim, { defId: ROOM_LOOT[index]!, x: spot.x, y: spot.y, qty: 1 });
  }
}

export function spawnEnemyPack(sim: SimState, cx: number, cy: number): void {
  const anchor = randomChunkSpot(sim, cx, cy);
  if (!anchor) return;
  const count = packSize(sim, anchor);
  const packDef = pickNativeEnemyDef(sim, anchor.x, anchor.y);
  const outlierIndex = count > 2 && sim.rng.next() < 0.35 ? count - 1 : -1;
  for (let index = 0; index < count && sim.enemies.size < ENEMY_CAP; index++) {
    spawnPackMember({ sim, index, anchor, packDef, outlierIndex });
  }
}

function packSize(
  sim: SimState,
  anchor: { x: number; y: number },
): number {
  const tuning = ENEMY_SIMULATION_TUNING.population;
  return isNearSpawnPosition(sim, anchor)
    ? randomCount(sim, tuning.nearSpawnPackMinimum, tuning.nearSpawnPackMaximum)
    : randomCount(sim, tuning.dungeonPackMinimum, tuning.dungeonPackMaximum);
}

function randomCount(sim: SimState, minimum: number, maximum: number): number {
  return minimum + Math.floor(sim.rng.next() * (maximum - minimum + 1));
}

interface PackMemberInput {
  sim: SimState;
  index: number;
  anchor: { x: number; y: number };
  packDef: string;
  outlierIndex: number;
}

function spawnPackMember(input: PackMemberInput): void {
  const { sim, index, anchor, packDef, outlierIndex } = input;
  const spot = index === 0
    ? anchor
    : randomNearbySpot(
      sim,
      anchor,
      ENEMY_SIMULATION_TUNING.population.packSpreadRadiusTiles,
    );
  if (!spot) return;
  const defId = index === outlierIndex ? pickEnemyDef(sim, spot.x, spot.y) : packDef;
  spawnEnemy(sim, { defId, x: spot.x + 0.5, y: spot.y + 0.5 });
}
