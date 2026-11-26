/** Integration tests for frontier discovery, Waystone beacons, shrine buffs, and brazier vaults. */
import { TOTAL_INVENTORY_SLOTS, WorldChunkCache, findChunkPoi, type ChunkPoi } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { createStarterInventory } from "../playerInventory.js";
import { LootManager } from "../wildlife/lootManager.js";
import { WorldSim } from "../worldSim.js";
import { executeAdminSlashCommand } from "./adminSlashCommands.js";
import { DiscoveryTracker } from "./discoveryTracker.js";
import { PoiInteractionManager } from "./poiInteractions.js";

function findPoiInRow(q: { readonly worldSeed: number; readonly cy: number; readonly r: number; readonly kind: string }): ChunkPoi | null {
  for (let cx = -q.r; cx <= q.r; cx++) {
    const poi = findChunkPoi(q.worldSeed, cx, q.cy);
    if (poi?.kind === q.kind) return poi;
  }
  return null;
}

function findFirstPoiOfKind(worldSeed: number, kind: string): ChunkPoi | null {
  for (let cy = -18; cy <= 18; cy++) {
    const hit = findPoiInRow({ worldSeed, cy, r: 18, kind });
    if (hit) return hit;
  }
  return null;
}

function makeTestPlayer(x: number, y: number): CombatPlayerRef {
  return {
    id: "p1", x, y, elevation: 0, facingX: 1, facingY: 0, aimX: 1, aimY: 0,
    selectedHotbar: 0, crouching: false, inventory: createStarterInventory(), combat: createCombatState(),
  };
}

function firstNonEmptyChestSlot(sim: WorldSim, chestId: string): { readonly idx: number; readonly itemId: string | undefined } {
  const chest = sim.combatSnapshots().chests.find((c) => c.id === chestId);
  const idx = chest?.slots.findIndex((s) => s !== null) ?? -1;
  return { idx, itemId: idx >= 0 ? chest?.slots[idx]?.itemId : undefined };
}

describe("frontier discovery, shrines, waystones & brazier vaults", () => {
  it("tracks nearby POI discoveries and removes corresponding waystone beacons", () => {
    const cache = new WorldChunkCache(1337);
    const tracker = new DiscoveryTracker();
    const events: never[] = [];
    const waystone = findFirstPoiOfKind(1337, "ancient-waystone");
    expect(waystone).not.toBeNull();
    if (!waystone) return;
    const revealed = tracker.attuneWaystone({ playerId: "p1", waystone, cache, events });
    expect(revealed).toBeGreaterThanOrEqual(1);
    const firstBeacon = tracker.snapshotFor("p1").revealedBeacons[0]!;
    const hit = tracker.trackNearbyPois({ playerId: "p1", x: firstBeacon.x, y: firstBeacon.y, cache, events });
    expect(hit).toBe(true);
    expect(tracker.snapshotFor("p1").discoveredPoiIds).toContain(firstBeacon.id);
    expect(tracker.snapshotFor("p1").revealedBeacons.some((b) => b.id === firstBeacon.id)).toBe(false);
  });

  it("keeps brazier vault chest sealed until all braziers are ignited with a Torch", () => {
    const vault = findFirstPoiOfKind(1337, "brazier-vault");
    expect(vault).not.toBeNull();
    if (!vault || !vault.brazierPositions?.length) return;
    const cache = new WorldChunkCache(1337);
    const loot = new LootManager(cache);
    loot.registerPoiChest(vault);
    const tracker = new DiscoveryTracker();
    const interactions = new PoiInteractionManager();
    const player = makeTestPlayer(vault.chestX, vault.chestY);
    player.inventory.slots[0] = { itemId: "torch", count: 1 };
    const events: never[] = [];
    expect(loot.openChest(player, vault.id, events)).toBeNull();
    for (const b of vault.brazierPositions) {
      player.x = b.x; player.y = b.y;
      const lit = interactions.interactWithPoi({ player, cache, loot, discovery: tracker, simTimeSec: 5, events });
      expect(lit).toBe(true);
    }
    player.x = vault.chestX; player.y = vault.chestY;
    expect(loot.openChest(player, vault.id, events)).toBe(vault.id);
  });

  it("prevents dropped items from auto-magneting back while looting a chest with full inventory", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Looter");
    const chestPoi = findFirstPoiOfKind(1337, "bandit-camp");
    expect(chestPoi).not.toBeNull();
    if (!chestPoi) return;
    sim.combat.ecology.loot.registerPoiChest(chestPoi);
    executeAdminSlashCommand(sim, id, `/tp ${chestPoi.chestX - 1} ${chestPoi.chestY}`);
    executeAdminSlashCommand(sim, id, "/fillbag flint-dagger");
    expect(sim.inventorySnapshot(id)?.slots.every((s) => s !== null)).toBe(true);

    sim.handleChestAction(id, { t: "openChest", chestId: chestPoi.id });
    sim.handleChestAction(id, { t: "chestTakeAll", chestId: chestPoi.id });
    sim.dropItem(id, { source: "inv", slotIndex: 9 });
    for (let i = 0; i < 80; i++) sim.step();

    // Dropped flint-dagger must stay on the ground instead of boomeranging back into slot 9!
    expect(sim.inventorySnapshot(id)?.slots[9]).toBeNull();
    expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "flint-dagger")).toBe(true);

    // Taking an item from the chest now succeeds cleanly
    const first = firstNonEmptyChestSlot(sim, chestPoi.id);
    expect(first.idx).toBeGreaterThanOrEqual(0);
    sim.handleChestAction(id, { t: "chestTransfer", chestId: chestPoi.id, from: "chest", fromSlot: first.idx, to: "inv", toSlot: 0, quick: true });
    expect(sim.inventorySnapshot(id)?.slots[9]?.itemId).toBe(first.itemId);
    expect(TOTAL_INVENTORY_SLOTS).toBe(36);
  });
});
