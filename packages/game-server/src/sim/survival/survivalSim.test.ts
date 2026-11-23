import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PropKind, SURVIVAL_BUFF_TUNING, worldToChunkCoord } from "@dc2d/engine";
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
      expect(sim.placeStructure(id, { itemId: "camp-bed", x: 1.5, y: 1.2 })).toBe(true);
      sim.queueInput(id, { seq: 1, moveX: 0.2, moveY: 0.2 });
      sim.step();
      sim.respawnPlayer(id);
      const respawned = sim.snapshots().find((p) => p.id === id);
      expect(respawned?.x).toBeCloseTo(1.5, 2);

      sim.queueInput(id, { seq: 2, moveX: 0.4, moveY: -1, aimX: 0, aimY: -1 });
      for (let i = 0; i < 8; i++) sim.step();
      sim.queueInput(id, { seq: 3, moveX: 0, moveY: 0, aimX: 0, aimY: -1 });
      sim.step();
      expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(true);
      sim.selectHotbar(id, findSlot(sim, id, "cooked-meat"));
      sim.queueInput(id, { seq: 4, moveX: 0, moveY: 0, attack: true });
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
});
