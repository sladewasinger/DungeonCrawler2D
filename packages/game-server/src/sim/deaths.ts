import { DOWNED_DURATION, RESPAWN_DELAY_TICKS, TICK_RATE } from "@dc2d/engine";
import { spawnItem } from "./helpers";
import { dropAllInventory } from "./inventory";
import type { SimState } from "./state";

/** Enemy deaths (drops), downed-state flow, and player death/respawn. */

export function resolveDeaths(sim: SimState): void {
  for (const [id, enemy] of sim.enemies) {
    if (enemy.entity.hp > 0) continue;
    sim.enemies.delete(id);
    sim.worldEvents.push({
      ev: { t: "death", id },
      x: enemy.entity.body.x,
      y: enemy.entity.body.y,
    });
    for (const drop of enemy.def.drops) {
      if (sim.rng.next() < drop.chance) {
        const jx = (sim.rng.next() - 0.5) * 1.2;
        const jy = (sim.rng.next() - 0.5) * 1.2;
        spawnItem(sim, drop.item, enemy.entity.body.x + jx, enemy.entity.body.y + jy, 1);
      }
    }
  }

  for (const slot of sim.players.values()) {
    const entity = slot.entity;
    // Bleed-out for downed players.
    if (
      slot.downedAtTick !== null &&
      sim.tickCount - slot.downedAtTick >= DOWNED_DURATION * TICK_RATE
    ) {
      entity.hp = 0;
      slot.downedAtTick = null;
    }
    if (entity.hp > 0 || slot.respawnAtTick !== null) continue;

    const party = slot.partyId ? sim.parties.get(slot.partyId) : undefined;
    const conscious = party
      ? [...party.members].some((m) => {
          const member = sim.players.get(m);
          return m !== entity.id && member && member.entity.hp > 0 && member.downedAtTick === null;
        })
      : false;
    if (party && conscious && slot.downedAtTick === null) {
      // Downed, not dead: a party member can still get you up.
      slot.downedAtTick = sim.tickCount;
      entity.hp = 1;
      entity.downedUntil = sim.tickCount + DOWNED_DURATION * TICK_RATE;
      entity.statuses = [];
      slot.outbox.push({ t: "toast", msg: "You're down! A party member can revive you." });
      continue;
    }

    // Real death: full loot drop, distant respawn, stash untouched.
    sim.worldEvents.push({ ev: { t: "death", id: entity.id }, x: entity.body.x, y: entity.body.y });
    dropAllInventory(sim, slot);
    entity.statuses = [];
    slot.downedAtTick = null;
    delete entity.downedUntil;
    slot.respawnAtTick = sim.tickCount + RESPAWN_DELAY_TICKS;
  }
}
