import {
  LOOT_CHEST_LIFETIME_TICKS,
  LOOT_CHEST_LOCK_TICKS,
  TICK_RATE,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import {
  closeLootChest,
  openLootChest,
  openLootChestById,
  takeLoot,
} from "./lootChests.js";
import { versionedEntitySnapshot } from "../snapshots/entitySnapshots.js";
import { setup } from "./lootChests.testSupport.js";

describe("player death loot chests", () => {
  it("moves every stack into a nearby labelled chest with lock and expiry", () => {
    const { sim, victim, chest } = setup();
    expect(victim.inventory).toEqual([]);
    expect(chest.slots).toEqual([
      { item: "rag", qty: 3 },
      { item: "torch", qty: 2 },
    ]);
    expect(chest.entity.name).toBe("[DEAD] Crawler 123's loot");
    expect(chest.killerName).toBe("Crawler 456");
    expect(chest.unlockAtTick).toBe(sim.tickCount + LOOT_CHEST_LOCK_TICKS);
    expect(LOOT_CHEST_LIFETIME_TICKS).toBe(5 * 60 * TICK_RATE);
    expect(chest.expiresAtTick).toBe(sim.tickCount + LOOT_CHEST_LIFETIME_TICKS);
    expect(versionedEntitySnapshot(sim, chest.entity).snapshot).toMatchObject({
      lootOwnerName: "Crawler 123",
      lootKillerId: "killer",
      lootKillerName: "Crawler 456",
      lootUnlockAtTick: LOOT_CHEST_LOCK_TICKS,
      expiresAtTick: LOOT_CHEST_LIFETIME_TICKS,
    });
    expect(Math.hypot(
      chest.entity.body.x - victim.entity.body.x,
      chest.entity.body.y - victim.entity.body.y,
    )).toBeGreaterThanOrEqual(1);
  });

  it("reserves access for the killer, then unlocks for everyone", () => {
    const { sim, killer, stranger, chest } = setup();
    expect(openLootChest(sim, stranger)).toBe(true);
    expect(stranger.outbox.at(-1)).toMatchObject({ t: "toast" });
    expect(openLootChest(sim, killer)).toBe(true);
    expect(killer.outbox.at(-1)).toMatchObject({
      t: "lootChest",
      chestId: chest.entity.id,
    });
    sim.tickCount = chest.unlockAtTick;
    expect(openLootChest(sim, stranger)).toBe(true);
    expect(stranger.outbox.at(-1)).toMatchObject({
      t: "toast",
      msg: "Someone else is viewing this chest",
    });
    closeLootChest(sim, killer, chest.entity.id);
    expect(openLootChest(sim, stranger)).toBe(true);
    expect(stranger.outbox.at(-1)).toMatchObject({ t: "lootChest" });
  });

  it("opens the requested in-range chest on the first request", () => {
    const { sim, killer, chest } = setup();

    expect(openLootChestById(sim, killer, chest.entity.id)).toBe(true);
    expect(killer.outbox).toHaveLength(1);
    expect(killer.outbox[0]).toMatchObject({
      t: "lootChest",
      chestId: chest.entity.id,
    });
    expect(chest.viewerId).toBe(killer.entity.id);
    openLootChestById(sim, killer, chest.entity.id);
    expect(killer.outbox.at(-1)).toMatchObject({ t: "lootChest", chestId: chest.entity.id });
    killer.entity.body.x += 10;
    openLootChestById(sim, killer, chest.entity.id);
    expect(killer.outbox.at(-1)).toMatchObject({ t: "toast", msg: "Too far from loot chest" });
    openLootChestById(sim, killer, "missing");
    expect(killer.outbox.at(-1)).toMatchObject({ t: "toast", msg: "Loot chest is no longer available" });
  });

  it("takes one stack or all stacks and removes an emptied chest", () => {
    const { sim, killer, chest } = setup();
    killer.inventory = [];
    openLootChest(sim, killer);
    takeLoot(sim, killer, { chestId: chest.entity.id, op: "take", item: "rag" });
    expect(killer.inventory).toEqual([{ item: "rag", qty: 3 }]);
    expect(chest.slots).toEqual([{ item: "torch", qty: 2 }]);
    takeLoot(sim, killer, { chestId: chest.entity.id, op: "takeAll" });
    expect(killer.inventory).toEqual([
      { item: "rag", qty: 3 },
      { item: "torch", qty: 2 },
    ]);
    expect(sim.lootChests.has(chest.entity.id)).toBe(false);
  });

});
