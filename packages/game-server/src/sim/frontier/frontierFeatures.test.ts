/** Integration tests for frontier discovery, Waystone beacons, shrine buffs, and brazier vaults. */
import { WorldChunkCache, findChunkPoi, type ChunkPoi } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { createCombatState, type CombatPlayerRef } from "../combatActions.js";
import { createStarterInventory } from "../playerInventory.js";
import { LootManager } from "../wildlife/lootManager.js";
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
});
