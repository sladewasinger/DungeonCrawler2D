import { CHASM_DEATH_Z, CHUNK_SIZE, isRoomChunk, LEVEL, platformLootSpots } from "@dc2d/engine";
import { spawnEnemy, spawnItem } from "../helpers.js";
import type { SimState } from "../state.js";
import { populateTestZoneChunk } from "../testzone.js";

/**
 * Enemy/loot population: which chunks get random spawns, and what goes
 * in them. Spawn placement always queries the live World (backed by
 * the BSP room/corridor/district generator), never a cached layout, so
 * it stays correct as worldgen changes.
 */

/** Loot table for ruin-platform tops — a reason to make the jump. */
const PLATFORM_LOOT: string[] = ["bandage", "torch", "vodka-bottle", "knife", "water-flask"];

/** Enemy weight table: weights sum to 1 and are drawn in order. */
const ENEMY_TABLE: Array<[string, number]> = [
  ["slime", 0.4],
  ["plant-creeper", 0.25],
  ["skeleton", 0.2],
  ["spitter", 0.15],
];

/** Chunk-radius population trigger, run once per player-occupied chunk. */
export function activateChunksNearPlayers(sim: SimState): void {
  if (sim.world.level === LEVEL.Sandbox && !sim.opts.testFixtures) return;
  for (const slot of sim.players.values()) {
    const ccx = Math.floor(slot.entity.body.x / CHUNK_SIZE);
    const ccy = Math.floor(slot.entity.body.y / CHUNK_SIZE);
    for (let cy = ccy - 1; cy <= ccy + 1; cy++) {
      for (let cx = ccx - 1; cx <= ccx + 1; cx++) {
        const chunkKey = `${cx},${cy}`;
        if (sim.activatedChunks.has(chunkKey)) continue;
        sim.activatedChunks.add(chunkKey);
        populateChunk(sim, cx, cy);
      }
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
  if (sim.enemies.size > 150) return;
  spawnRandomEnemies(sim, cx, cy);
}

/** Ruin platforms carry loot on their tops — climbing pays. */
function spawnPlatformLoot(sim: SimState, cx: number, cy: number): void {
  for (const spot of platformLootSpots(sim.world.worldSeed, sim.world.floor, cx, cy)) {
    if (sim.rng.next() < 0.6) {
      // rng.next() < 1, so the floor index is always < PLATFORM_LOOT.length.
      const def = PLATFORM_LOOT[Math.floor(sim.rng.next() * PLATFORM_LOOT.length)]!;
      spawnItem(sim, def, spot.x, spot.y, 1);
    }
  }
}

function pickEnemyDef(sim: SimState): string {
  let roll = sim.rng.next();
  for (const [defId, weight] of ENEMY_TABLE) {
    if (roll < weight) return defId;
    roll -= weight;
  }
  // ENEMY_TABLE's weights sum to 1, so the loop above always returns first.
  return ENEMY_TABLE[0]![0];
}

function tooCloseToPlayer(sim: SimState, x: number, y: number): boolean {
  for (const slot of sim.players.values()) {
    if (Math.hypot(slot.entity.body.x - x, slot.entity.body.y - y) < 12) return true;
  }
  return false;
}

function spawnRandomEnemies(sim: SimState, cx: number, cy: number): void {
  const count = 2 + Math.floor(sim.rng.next() * 3);
  for (let n = 0; n < count; n++) {
    const wx = cx * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    const wy = cy * CHUNK_SIZE + Math.floor(sim.rng.next() * CHUNK_SIZE);
    // isWalkable now excludes TILE.Wall outright (walls are solid) —
    // enemies never spawn on/inside one. A rift floor tile passes
    // isWalkable (it's TILE.Floor, just deep) so it needs its own
    // height check: never seed an enemy straight into a death-pit —
    // see helpers.ts's isBodyInChasm for the shared ruling.
    if (!sim.world.isWalkable(wx, wy) || sim.world.isSanctuary(wx, wy)) continue;
    if (sim.world.heightAt(wx, wy) <= CHASM_DEATH_Z) continue;
    if (tooCloseToPlayer(sim, wx, wy)) continue;
    spawnEnemy(sim, pickEnemyDef(sim), wx + 0.5, wy + 0.5);
  }
}
