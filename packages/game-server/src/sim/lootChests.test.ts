import {
  areasData,
  enemiesData,
  itemsData,
  recipesData,
  rulesData,
  statusesData,
} from "@dc2d/content";
import {
  LOOT_CHEST_LIFETIME_TICKS,
  LOOT_CHEST_LOCK_TICKS,
  TICK_RATE,
  TILE,
  buildContentRegistry,
  createBody,
  makeEntity,
  type World,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PlayerStore } from "../store.js";
import {
  closeLootChest,
  expireLootChests,
  openLootChest,
  openLootChestById,
  spawnPlayerLootChest,
  takeLoot,
} from "./lootChests.js";
import { versionedEntitySnapshot } from "./entitySnapshots.js";
import { createSimState, type PlayerSlot } from "./state.js";

const content = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

const world = {
  isWalkable: () => true,
  groundAt: () => 0,
  tileAt: () => TILE.Floor,
} as unknown as World;

function slot(id: string, name: string, x = 0, y = 0): PlayerSlot {
  return {
    entity: makeEntity("player", createBody(x, y, 0), {
      id,
      name,
      hp: 20,
      maxHp: 20,
    }),
    clientId: `client-${id}`,
    stored: { slot: 0, name, stash: [], contacts: [] },
    resumeToken: `token-${id}`,
    lastSeq: 0,
    pendingInputs: [],
    pendingActions: [],
    connected: true,
    reapAtTick: Infinity,
    known: new Set(),
    inventory: [{ item: "rag", qty: 3 }, { item: "torch", qty: 2 }],
    hotbar: [],
    weapon: null,
    outbox: [],
    returnStack: [],
    partyId: null,
    respawnAtTick: null,
    needsFullAreas: false,
    downedAtTick: null,
    attackReadyAtTick: 0,
    attackStartedAtTick: -Infinity,
    god: false,
    forceDeath: false,
    chatTimestamps: [],
    lastFistbumpOfferAtTick: -Infinity,
    spawnGraceUntilTick: 0,
    pendingTransfer: null,
  };
}

function setup() {
  const sim = createSimState(world, content, new PlayerStore(null), 1, {});
  const victim = slot("victim", "Crawler 123");
  const killer = slot("killer", "Crawler 456");
  const stranger = slot("stranger", "Crawler 789");
  victim.lastDamagedByPlayerId = killer.entity.id;
  sim.players.set(victim.entity.id, victim);
  sim.players.set(killer.entity.id, killer);
  sim.players.set(stranger.entity.id, stranger);
  const chest = spawnPlayerLootChest(sim, victim);
  if (!chest) throw new Error("expected death loot chest");
  for (const player of [killer, stranger]) {
    player.entity.body.x = chest.entity.body.x;
    player.entity.body.y = chest.entity.body.y;
  }
  return { sim, victim, killer, stranger, chest };
}

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
    takeLoot(sim, killer, chest.entity.id, "take", "rag");
    expect(killer.inventory).toEqual([{ item: "rag", qty: 3 }]);
    expect(chest.slots).toEqual([{ item: "torch", qty: 2 }]);
    takeLoot(sim, killer, chest.entity.id, "takeAll");
    expect(killer.inventory).toEqual([
      { item: "rag", qty: 3 },
      { item: "torch", qty: 2 },
    ]);
    expect(sim.lootChests.has(chest.entity.id)).toBe(false);
  });

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
