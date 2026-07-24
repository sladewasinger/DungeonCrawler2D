/** Verifies inventory stacks, starter migration, drops, crafting, and stash behavior. */
import {
  areasData, enemiesData, itemsData,
  recipesData, rulesData, statusesData,
} from "@dc2d/content";
import {
  TILE, buildContentRegistry, createBody, makeEntity,
  newEntityId, resetEntityIds, type World,
} from "@dc2d/engine";
import { beforeEach, describe, expect, it } from "vitest";
import {
  doCraft,
  doDrop,
  doPickup,
  doStash,
  dropAllInventory,
  ensureStarterKit,
  invAdd,
  invIndex,
  invQty,
  invRemove,
} from "./inventory.js";
import { createSimState, type PlayerSlot, type SimState } from "./state.js";
import { PlayerStore } from "../store.js";

/**
 * Headless tests for the inventory sim module, exercised directly
 * against SimState (no GameSim facade — that's the integration layer).
 */

const registry = buildContentRegistry({
  statuses: [...statusesData],
  rules: [...rulesData],
  areas: [...areasData],
  items: [...itemsData],
  enemies: [...enemiesData],
  recipes: [...recipesData],
});

/**
 * Minimal stand-in for World: inventory.ts only ever reaches `groundAt`
 * (item spawning) and `tileAt` (crafting-table/stash proximity) via
 * helpers.ts, so a fake covering those two is behaviorally complete.
 * Cast to World (a nominally-typed class) since SimState demands it.
 */
function fakeWorld(special: { x: number; y: number; tile: number } | null = null): World {
  const fake = {
    groundAt: () => 0,
    tileAt: (x: number, y: number) =>
      special && x === special.x && y === special.y ? special.tile : TILE.Floor,
  };
  return fake as unknown as World;
}

function buildSim(world: World): SimState {
  return createSimState(world, registry, new PlayerStore(null), 1, {});
}

function buildSlot(x: number, y: number, z = 0): PlayerSlot {
  const entity = makeEntity("player", createBody(x, y, z), { id: newEntityId("p"), hp: 100, maxHp: 100 });
  return {
    entity, clientId: "client-a", stored: { slot: 0, name: "A", stash: [], contacts: [] }, resumeToken: "t",
    lastSeq: 0, pendingInputs: [], pendingActions: [], connected: true, reapAtTick: 0,
    known: new Set(), inventory: [], hotbar: Array(9).fill(null), weapon: null, outbox: [],
    returnStack: [], partyId: null, respawnAtTick: null, needsFullAreas: false,
    downedAtTick: null, attackReadyAtTick: 0, attackStartedAtTick: 0, god: false, forceDeath: false, chatTimestamps: [], lastFistbumpOfferAtTick: -Infinity, spawnGraceUntilTick: 0, pendingTransfer: null,
  };
}

beforeEach(() => {
  resetEntityIds();
});

describe("inventory: adding and removing stacks", () => {
  it("stacks repeated adds under one entry and prunes on empty removal", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(0, 0);
    invAdd(sim, slot, "rag", 2);
    invAdd(sim, slot, "rag", 3);
    expect(invQty(slot, "rag")).toBe(5);
    expect(slot.inventory).toEqual([{ item: "rag", qty: 5 }]);

    expect(invRemove(slot, "rag", 10)).toBe(false); // short stack, no partial removal
    expect(invRemove(slot, "rag", 5)).toBe(true);
    expect(invIndex(slot, "rag")).toBe(-1); // pruned at zero
  });

  it("auto-equips the first weapon picked up, never a second", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(0, 0);
    invAdd(sim, slot, "sword", 1);
    expect(slot.weapon).toBe("sword");
    invAdd(sim, slot, "hammer", 1);
    expect(slot.weapon).toBe("sword"); // first weapon wins, hammer sits unequipped
  });

  it("migrates an existing starter kit to bandages in slot one once", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(0, 0);
    invAdd(sim, slot, "sword", 1);
    invAdd(sim, slot, "torch", 3);
    ensureStarterKit(sim, slot);
    expect(invQty(slot, "bandage")).toBe(2);
    expect(slot.hotbar[0]).toBe("bandage");
    invRemove(slot, "bandage", 2);
    ensureStarterKit(sim, slot);
    expect(invQty(slot, "bandage")).toBe(0);
  });
});

