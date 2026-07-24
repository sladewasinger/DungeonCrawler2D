/** Verifies the Three.js HUD view-model transformations without a browser. */
import { describe, expect, it } from "vitest";
import {
  hotbarQuantity,
  inventoryRows,
  nextAvailableHotbarSlot,
} from "./ThreeHudModel.js";

describe("ThreeHudModel", () => {
  it("sorts live inventory and reports bindings and actions", () => {
    const rows = inventoryRows(
      [{ item: "rag", qty: 2 }, { item: "bandage", qty: 3 }],
      [null, "bandage"],
    );
    expect(rows.map((row) => row.id)).toEqual(["bandage", "rag"]);
    expect(rows[0]).toMatchObject({
      quantity: 3,
      boundSlot: 1,
      canUse: true,
      canHotbar: true,
    });
    expect(rows[1]).toMatchObject({
      boundSlot: null,
      canEquip: false,
      canUse: false,
    });
  });

  it("reuses an existing binding before choosing an empty slot", () => {
    expect(nextAvailableHotbarSlot(["torch", null], "torch")).toBe(0);
    expect(nextAvailableHotbarSlot(["torch", null], "bandage")).toBe(1);
    expect(nextAvailableHotbarSlot(["torch"], "bandage")).toBe(-1);
  });

  it("looks up a hotbar stack quantity", () => {
    expect(hotbarQuantity([{ item: "torch", qty: 4 }], "torch")).toBe(4);
    expect(hotbarQuantity([], "torch")).toBe(0);
    expect(hotbarQuantity([], null)).toBe(0);
  });
});
