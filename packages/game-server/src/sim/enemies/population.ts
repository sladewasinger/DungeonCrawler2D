import {
  CHUNK_SIZE,
  isRoomChunk,
  isRoomIsolationChunk,
  LEVEL,
  roomLootSpotsForChunk,
} from "@dc2d/engine";
import { spawnItem } from "../core/helpers.js";
import type { SimState } from "../state/state.js";
import { populateCombatSandboxChunk } from "../sandbox/combatSandboxPopulation.js";
import { spawnEnemyPack } from "./population/packs.js";
import {
  syncObservableMiniBossEncounters,
} from "./miniBossArena/observation/observablePopulation.js";
import { ensureCombatSandboxTrainingDummies } from "./training/trainingDummy.js";

const ENEMY_CAP = 150;
const ROOM_LOOT = [
  "bandage", "torch", "vodka-bottle", "knife", "water-flask",
];

export function activateChunksNearPlayers(sim: SimState): void {
  ensureCombatSandboxTrainingDummies(sim);
  if (sim.world.level === LEVEL.Sandbox) return;
  if (sim.world.level === LEVEL.Dungeon) syncObservableMiniBossEncounters(sim);
  for (const slot of sim.players.values()) {
    const ccx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
    const ccy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    if (isRoomChunk(ccy)) continue;
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
  if (isRoomIsolationChunk(cy)) return;
  if (sim.world.level === LEVEL.CombatSandbox) {
    populateCombatSandboxChunk(sim, cx, cy);
    return;
  }
  spawnRoomLoot(sim, cx, cy);
  if (sim.enemies.size >= ENEMY_CAP) return;
  spawnEnemyPack(sim, cx, cy);
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

export { spawnEnemyPack } from "./population/packs.js";
