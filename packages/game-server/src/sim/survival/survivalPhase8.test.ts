import { PropKind, TOTAL_INVENTORY_SLOTS, canPlaceStructure, countItemInSlots, worldToChunkCoord, type StructureKind } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WorldSim } from "../worldSim.js";

function findClearSpot(sim: WorldSim, playerId: string, kind: StructureKind): { readonly x: number; readonly y: number } {
  const p = sim.snapshots().find((pl) => pl.id === playerId)!;
  for (const r of [1.5, 2.1, 2.7]) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round((p.x + Math.cos((a * Math.PI) / 8) * r) * 10) / 10;
      const y = Math.round((p.y + Math.sin((a * Math.PI) / 8) * r) * 10) / 10;
      if (canPlaceStructure({ cache: sim.cache, x, y, playerX: p.x, playerY: p.y, playerElev: p.elevation, kind })) return { x, y };
    }
  }
  throw new Error("No clear spot");
}

function walkAlongX(opts: {
  readonly sim: WorldSim; readonly id: string; readonly startSeq: number; readonly moveX: number; readonly targetX: number;
}): number {
  let seq = opts.startSeq;
  for (let i = 0; i < 95; i++) {
    const x = opts.sim.snapshots().find((p) => p.id === opts.id)?.x ?? 0;
    if (opts.moveX > 0 ? x >= opts.targetX : x <= opts.targetX) break;
    opts.sim.queueInput(opts.id, { seq: seq++, moveX: opts.moveX, moveY: 0 });
    opts.sim.step();
  }
  return seq;
}

