import {
  AOI_RADIUS,
  CHUNK_SIZE,
  LEVEL,
  isRoomChunk,
  miniBossArenaKey,
} from "@dc2d/engine";
import type { SimState } from "../../../state/state.js";
import { chunksWithinTileRadius } from "../landmarks/nearbyChunks.js";
import {
  miniBossEncounterAlive,
  spawnMiniBossEncounter,
} from "../population.js";
import { clearMiniBossArena } from "../runtime.js";

interface ArenaChunk {
  readonly cx: number;
  readonly cy: number;
}

interface ObservableArenaState {
  arenaKeys: Set<string>;
}

const observableArenaStates = new WeakMap<SimState, ObservableArenaState>();

/**
 * Keeps deterministic arena encounters alive exactly while at least one
 * connected crawler can receive entities from their chunk.
 */
export function syncObservableMiniBossEncounters(sim: SimState): void {
  if (sim.world.level !== LEVEL.Dungeon) return;
  const chunks = observableArenaChunks(sim);
  const nextKeys = new Set(chunks.keys());
  const state = observableArenaStateFor(sim);
  ensureObservableEncounters(sim, chunks, state.arenaKeys);
  removeUnobservableEncounters(sim, nextKeys);
  state.arenaKeys = nextKeys;
}

function observableArenaChunks(sim: SimState): Map<string, ArenaChunk> {
  const chunks = new Map<string, ArenaChunk>();
  for (const slot of sim.players.values()) {
    if (!slot.connected || playerIsInReservedRoom(slot.entity.body.y)) continue;
    for (const chunk of chunksWithinTileRadius(slot.entity.body, AOI_RADIUS)) {
      chunks.set(arenaKey(sim, chunk), chunk);
    }
  }
  return chunks;
}

function playerIsInReservedRoom(y: number): boolean {
  return isRoomChunk(Math.floor(y / CHUNK_SIZE));
}

function ensureObservableEncounters(
  sim: SimState,
  chunks: ReadonlyMap<string, ArenaChunk>,
  previousKeys: ReadonlySet<string>,
): void {
  for (const [key, chunk] of chunks) {
    if (previousKeys.has(key) && encounterAlreadyAvailable(sim, key)) continue;
    spawnMiniBossEncounter(sim, chunk.cx, chunk.cy);
  }
}

function encounterAlreadyAvailable(sim: SimState, arenaKey: string): boolean {
  return sim.defeatedMiniBossArenas.has(arenaKey) ||
    miniBossEncounterAlive(sim, arenaKey);
}

function removeUnobservableEncounters(
  sim: SimState,
  observableKeys: ReadonlySet<string>,
): void {
  const removedArenaKeys = new Set<string>();
  for (const [id, enemy] of sim.enemies) {
    if (!enemy.arenaKey || observableKeys.has(enemy.arenaKey)) continue;
    removedArenaKeys.add(enemy.arenaKey);
    sim.enemies.delete(id);
    sim.replicationMotion.delete(id);
  }
  for (const arenaKey of removedArenaKeys) clearMiniBossArena(sim, arenaKey);
}

function arenaKey(sim: SimState, chunk: ArenaChunk): string {
  return miniBossArenaKey({
    floor: sim.world.floor,
    cx: chunk.cx,
    cy: chunk.cy,
  });
}

function observableArenaStateFor(sim: SimState): ObservableArenaState {
  const existing = observableArenaStates.get(sim);
  if (existing) return existing;
  const created = { arenaKeys: new Set<string>() };
  observableArenaStates.set(sim, created);
  return created;
}
