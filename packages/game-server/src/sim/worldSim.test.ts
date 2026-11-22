import { getItemDef } from "@dc2d/content";
import { computeArmorDefense } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { WorldSim } from "./worldSim.js";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected value to be defined");
  return value;
}

describe("WorldSim", () => {
  it("moves players deterministically, toggles torches, and syncs Day/Night", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Scout");
    const before = must(sim.snapshots()[0]);
    expect(before.torchLit).toBe(true);

    sim.queueInput(id, { seq: 1, moveX: 0, moveY: 1 });
    for (let i = 0; i < 10; i++) sim.step();

    const moved = must(sim.snapshots()[0]);
    expect(moved.y).toBeGreaterThan(before.y);
    expect(moved.lastAckSeq).toBe(1);
    expect(moved.aimY).toBeCloseTo(1, 4);

    sim.queueInput(id, { seq: 2, moveX: 0, moveY: 0, aimX: 3, aimY: -4 });
    sim.step();
    const aimed = must(sim.snapshots()[0]);
    expect(aimed.moving).toBe(false);
    expect(aimed.aimX).toBeCloseTo(0.6, 3);
    expect(aimed.aimY).toBeCloseTo(-0.8, 3);
    expect(aimed.facingX).toBeCloseTo(0.6, 3);
    expect(aimed.facingY).toBeCloseTo(-0.8, 3);

    sim.toggleTorch(id);
    expect(must(sim.snapshots()[0]).torchLit).toBe(false);

    sim.setDayPhase(0.95, true);
    sim.step();
    expect(sim.dayPhase).toBeCloseTo(0.95, 4);
    expect(sim.dayPaused).toBe(true);
  });

  it("manages 36-slot inventory swaps and armor defense stats", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Scout");
    const initial = must(sim.inventorySnapshot(id));
    expect(initial.slots.length).toBe(36);
    expect(must(sim.snapshots()[0]).heldItem).toBe("sword");

    sim.selectHotbar(id, 1);
    sim.ackActionSeq(id, 4);
    expect(must(sim.snapshots()[0]).heldItem).toBe("bow");
    expect(sim.actionAckSeq(id)).toBe(4);
    expect(must(sim.inventorySnapshot(id)).ackSeq).toBe(4);
    sim.ackActionSeq(id, 2);
    expect(sim.actionAckSeq(id)).toBe(4);

    sim.moveSlot(id, { from: 11, to: 5 });
    const afterMove = must(sim.inventorySnapshot(id));
    expect(afterMove.slots[5]).toEqual({ itemId: "wood", count: 8 });
    expect(afterMove.slots[11]).toBeNull();

    sim.equipArmor(id, { slotIndex: 9, targetArmor: "head" });
    const afterArmor = must(sim.inventorySnapshot(id));
    expect(afterArmor.armor.head).toBe("leather-hood");
    expect(computeArmorDefense(afterArmor.armor, getItemDef)).toBe(2);
    expect(must(sim.snapshots()[0]).armor?.head).toBe("leather-hood");

    const customLook = { body: "slender", skin: "tan", hairStyle: "ponytail", hairColor: "red" } as const;
    sim.setAppearance(id, { name: "Slade", appearance: customLook });
    expect(must(sim.snapshots()[0]).name).toBe("Slade");
    expect(must(sim.snapshots()[0]).appearance).toEqual(customLook);
  });

  it("enforces campfire proximity for campfire crafting recipes", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Crafter");
    expect(must(sim.inventorySnapshot(id)).nearCampfire).toBe(true);
    expect(sim.craftRecipe(id, "craft-axe")).toBe(true);
    expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(true);

    sim.queueInput(id, { seq: 2, moveX: -1, moveY: 0 });
    for (let i = 0; i < 60; i++) sim.step();
    expect(must(sim.inventorySnapshot(id)).nearCampfire).toBe(false);
    expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(false);
  });
});
