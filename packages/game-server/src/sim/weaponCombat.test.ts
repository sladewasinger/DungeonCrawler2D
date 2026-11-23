import { describe, expect, it } from "vitest";
import { WorldSim } from "./worldSim.js";

function mustSlotIndex(sim: WorldSim, playerId: string, itemId: string): number {
  const idx = sim.inventorySnapshot(playerId)?.slots.findIndex((s) => s?.itemId === itemId) ?? -1;
  if (idx < 0) throw new Error(`Missing item ${itemId}`);
  return idx;
}

function advanceEastToDummy(sim: WorldSim, id: string): number {
  sim.queueInput(id, { seq: 1, moveX: 1, moveY: 0 });
  for (let i = 0; i < 30; i++) sim.step();
  return 2;
}

describe("Phase 7 weapon-specific movesets in WorldSim", () => {
  it("runs Sword 3-hit slash -> backhand -> finisher lunge with rising damage", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("SwordTester");
    let seq = advanceEastToDummy(sim, id);
    sim.selectHotbar(id, 0);
    for (let s = 0; s < 3; s++) {
      sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
      for (let i = 0; i < 6; i++) sim.step();
    }
    const events = sim.drainCombatEvents();
    expect(events.filter((e) => e.kind === "swing" && e.weaponArchetype === "sword").map((e) => e.comboStep)).toEqual([1, 2, 3]);
    const hits = events.filter((e) => e.kind === "hit" && e.targetId === "dummy-straw");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[hits.length - 1]?.value).toBeGreaterThan(hits[0]?.value ?? 0);
  });

  it("enforces 1-step heavy Axe/Pickaxe chops & slams and 2-step Torch sweeps", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("ToolTester");
    let seq = advanceEastToDummy(sim, id);

    expect(sim.craftRecipe(id, "craft-axe")).toBe(true);
    sim.selectHotbar(id, mustSlotIndex(sim, id, "axe"));
    for (let k = 0; k < 2; k++) {
      sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
      for (let i = 0; i < 9; i++) sim.step();
    }
    expect(sim.drainCombatEvents().filter((e) => e.kind === "swing" && e.weaponArchetype === "axe").map((e) => e.comboStep)).toEqual([1, 1]);

    expect(sim.craftRecipe(id, "craft-pickaxe")).toBe(true);
    sim.selectHotbar(id, mustSlotIndex(sim, id, "pickaxe"));
    sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
    sim.step();
    expect(sim.drainCombatEvents().some((e) => e.kind === "swing" && e.weaponArchetype === "pickaxe" && e.comboStep === 1)).toBe(true);

    for (let i = 0; i < 12; i++) sim.step();
    sim.selectHotbar(id, 3);
    for (let k = 0; k < 3; k++) {
      sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 0, aimX: 1, aimY: 0, attack: true });
      for (let i = 0; i < 6; i++) sim.step();
    }
    expect(sim.drainCombatEvents().filter((e) => e.kind === "swing" && e.weaponArchetype === "torch").map((e) => e.comboStep)).toEqual([1, 2, 1]);
  });
});