describe("inventory: pickup and drop", () => {
  it("picks up the nearest same-level item within range and stacks it", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(5, 5);
    const item = makeEntity("item", createBody(5.5, 5, 0), {
      id: newEntityId("i"),
      defId: "rag",
      qty: 2,
    });
    sim.items.set(item.id, item);
    doPickup(sim, slot);
    expect(invQty(slot, "rag")).toBe(2);
    expect(sim.items.has(item.id)).toBe(false);
  });

  it("ignores items on a different level even when horizontally close", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(5, 5, 0);
    const item = makeEntity("item", createBody(5.2, 5, 3), {
      id: newEntityId("i"),
      defId: "rag",
      qty: 1,
    });
    sim.items.set(item.id, item);
    doPickup(sim, slot);
    expect(invQty(slot, "rag")).toBe(0);
    expect(sim.items.has(item.id)).toBe(true);
  });

  it("drops one item from a stack", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(1, 1);
    invAdd(sim, slot, "rag", 3);
    doDrop(sim, slot, "rag");
    expect(invQty(slot, "rag")).toBe(2);
    const dropped = [...sim.items.values()].find((e) => e.defId === "rag");
    expect(dropped?.qty).toBe(1);
  });

  it("clears equip when the final weapon copy is dropped", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(1, 1);
    invAdd(sim, slot, "sword", 1);
    expect(slot.weapon).toBe("sword");
    doDrop(sim, slot, "sword");
    expect(invQty(slot, "sword")).toBe(0);
    expect(slot.weapon).toBeNull();
    const dropped = [...sim.items.values()].find((e) => e.defId === "sword");
    expect(dropped?.qty).toBe(1);
  });

  it("dropAllInventory empties the inventory and unequips", () => {
    const sim = buildSim(fakeWorld());
    const slot = buildSlot(2, 2);
    invAdd(sim, slot, "rag", 3);
    invAdd(sim, slot, "sword", 1);
    dropAllInventory(sim, slot);
    expect(slot.inventory).toEqual([]);
    expect(slot.weapon).toBeNull();
    expect(sim.items.size).toBe(2);
  });
});

describe("inventory: crafting", () => {
  it("requires an adjacent crafting table and consumes inputs on success", () => {
    const sim = buildSim(fakeWorld({ x: 4, y: 4, tile: TILE.CraftingTable }));
    const slot = buildSlot(10, 10); // far from the table
    invAdd(sim, slot, "rag", 2);
    doCraft(sim, slot, "bandage");
    expect(invQty(slot, "bandage")).toBe(0); // no table nearby, nothing happens
    expect(slot.outbox.at(-1)).toEqual({ t: "toast", msg: "You need a crafting table" });

    slot.entity.body.x = 4;
    slot.entity.body.y = 5; // adjacent to the table tile
    doCraft(sim, slot, "bandage");
    expect(invQty(slot, "rag")).toBe(0);
    expect(invQty(slot, "bandage")).toBe(1);
  });

  it("refuses to craft when an input is missing", () => {
    const sim = buildSim(fakeWorld({ x: 0, y: 0, tile: TILE.CraftingTable }));
    const slot = buildSlot(0, 1);
    doCraft(sim, slot, "bandage");
    expect(invQty(slot, "bandage")).toBe(0);
    expect(slot.outbox.at(-1)).toEqual({ t: "toast", msg: "Missing rag" });
  });
});

describe("inventory: stash", () => {
  it("puts a stack into the stash and takes it back out", () => {
    const sim = buildSim(fakeWorld({ x: 0, y: 0, tile: TILE.Stash }));
    const slot = buildSlot(0, 1); // adjacent to the stash tile
    invAdd(sim, slot, "rag", 4);

    doStash(sim, slot, "put", invIndex(slot, "rag"));
    expect(invQty(slot, "rag")).toBe(0);
    expect(slot.stored.stash).toEqual([{ item: "rag", qty: 4 }]);
    expect(slot.outbox.at(-1)).toEqual({ t: "stash", slots: [{ item: "rag", qty: 4 }] });

    doStash(sim, slot, "take", 0);
    expect(invQty(slot, "rag")).toBe(4);
    expect(slot.stored.stash).toEqual([]);
  });

  it("clears the weapon slot when the equipped weapon is stashed", () => {
    const sim = buildSim(fakeWorld({ x: 0, y: 0, tile: TILE.Stash }));
    const slot = buildSlot(0, 1);
    invAdd(sim, slot, "sword", 1);
    doStash(sim, slot, "put", invIndex(slot, "sword"));
    expect(slot.weapon).toBeNull();
  });

  it("does nothing when not adjacent to a stash tile", () => {
    const sim = buildSim(fakeWorld(null));
    const slot = buildSlot(0, 1);
    invAdd(sim, slot, "rag", 1);
    doStash(sim, slot, "put", invIndex(slot, "rag"));
    expect(invQty(slot, "rag")).toBe(1);
    expect(slot.outbox).toEqual([]);
  });
});
