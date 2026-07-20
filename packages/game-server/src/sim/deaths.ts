import { DOWNED_DURATION, RESPAWN_DELAY_TICKS, TICK_RATE } from "@dc2d/engine";
import { announceDeath, broadcastAnnouncement } from "./announcer/index.js";
import { handleBossDeath } from "./floors/boss.js";
import { WARDEN_DEF_ID } from "./floors/constants.js";
import { isBodyInChasm, spawnItem } from "./helpers.js";
import { dropAllInventory } from "./inventory.js";
import { awardKillXp } from "./xp.js";
import type { PlayerSlot, SimState } from "./state.js";

/** Enemy deaths (drops), downed-state flow, and player death/respawn. */

/**
 * Chasm = death (design ruling): a player standing in a rift dies outright
 * — forceDeath skips the party-revive "downed" window straight to the
 * ordinary full-loot-drop respawn path resolvePlayerDeath already runs
 * below, same as a solo kill.
 */
export function killIfInChasm(slot: PlayerSlot): void {
  if (slot.entity.hp <= 0 || !isBodyInChasm(slot.entity.body)) return;
  slot.entity.hp = 0;
  slot.forceDeath = true;
}

export function resolveDeaths(sim: SimState): void {
  resolveEnemyDeaths(sim);
  for (const slot of sim.players.values()) resolvePlayerDeath(sim, slot);
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
  bleedOutIfExpired(sim, slot);
  if (entity.hp > 0 || slot.respawnAtTick !== null) return;

  if (!slot.forceDeath && slot.downedAtTick === null && hasConsciousPartyMember(sim, slot)) {
    downPlayer(sim, slot);
    return;
  }

  sim.worldEvents.push({ ev: { t: "death", id: entity.id }, x: entity.body.x, y: entity.body.y });
  // The announcer's voice (Epic 7.13, book-fan lane): read forceDeath
  // before it's cleared below so a chasm fall gets its own mocking pool.
  broadcastAnnouncement(
    sim,
    announceDeath(sim.tickCount, entity.id, entity.name ?? "?", slot.forceDeath),
  );
  dropAllInventory(sim, slot);
  entity.statuses = [];
  slot.downedAtTick = null;
  slot.forceDeath = false;
  delete entity.downedUntil;
  slot.respawnAtTick = sim.tickCount + RESPAWN_DELAY_TICKS;
}

/** Downed players bleed out to real death once the timer expires. */
function bleedOutIfExpired(sim: SimState, slot: PlayerSlot): void {
  if (slot.downedAtTick === null) return;
  if (sim.tickCount - slot.downedAtTick < DOWNED_DURATION * TICK_RATE) return;
  slot.entity.hp = 0;
  slot.downedAtTick = null;
}

function hasConsciousPartyMember(sim: SimState, slot: PlayerSlot): boolean {
  const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;
  if (!party) return false;
  for (const memberId of party.members) {
    if (memberId === slot.entity.id) continue;
    const member = sim.players.get(memberId);
    if (member && member.entity.hp > 0 && member.downedAtTick === null) return true;
  }
  return false;
}

function downPlayer(sim: SimState, slot: PlayerSlot): void {
  slot.downedAtTick = sim.tickCount;
  slot.entity.hp = 1;
  slot.entity.downedUntil = sim.tickCount + DOWNED_DURATION * TICK_RATE;
  slot.entity.statuses = [];
  slot.outbox.push({ t: "toast", msg: "You're down! A party member can revive you." });
}
