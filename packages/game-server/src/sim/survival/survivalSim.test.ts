import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PropKind, SURVIVAL_BUFF_TUNING, TOTAL_INVENTORY_SLOTS, canPlaceStructure, worldToChunkCoord, type StructureKind } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WorldSim } from "../worldSim.js";

function findSlot(sim: WorldSim, id: string, itemId: string): number {
  const idx = sim.inventorySnapshot(id)?.slots.findIndex((s) => s?.itemId === itemId) ?? -1;
  if (idx < 0) throw new Error(`Missing slot item: ${itemId}`);
  return idx;
}

function findClosestTree(sim: WorldSim, x: number, y: number) {
  let best = undefined;
  let bestDist = Infinity;
  for (const p of sim.cache.propsNear(x, y)) {
    if (p.kind !== PropKind.OakTree && p.kind !== PropKind.PineTree) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDist) { bestDist = d; best = p; }
  }
  return best;
}

function walkNearTree(sim: WorldSim, id: string, tree: { readonly x: number; readonly y: number }): number {
  let seq = 1;
  for (let k = 0; k < 80; k++) {
    const me = sim.snapshots().find((p) => p.id === id);
    if (!me) return seq;
    const dx = tree.x - me.x;
    const dy = tree.y - me.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1.45) return seq;
    sim.queueInput(id, { seq: seq++, moveX: dx / dist, moveY: dy / dist, aimX: dx, aimY: dy });
    sim.step();
  }
  return seq;
}

function approachAndChopTree(sim: WorldSim, id: string, tree: { readonly x: number; readonly y: number }): void {
  let seq = walkNearTree(sim, id, tree);
  const me = sim.snapshots().find((p) => p.id === id);
  if (!me) return;
  for (let swing = 0; swing < 3; swing++) {
    sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, aimX: tree.x - me.x, aimY: tree.y - me.y, attack: true });
    for (let i = 0; i < 9; i++) sim.step();
  }
}

function walkAlongX(opts: {
  readonly sim: WorldSim; readonly id: string; readonly startSeq: number; readonly moveX: number;
  readonly stopWhen: (x: number) => boolean; readonly maxSteps: number;
}): number {
  let seq = opts.startSeq;
  for (let i = 0; i < opts.maxSteps; i++) {
    const x = opts.sim.snapshots().find((p) => p.id === opts.id)?.x ?? 0;
    if (opts.stopWhen(x)) break;
    opts.sim.queueInput(opts.id, { seq: seq++, moveX: opts.moveX, moveY: 0 });
    opts.sim.step();
  }
  return seq;
}

function findClearSpotAround(sim: WorldSim, playerId: string, kind: StructureKind): { readonly x: number; readonly y: number } {
  const p = sim.snapshots().find((pl) => pl.id === playerId)!;
  for (const r of [1.4, 1.9, 2.5, 3.1]) {
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8;
      const x = Math.round((p.x + Math.cos(ang) * r) * 10) / 10;
      const y = Math.round((p.y + Math.sin(ang) * r) * 10) / 10;
      if (canPlaceStructure({ cache: sim.cache, x, y, playerX: p.x, playerY: p.y, playerElev: p.elevation, kind })) return { x, y };
    }
  }
  throw new Error(`No clear placement spot around (${p.x}, ${p.y})`);
}

function verifyRestedBuffNearCampfire(): void {
  const sim = new WorldSim(1337);
  const id = sim.addPlayer("Camper");
  sim.queueInput(id, { seq: 1, moveX: 1, moveY: -0.75 });
  for (let i = 0; i < 8; i++) sim.step();
  const chargeTicks = Math.ceil(SURVIVAL_BUFF_TUNING.restedChargeSec * 20) + 10;
  for (let i = 0; i < chargeTicks; i++) {
    sim.queueInput(id, { seq: i + 2, moveX: 0, moveY: 0 });
    sim.step();
  }
  expect(sim.snapshots().find((p) => p.id === id)?.restedTimer).toBeGreaterThan(100);
}

