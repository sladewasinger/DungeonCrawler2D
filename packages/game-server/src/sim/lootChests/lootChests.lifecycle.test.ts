import { describe, expect, it } from "vitest";
import { expireLootChests, openLootChest } from "./lootChests.js";
import { setup } from "./lootChests.testSupport.js";

describe("player death loot chest lifecycle", () => {
  it("releases the viewer when they leave, die, or disconnect", () => {
    const { sim, killer, stranger, chest } = setup();
    sim.tickCount = chest.unlockAtTick;
    openLootChest(sim, killer);
    killer.entity.body.x += 10;
    expireLootChests(sim);
    expect(chest.viewerId).toBeNull();
    openLootChest(sim, stranger);
    stranger.entity.hp = 0;
    expireLootChests(sim);
    expect(chest.viewerId).toBeNull();
    killer.entity.body.x = chest.entity.body.x;
    openLootChest(sim, killer);
    killer.connected = false;
    expireLootChests(sim);
    expect(chest.viewerId).toBeNull();
  });

  it("despawns untouched chests at their exact expiry tick", () => {
    const { sim, chest } = setup();
    sim.tickCount = chest.expiresAtTick;
    expireLootChests(sim);
    expect(sim.lootChests.size).toBe(0);
  });
});
