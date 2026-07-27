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
    sim.enemies.delete(id);
    sim.worldEvents.push({
      ev: { t: "death", id },
      x: enemy.entity.body.x,
      y: enemy.entity.body.y,
    });
    // --- XP award hook (Epic 11 core / Epic 7.13, XP lane) — other lanes
    // touching this file this wave, leave this call alone. ---
    awardKillXp(sim, enemy);
    markMiniBossDefeated(sim, enemy);
    // --- end XP award hook ---
    // Epic 7.14 (The Descent): the Warden's own XP burst to the whole
    // arena, gate unseal, and respawn timer — additional to (not instead
    // of) the ordinary awardKillXp last-hit award above (ASSUMPTION #129).
    if (enemy.def.id === WARDEN_DEF_ID) handleBossDeath(sim);
    for (const drop of enemy.def.drops) {
      if (sim.rng.next() >= drop.chance) continue;
      const jx = (sim.rng.next() - 0.5) * 1.2;
      const jy = (sim.rng.next() - 0.5) * 1.2;
      spawnItem(sim, drop.item, enemy.entity.body.x + jx, enemy.entity.body.y + jy, 1);
    }
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

  clearEnemyTargetsForPlayer(sim, entity.id);
  sim.worldEvents.push({ ev: { t: "death", id: entity.id }, x: entity.body.x, y: entity.body.y });
  // The announcer's voice (Epic 7.13, book-fan lane): read forceDeath
  // before it's cleared below so a chasm fall gets its own mocking pool.
  // Panel round 3b, "Small" item: derive the audience rating from this life's own
  // kills/floor/survival-time instead of a hard-coded "6" — takeLifeStats resets the
  // tracking for whatever life starts next.
  const { killsThisLife, survivalTicks } = takeLifeStats(slot, sim.tickCount);
  // Panel round 4: a small deterministic per-death wobble from the seeded
  // sim Rng — {-1, 0, +1} — so two similar scrub deaths don't both read
  // "5 out of 10" (rating.ts clamps it; ASSUMPTION #382).
  const jitter = Math.floor(sim.rng.next() * 3) - 1;
  const rating = ratingForRun(
    {
      killsThisLife,
      floor: sim.world.floor,
      survivalSeconds: survivalTicks / TICK_RATE,
    },
    jitter,
  );
  broadcastAnnouncement(
    sim,
    announceDeath(sim.tickCount, entity.id, entity.name ?? "?", slot.forceDeath, rating),
  );
  spawnPlayerLootChest(sim, slot);
  entity.statuses = [];
  slot.downedAtTick = null;
  slot.forceDeath = false;
  delete entity.downedUntil;
  slot.respawnAtTick = sim.tickCount + RESPAWN_DELAY_TICKS;
  // Persist the terminal death destination immediately. A process crash
  // during the respawn delay must not resurrect the character downstairs.
  sim.store.recordActiveFloor(slot.stored, 1);
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