describe("Phase 8 gathering, camp building, survival buffs, and persistence", () => {
  it("chops trees with Axe into stumps and drops wood loot", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Gatherer");
    sim.grantPlayerItems(id, [
      { slot: 11, itemId: "wood", count: 8 },
      { slot: 12, itemId: "stone", count: 6 },
    ]);
    expect(sim.craftRecipe(id, "craft-axe")).toBe(true);
    sim.selectHotbar(id, findSlot(sim, id, "axe"));
    const tree = findClosestTree(sim, 0.5, 0.5);
    expect(tree).toBeDefined();
    if (!tree) return;
    approachAndChopTree(sim, id, tree);
    const events = sim.drainCombatEvents();
    expect(events.some((e) => e.kind === "harvestHit")).toBe(true);
    expect(events.some((e) => e.kind === "harvestBreak")).toBe(true);
    const cx = worldToChunkCoord(Math.floor(tree.x));
    const cy = worldToChunkCoord(Math.floor(tree.y));
    expect(sim.cache.getChunk(cx, cy).props.find((p) => p.id === tree.id)?.kind).toBe(PropKind.Stump);
  });

  it("places camp bed for custom respawn, activates Well-Fed/Rested buffs, and persists across reboots", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc2d-save-"));
    const savePath = join(dir, "world.json");
    try {
      const sim = new WorldSim(1337, { persistencePath: savePath });
      const id = sim.addPlayer("Builder");
      sim.grantPlayerItems(id, [
        { slot: 11, itemId: "wood", count: 8 },
        { slot: 14, itemId: "raw-meat", count: 3 },
        { slot: 15, itemId: "herb", count: 4 },
      ]);
      expect(sim.craftRecipe(id, "craft-camp-bed")).toBe(true);
      expect(sim.placeStructure(id, { itemId: "camp-bed", x: 1.5, y: 1.2 })).toBe(false);
      let seq = walkAlongX({ sim, id, startSeq: 1, moveX: 1, maxSteps: 90, stopWhen: (x) => x >= 16.5 });
      const spot = findClearSpotAround(sim, id, "bed");
      expect(sim.placeStructure(id, { itemId: "camp-bed", x: spot.x, y: spot.y })).toBe(true);
      sim.queueInput(id, { seq: seq++, moveX: -1, moveY: 0 });
      sim.step();
      sim.respawnPlayer(id);
      const respawned = sim.snapshots().find((p) => p.id === id);
      expect(respawned?.x).toBeCloseTo(spot.x, 2);

      seq = walkAlongX({ sim, id, startSeq: seq, moveX: -1, maxSteps: 95, stopWhen: (x) => x <= 1.2 });
      sim.queueInput(id, { seq: seq++, moveX: 0, moveY: -0.5, aimX: 0, aimY: -1 });
      for (let i = 0; i < 6; i++) sim.step();
      expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(true);
      sim.selectHotbar(id, findSlot(sim, id, "cooked-meat"));
      sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, attack: true });
      sim.step();
      expect(sim.snapshots().find((p) => p.id === id)?.wellFedTimer).toBeGreaterThan(100);
      verifyRestedBuffNearCampfire();

      sim.savePersistenceNow();
      const rebooted = new WorldSim(1337, { persistencePath: savePath });
      expect(rebooted.worldDeltaSnapshot().structures.some((s) => s.kind === "bed")).toBe(true);
      const idReboot = rebooted.addPlayer("Builder");
      expect(rebooted.snapshots().find((p) => p.id === idReboot)?.hasBedRespawn).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("stops loot magnetism when inventory is full and supports dropping inventory and armor items", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Packrat");
    const fullEntries = Array.from({ length: TOTAL_INVENTORY_SLOTS }, (_, slot) => ({ slot, itemId: "stone", count: 64 }));
    sim.grantPlayerItems(id, fullEntries);

    const me = sim.snapshots().find((p) => p.id === id)!;
    sim.combat.ecology.loot.spawnLoot({ itemId: "wood", count: 3, x: me.x + 1.5, y: me.y, vx: 0, vy: 0 });
    for (let i = 0; i < 15; i++) sim.step();
    const idleLoot = sim.combatSnapshots().groundLoot[0];
    expect(idleLoot).toBeDefined();
    expect(idleLoot?.x).toBeCloseTo(me.x + 1.5, 4);

    sim.dropItem(id, { source: "inv", slotIndex: 35 });
    expect(sim.inventorySnapshot(id)?.slots[35]).toBeNull();
    expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "stone" && g.count === 64)).toBe(true);

    sim.dropItem(id, { source: "armor", armorSlot: "chest" });
    expect(sim.inventorySnapshot(id)?.armor.chest).toBeNull();
    expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "leather-tunic")).toBe(true);

    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.inventorySnapshot(id)?.slots[35]).toEqual({ itemId: "wood", count: 3 });
    expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "stone" && g.count === 64)).toBe(true);
  });

  it("blocks dropFromChest on sealed chests, enforces bed ward & structure cap, and persists worldClockSec & dayPaused", () => {
    const dir = mkdtempSync(join(tmpdir(), "dc2d-stage1-"));
    const savePath = join(dir, "world.json");
    try {
      const sim = new WorldSim(1337, { persistencePath: savePath });
      const ownerId = sim.addPlayer("Mason", undefined, { accountId: "acc_mason" });
      const guestId = sim.addPlayer("Guest", undefined, { accountId: "acc_guest" });
      const owner = sim.getPlayer(ownerId)!;
      const sealedChest = {
        id: "sealed-vault-1", poiKind: "brazier-vault" as const, x: 1.5, y: 0.5, elevation: 0,
        opened: false, sealed: true, slots: [{ itemId: "ancient-core", count: 1 }],
      };
      (sim.combat.ecology.loot as unknown as { chests: Map<string, unknown> }).chests.set(sealedChest.id, sealedChest);
      const dropOk = sim.combat.ecology.loot.dropFromChest(owner, { chestId: sealedChest.id, slotIndex: 0, count: 1 });
      expect(dropOk).toBe(false);
      expect(sealedChest.slots[0]?.itemId).toBe("ancient-core");

      walkAlongX({ sim, id: ownerId, startSeq: 1, moveX: 1, maxSteps: 90, stopWhen: (x) => x >= 16.5 });
      walkAlongX({ sim, id: guestId, startSeq: 1, moveX: 1, maxSteps: 90, stopWhen: (x) => x >= 16.5 });
      const spot = findClearSpotAround(sim, ownerId, "bed");
      const ITEM_TORCH = "standing-torch";
      for (let i = 0; i < 63; i++) {
        sim.grantPlayerItems(ownerId, [{ slot: 13, itemId: ITEM_TORCH, count: 1 }]);
        expect(sim.placeStructure(ownerId, { itemId: ITEM_TORCH, x: spot.x, y: spot.y })).toBe(true);
      }
      sim.grantPlayerItems(ownerId, [{ slot: 14, itemId: "camp-bed", count: 1 }]);
      expect(sim.placeStructure(ownerId, { itemId: "camp-bed", x: spot.x, y: spot.y })).toBe(true);
      sim.grantPlayerItems(ownerId, [{ slot: 13, itemId: ITEM_TORCH, count: 1 }]);
      expect(sim.placeStructure(ownerId, { itemId: ITEM_TORCH, x: spot.x, y: spot.y })).toBe(false);

      sim.grantPlayerItems(guestId, [{ slot: 13, itemId: "wood-palisade", count: 1 }]);
      expect(sim.placeStructure(guestId, { itemId: "wood-palisade", x: spot.x, y: spot.y })).toBe(false);

      sim.setDayPhase(0.75, true);
      for (let i = 0; i < 10; i++) sim.step(0.05);
      const clockBeforeSave = sim.worldClockSec;
      expect(clockBeforeSave).toBeGreaterThan(0.4);
      sim.savePersistenceNow();

      const reloaded = new WorldSim(1337, { persistencePath: savePath });
      expect(reloaded.worldClockSec).toBeCloseTo(clockBeforeSave, 3);
      expect(reloaded.dayPaused).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
