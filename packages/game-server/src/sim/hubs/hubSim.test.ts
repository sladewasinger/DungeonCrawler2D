/** Authoritative integration tests for Phase 9 Fog sync, Sanctuary hubs, Stash isolation, Economy & Blacksmith [REQ-P9-03..11]. */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFogState, applyFogChunkDeltas, isInWorldSanctuary } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WorldSim } from "../worldSim.js";

const SWORD_ID = "sword";

function placeNearProp(sim: WorldSim, playerId: string, propKind: string): void {
  const p = sim.getPlayer(playerId);
  if (!p) throw new Error("missing player");
  const prop = [
    ...sim.cache.getChunk(0, 0).props,
    ...sim.cache.getChunk(-1, 0).props,
    ...sim.cache.getChunk(0, -1).props,
    ...sim.cache.getChunk(-1, -1).props,
  ].find((pr) => pr.kind === propKind);
  if (!prop) throw new Error(`missing prop ${propKind}`);
  p.x = prop.x;
  p.y = prop.y + 0.8;
}

describe("Phase 9 authoritative hubs, economy, stash & fog persistence", () => {
  it("[REQ-P9-03][REQ-P9-06][REQ-P9-07] replicates incremental fog deltas, isolates 2-player stash, and persists across restart", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc2d-p9-sim-"));
    try {
      const savePath = join(dir, "world.json");
      const sim = new WorldSim(1337, { persistencePath: savePath });
      const credA = sim.authenticateSession();
      const idA = sim.addPlayer("Alice", undefined, { accountId: credA.accountId, tokenHash: credA.tokenHash });
      const credB = sim.authenticateSession();
      const idB = sim.addPlayer("Bob", undefined, { accountId: credB.accountId, tokenHash: credB.tokenHash });
      expect(sim.getPlayer(idB)?.gold).toBe(0);

      const fogClientA = createFogState(sim.fullFogDeltas(idA));
      sim.queueInput(idA, { seq: 1, moveX: 1, moveY: 0 });
      for (let i = 0; i < 40; i++) sim.step();
      applyFogChunkDeltas(fogClientA, sim.drainFogDeltas(idA));

      sim.grantPlayerItems(idA, [{ slot: 5, itemId: SWORD_ID, count: 1 }]);
      sim.handleAdminAction(idA, { action: "giveGold", count: 150 });
      placeNearProp(sim, idA, "stash-chest");
      expect(sim.handleHubMessage(idA, { t: "stashTransfer", from: "inv", fromSlot: 5, to: "stash", toSlot: 2 })).toBe(true);
      expect(sim.hubs.stash.snapshot(credA.accountId)[2]?.itemId).toBe(SWORD_ID);
      expect(sim.hubs.stash.snapshot(credB.accountId)[2]).toBeNull();

      sim.savePersistenceNow();
      sim.closePersistence();

      const reloaded = new WorldSim(1337, { persistencePath: savePath });
      const authBack = reloaded.authenticateSession({ accountId: credA.accountId, resumeToken: credA.issuedCredentials?.resumeToken });
      const backA = reloaded.addPlayer("Alice", undefined, { accountId: authBack.accountId, tokenHash: authBack.tokenHash });
      expect(reloaded.getPlayer(backA)?.gold).toBe(150);
      expect(reloaded.hubs.stash.snapshot(authBack.accountId)[2]?.itemId).toBe(SWORD_ID);
      expect(reloaded.fullFogDeltas(backA).length).toBeGreaterThanOrEqual(4);
      reloaded.closePersistence();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[REQ-P9-08][REQ-P9-09][REQ-P9-10][REQ-P9-11] runs atomic Merchant buy/sell and Blacksmith reforge/upgrade", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Smith");
    const p = sim.getPlayer(id)!;

    placeNearProp(sim, id, "npc-merchant");
    expect(sim.handleHubMessage(id, { t: "merchantBuy", offerId: "offer-arrows", count: 1 })).toBe(false);
    sim.handleAdminAction(id, { action: "giveGold", count: 500 });
    expect(sim.handleHubMessage(id, { t: "merchantBuy", offerId: "offer-arrows", count: 1 })).toBe(true);
    expect(p.gold).toBe(476);

    sim.grantPlayerItems(id, [
      { slot: 12, itemId: SWORD_ID, count: 1 },
      { slot: 13, itemId: "copper-ingot", count: 4 },
      { slot: 14, itemId: "iron-ingot", count: 4 },
      { slot: 15, itemId: "sunstone", count: 4 },
    ]);
    placeNearProp(sim, id, "npc-blacksmith");
    expect(sim.handleHubMessage(id, { t: "blacksmithReforge", slotIndex: 12 })).toBe(true);
    expect(p.inventory.slots[12]?.prefixId).toBeDefined();
    for (let k = 0; k < 3; k++) {
      expect(sim.handleHubMessage(id, { t: "blacksmithUpgrade", slotIndex: 12 })).toBe(true);
    }
    expect(p.inventory.slots[12]?.upgradeLevel).toBe(3);
    expect(sim.handleHubMessage(id, { t: "blacksmithUpgrade", slotIndex: 12 })).toBe(false);

    placeNearProp(sim, id, "npc-merchant");
    const goldBeforeSell = p.gold;
    expect(sim.handleHubMessage(id, { t: "merchantSell", slotIndex: 12 })).toBe(true);
    expect(p.gold).toBeGreaterThan(goldBeforeSell);
    expect(p.inventory.slots[12]).toBeNull();
  });

  it("[REQ-P9-04][REQ-P9-05] awards Gold on enemy kill & keeps Sanctuary Hubs safe", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Hunter");
    const p = sim.getPlayer(id)!;
    expect(isInWorldSanctuary(sim.cache, p.x, p.y)).toBe(true);

    const wolf = sim.combat.ecology.spawnEntity({ kind: "wolf", x: 22, y: 0.5, homeRadius: 8, poiId: null, packId: null, packSlot: 0 });
    sim.combat.ecology.damageEntity({ entity: wolf, damage: 999, dirX: 1, dirY: 0, goreStyle: "splatter", actorId: id, events: [] });
    expect(p.gold).toBeGreaterThan(0);
  });
});