describe("Phase 8 Pass 2 authoritative survival systems", () => {
  it("[REQ-P8-01][REQ-P8-02] syncs nearWorkbench within 2.8 tiles and enforces Workbench gating", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Crafter");
    sim.grantPlayerItems(id, [{ slot: 10, itemId: "wood", count: 14 }, { slot: 11, itemId: "stone", count: 2 }]);
    expect(sim.inventorySnapshot(id)?.nearWorkbench).toBe(false);
    expect(sim.craftRecipe(id, "craft-storage-chest")).toBe(false);
    expect(countItemInSlots(sim.inventorySnapshot(id)!.slots, "wood")).toBe(14);
    const seq = walkAlongX({ sim, id, startSeq: 1, moveX: 1, targetX: 16.5 });
    expect(sim.craftRecipe(id, "craft-workbench")).toBe(true);
    const spot = findClearSpot(sim, id, "workbench");
    expect(sim.placeStructure(id, { itemId: "workbench", x: spot.x, y: spot.y })).toBe(true);
    expect(sim.inventorySnapshot(id)?.nearWorkbench).toBe(true);
    expect(sim.craftRecipe(id, "craft-storage-chest")).toBe(true);
    walkAlongX({ sim, id, startSeq: seq, moveX: 1, targetX: spot.x + 5 });
    expect(sim.inventorySnapshot(id)?.nearWorkbench).toBe(false);
  });

  it("[REQ-P8-04][REQ-P8-05][REQ-P8-06] replicates hpRatio, gates ores, and forages stripped bushes", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Forager");
    const p = sim.getPlayer(id)!;
    const chunk = sim.cache.getChunk(0, 0);
    const tree = chunk.props.find((pr) => pr.kind === PropKind.OakTree);
    expect(tree).toBeDefined();
    if (tree) {
      p.x = tree.x - 1.1; p.y = tree.y;
      sim.queueInput(id, { seq: 1, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
      for (let i = 0; i < 8; i++) sim.step();
      const hitEv = sim.drainCombatEvents().find((e) => e.kind === "harvestHit");
      expect(hitEv?.hpRatio).toBeGreaterThan(0);
      expect(hitEv?.hpRatio).toBeLessThan(1);
    }
    const vein = { id: "test-iron:2,2", kind: PropKind.IronVein, x: 20.5, y: 2.5, variant: 0, elevation: 0, radius: 0.45, blocksMovement: true };
    const oreHit = sim.combat.harvester.hitHarvestableInSector({
      cache: { ...sim.cache, propsNear: () => [vein] } as unknown as typeof sim.cache,
      loot: sim.combat.ecology.loot, attacker: { id, x: 19.5, y: 2.5, aimX: 1, aimY: 0 },
      range: 2, halfArcRad: 1, toolKind: "none", toolPower: 10, timeSec: 1, events: sim.combat["events"],
    });
    expect(oreHit).toBe(true);
    expect(sim.drainCombatEvents().some((e) => e.reason === "Requires Pickaxe!")).toBe(true);

    const bushChunk = sim.cache.getChunk(0, 0);
    const bush = bushChunk.props.find((pr) => pr.kind === PropKind.Bush);
    expect(bush).toBeDefined();
    if (bush) {
      p.x = bush.x; p.y = bush.y + 0.9;
      sim.queueInput(id, { seq: 10, moveX: 0, moveY: 0, interact: true });
      sim.step();
      const after = sim.cache.getChunk(worldToChunkCoord(Math.floor(bush.x)), worldToChunkCoord(Math.floor(bush.y)));
      expect(after.props.find((pr) => pr.id === bush.id)?.depleted).toBe(true);
      expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "berry")).toBe(true);
    }
  });

  it("[REQ-P8-10][REQ-P8-11][REQ-P8-12] supports chest dismantle guards, refunds, and palisade defense", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Mason");
    walkAlongX({ sim, id, startSeq: 1, moveX: 1, targetX: 16.5 });
    const chestSpot = findClearSpot(sim, id, "wood-chest");
    sim.grantPlayerItems(id, [{ slot: 10, itemId: "storage-chest", count: 1 }, { slot: 11, itemId: "stone", count: 2 }]);
    expect(sim.placeStructure(id, { itemId: "storage-chest", x: chestSpot.x, y: chestSpot.y })).toBe(true);
    const chestId = sim.worldDeltaSnapshot().structures.find((s) => s.kind === "wood-chest")!.id;
    sim.handleChestAction(id, { t: "openChest", chestId });
    sim.handleChestAction(id, { t: "chestTransfer", chestId, from: "inv", fromSlot: 11, to: "chest", toSlot: 0 });
    expect(sim.dismantleStructure(id, chestId)).toBe(false);
    expect(sim.drainCombatEvents().some((e) => e.reason === "Empty chest before dismantling")).toBe(true);
    sim.handleChestAction(id, { t: "chestTransfer", chestId, from: "chest", fromSlot: 0, to: "inv", toSlot: 11 });
    for (let s = 0; s < TOTAL_INVENTORY_SLOTS; s++) sim.grantPlayerItems(id, [{ slot: s, itemId: "stone", count: 64 }]);
    expect(sim.dismantleStructure(id, chestId)).toBe(true);
    expect(sim.combatSnapshots().groundLoot.some((g) => g.itemId === "wood" && g.count === 6)).toBe(true);

    const wallSpot = findClearSpot(sim, id, "palisade");
    sim.grantPlayerItems(id, [{ slot: 0, itemId: "wood-palisade", count: 1 }]);
    expect(sim.placeStructure(id, { itemId: "wood-palisade", x: wallSpot.x, y: wallSpot.y, rotation: 1 })).toBe(true);
    const wall = sim.worldDeltaSnapshot().structures.find((s) => s.kind === "palisade")!;
    expect(wall.hp).toBe(80);
    expect(wall.rotation).toBe(1);
    sim.combat.structures.damagePalisadeNear({ x: wall.x, y: wall.y, elevation: 0, damage: 80, cache: sim.cache, events: sim.combat["events"] });
    expect(sim.worldDeltaSnapshot().structures.some((s) => s.id === wall.id)).toBe(false);
  });

  it("[REQ-P8-15] separates Well-Fed, Invigorated, and Herbal Salve HoT healing", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Alchemist");
    const p = sim.getPlayer(id)!;
    sim.grantPlayerItems(id, [
      { slot: 0, itemId: "cooked-meat", count: 1 },
      { slot: 1, itemId: "berry", count: 1 },
      { slot: 2, itemId: "herb-tea", count: 1 },
      { slot: 3, itemId: "healing-salve", count: 1 },
    ]);
    sim.useItem(id, 0);
    sim.step();
    const afterMeat = sim.snapshots().find((pl) => pl.id === id)!;
    expect(afterMeat.wellFedTimer).toBeGreaterThan(200);
    expect(afterMeat.maxHp).toBeGreaterThanOrEqual(115);

    p.combat.actionCooldown = 0;
    sim.useItem(id, 1);
    expect(sim.snapshots().find((pl) => pl.id === id)!.wellFedTimer).toBeGreaterThan(200);

    p.combat.actionCooldown = 0;
    sim.useItem(id, 2);
    expect(sim.snapshots().find((pl) => pl.id === id)!.invigoratedTimer).toBeGreaterThan(150);

    p.combat.hp = 40;
    p.combat.actionCooldown = 0;
    sim.useItem(id, 3);
    for (let i = 0; i < 80; i++) sim.step(0.05);
    expect(sim.snapshots().find((pl) => pl.id === id)!.hp).toBeGreaterThan(90);
  });
});
