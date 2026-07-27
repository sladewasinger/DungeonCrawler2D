import {
  DOWNED_DURATION,
  RESPAWN_DELAY_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { announceDeath, broadcastAnnouncement } from "./announcer/index.js";
import { ensureLifeTracked, takeLifeStats } from "./announcer/lifeStats.js";
import { ratingForRun } from "./announcer/rating.js";
import { handleBossDeath } from "./floors/boss.js";
import { WARDEN_DEF_ID } from "./floors/constants.js";
import { isBodyInChasm, spawnItem } from "./helpers.js";
import { spawnPlayerLootChest } from "./lootChests.js";
import { markMiniBossDefeated } from "./enemies/miniBossPopulation.js";
import { clearEnemyTargetsForPlayer } from "./enemies/targetLifecycle.js";
import type { EnemySlot } from "./enemyState.js";
import { awardKillXp } from "./xp.js";
import type { PlayerSlot, SimState } from "./state.js";

/** Enemy deaths (drops), downed-state flow, and player death/respawn. */

/**
 * A body that is already standing in a void dies outright — forceDeath skips
 * the shared-revive "downed" window straight to the ordinary full-loot-drop
 * respawn path resolvePlayerDeath already runs below, same as a solo kill.
 */
export function killIfInChasm(slot: PlayerSlot, world: SimState["world"]): void {
  if (slot.entity.hp <= 0 || !isBodyInChasm(world, slot.entity.body)) return;
  slot.entity.hp = 0;
  slot.forceDeath = true;
}

export function resolveDeaths(sim: SimState): void {
  resolveEnemyDeaths(sim);
  for (const slot of sim.players.values()) if (slot.connected) resolvePlayerDeath(sim, slot);
}

function resolveEnemyDeaths(sim: SimState): void {
  for (const [id, enemy] of sim.enemies) {
    if (enemy.entity.hp > 0) continue;
    resolveEnemyDeath(sim, id, enemy);
  }
}

function resolveEnemyDeath(sim: SimState, id: string, enemy: EnemySlot): void {
  sim.enemies.delete(id);
  sim.worldEvents.push({ ev: { t: "death", id }, x: enemy.entity.body.x, y: enemy.entity.body.y });
  awardKillXp(sim, enemy);
  markMiniBossDefeated(sim, enemy);
  if (enemy.def.id === WARDEN_DEF_ID) handleBossDeath(sim);
  spawnEnemyDrops(sim, enemy);
}

function spawnEnemyDrops(sim: SimState, enemy: EnemySlot): void {
  for (const drop of enemy.def.drops) {
    if (sim.rng.next() >= drop.chance) continue;
    const x = enemy.entity.body.x + (sim.rng.next() - 0.5) * 1.2;
    const y = enemy.entity.body.y + (sim.rng.next() - 0.5) * 1.2;
    spawnItem(sim, { defId: drop.item, x, y, qty: 1 });
  }
}

function resolvePlayerDeath(sim: SimState, slot: PlayerSlot): void {
  const entity = slot.entity;
  // Panel round 3b, "Small" item: seeds this slot's life-start bookkeeping the first
  // time it's ever observed here (this function runs every tick for every slot,
  // regardless of whether it dies), so the eventual takeLifeStats call below has a
  // real (within one tick) life-start reference even on a player's very first death.
  ensureLifeTracked(slot, sim.tickCount);
  const bledOut = bleedOutIfExpired(sim, slot);
  if (entity.hp > 0 || slot.respawnAtTick !== null) return;

  if (!bledOut && !slot.forceDeath && slot.downedAtTick === null) {
    downPlayer(sim, slot);
    return;
  }

  finalizePlayerDeath(sim, slot, entity);
}

function finalizePlayerDeath(sim: SimState, slot: PlayerSlot, entity: PlayerSlot["entity"]): void {
  clearEnemyTargetsForPlayer(sim, entity.id);
  sim.worldEvents.push({ ev: { t: "death", id: entity.id }, x: entity.body.x, y: entity.body.y });
  // The announcer's voice (Epic 7.13, book-fan lane): read forceDeath
  // before it's cleared below so a chasm fall gets its own mocking pool.
  // Panel round 3b, "Small" item: derive the audience rating from this life's own
  // kills/floor/survival-time instead of a hard-coded "6" — takeLifeStats resets the
  // tracking for whatever life starts next.
  announcePlayerDeath(sim, slot);
  spawnPlayerLootChest(sim, slot);
  resetDeadPlayer(sim, slot, entity);
  // Persist the terminal death destination immediately. A process crash
  // during the respawn delay must not resurrect the character downstairs.
  sim.store.recordActiveFloor(slot.stored, 1);
}

function announcePlayerDeath(sim: SimState, slot: PlayerSlot): void {
  const { killsThisLife, survivalTicks } = takeLifeStats(slot, sim.tickCount);
  const rating = ratingForRun({
    killsThisLife,
    floor: sim.world.floor,
    survivalSeconds: survivalTicks / TICK_RATE,
  }, Math.floor(sim.rng.next() * 3) - 1);
  broadcastAnnouncement(sim, announceDeath({
    tick: sim.tickCount,
    playerId: slot.entity.id,
    name: slot.entity.name ?? "?",
    chasm: slot.forceDeath,
    rating,
  }));
}

function resetDeadPlayer(sim: SimState, slot: PlayerSlot, entity: PlayerSlot["entity"]): void {
  entity.statuses = [];
  slot.downedAtTick = null;
  slot.forceDeath = false;
  delete entity.downedUntil;
  slot.respawnAtTick = sim.tickCount + RESPAWN_DELAY_TICKS;
}

/** Downed players bleed out to real death once the timer expires. */
function bleedOutIfExpired(sim: SimState, slot: PlayerSlot): boolean {
  if (slot.downedAtTick === null) return false;
  if (sim.tickCount - slot.downedAtTick < DOWNED_DURATION * TICK_RATE) return false;
  slot.entity.hp = 0;
  slot.downedAtTick = null;
  return true;
}

function downPlayer(sim: SimState, slot: PlayerSlot): void {
  slot.blocking = false;
  slot.downedAtTick = sim.tickCount;
  slot.entity.hp = 1;
  slot.entity.downedUntil = sim.tickCount + DOWNED_DURATION * TICK_RATE;
  slot.entity.statuses = [];
  clearEnemyTargetsForPlayer(sim, slot.entity.id);
  slot.outbox.push({ t: "toast", msg: "You're down! Any nearby player can revive you." });
}
