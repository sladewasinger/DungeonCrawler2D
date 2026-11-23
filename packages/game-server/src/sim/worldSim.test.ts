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

    sim.queueInput(id, { seq: 3, moveX: 0, moveY: 0, jump: true });
    sim.step();
    const launching = must(sim.snapshots()[0]);
    expect(launching.jumpZ).toBeGreaterThan(0);
    expect(launching.jumpVz).toBeGreaterThan(0);

    sim.queueInput(id, { seq: 4, moveX: 0, moveY: 0 });
    let sawFall = false;
    for (let i = 0; i < 15; i++) {
      sim.step();
      if ((must(sim.snapshots()[0]).jumpVz ?? 0) < 0) sawFall = true;
    }
    expect(sawFall).toBe(true);
    expect(must(sim.snapshots()[0]).jumpZ).toBe(0);

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
    expect(initial.armor).toEqual({
      head: null,
      chest: "leather-tunic",
      legs: "leather-leggings",
      feet: "leather-boots",
      offhand: null,
    });
    expect(computeArmorDefense(initial.armor, getItemDef)).toBe(9);
    expect(initial.slots[0]).toEqual({ itemId: "wooden-spear", count: 1 });
    expect(initial.slots.slice(1).every((s) => s === null)).toBe(true);
    expect(must(sim.snapshots()[0]).heldItem).toBe("wooden-spear");

    const HOOD_ID = "leather-hood";
    sim.grantPlayerItems(id, [
      { slot: 1, itemId: "bow", count: 1 },
      { slot: 9, itemId: HOOD_ID, count: 1 },
      { slot: 11, itemId: "wood", count: 8 },
    ]);

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
    expect(afterArmor.armor.head).toBe(HOOD_ID);
    expect(computeArmorDefense(afterArmor.armor, getItemDef)).toBe(11);
    expect(must(sim.snapshots()[0]).armor?.head).toBe(HOOD_ID);

    const customLook = { body: "female", skin: "tan", eyeColor: "violet", hairStyle: "ponytail", hairColor: "red" } as const;
    sim.setAppearance(id, { name: "Slade", appearance: customLook });
    expect(must(sim.snapshots()[0]).name).toBe("Slade");
    expect(must(sim.snapshots()[0]).appearance).toEqual(customLook);
  });

  it("enforces campfire proximity for campfire crafting recipes", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Crafter");
    sim.grantPlayerItems(id, [
      { slot: 11, itemId: "wood", count: 8 },
      { slot: 12, itemId: "stone", count: 6 },
      { slot: 14, itemId: "raw-meat", count: 3 },
    ]);
    expect(must(sim.inventorySnapshot(id)).nearCampfire).toBe(true);
    expect(sim.craftRecipe(id, "craft-axe")).toBe(true);
    expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(true);

    sim.queueInput(id, { seq: 2, moveX: -1, moveY: 0 });
    for (let i = 0; i < 60; i++) sim.step();
    expect(must(sim.inventorySnapshot(id)).nearCampfire).toBe(false);
    expect(sim.craftRecipe(id, "craft-cooked-meat")).toBe(false);
  });

  it("allows jumping off raised cliffs to drop down while keeping grounded ledge walking blocked", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Jumper");
    let seq = 1;
    const walkUntil = (move: readonly [number, number], stop: () => boolean, maxSteps = 80): void => {
      sim.queueInput(id, { seq: seq++, moveX: move[0], moveY: move[1] });
      for (let i = 0; i < maxSteps && !stop(); i++) sim.step();
    };
    walkUntil([-1, 0], () => must(sim.snapshots()[0]).x <= -9.5);
    walkUntil([0, -1], () => must(sim.snapshots()[0]).y <= -8.2);
    expect(must(sim.snapshots()[0]).elevation).toBe(1);

    walkUntil([1, 0], () => must(sim.snapshots()[0]).x >= -7.5);
    walkUntil([0, 1], () => false, 20);
    const blockedAtRim = must(sim.snapshots()[0]);
    expect(blockedAtRim.elevation).toBe(1);

    sim.queueInput(id, { seq: seq++, moveX: 0, moveY: 1, jump: true });
    let droppedMidAir = false;
    for (let i = 0; i < 30; i++) {
      sim.step();
      const s = must(sim.snapshots()[0]);
      if (s.elevation === 0 && (s.jumpZ ?? 0) > 0) droppedMidAir = true;
    }
    const landed = must(sim.snapshots()[0]);
    expect(droppedMidAir).toBe(true);
    expect(landed.elevation).toBe(0);
    expect(landed.jumpZ).toBe(0);
    expect(landed.y).toBeGreaterThan(blockedAtRim.y);
  });

  it("distinguishes normal walking speed from shift sprinting in player snapshots", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("Walker");
    sim.queueInput(id, { seq: 1, moveX: 0.64, moveY: 0 });
    sim.step();
    const walkSnap = must(sim.snapshots()[0]);
    expect(walkSnap.moving).toBe(true);
    expect(walkSnap.sprinting).toBe(false);
    expect(walkSnap.facingX).toBeCloseTo(1, 3);

    sim.queueInput(id, { seq: 2, moveX: 1, moveY: 0 });
    sim.step();
    const sprintSnap = must(sim.snapshots()[0]);
    expect(sprintSnap.moving).toBe(true);
    expect(sprintSnap.sprinting).toBe(true);
  });

  it("supports admin godMode (unlimited HP & stamina), heal, give, and clearWebs actions", () => {
    const sim = new WorldSim(1337);
    const id = sim.addPlayer("AdminHero");
    sim.handleAdminAction(id, { action: "godMode", enabled: true });
    expect(must(sim.snapshots()[0]).godMode).toBe(true);

    sim.queueInput(id, { seq: 1, moveX: 1, moveY: 0, dodge: true, attack: true });
    for (let i = 0; i < 12; i++) sim.step();
    const godSnap = must(sim.snapshots()[0]);
    expect(godSnap.hp).toBe(100);
    expect(godSnap.stamina).toBe(100);

    sim.handleAdminAction(id, { action: "give", itemId: "torch", count: 2 });
    const hasTorch = must(sim.inventorySnapshot(id)).slots.some((s) => s?.itemId === "torch" && s.count === 2);
    expect(hasTorch).toBe(true);

    sim.handleAdminAction(id, { action: "godMode", enabled: false });
    expect(must(sim.snapshots()[0]).godMode).toBeUndefined();
    sim.queueInput(id, { seq: 2, moveX: 1, moveY: 0, dodge: true });
    sim.step();
    expect(must(sim.snapshots()[0]).stamina).toBeLessThan(100);

    sim.handleAdminAction(id, { action: "heal" });
    expect(must(sim.snapshots()[0]).stamina).toBe(100);
    sim.handleAdminAction(id, { action: "clearWebs" });
  });
});
