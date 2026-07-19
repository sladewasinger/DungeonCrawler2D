// Headless test for the inventory window's pure tab-filter/sort/row-view derivation.
import { describe, expect, it } from "vitest";
import type { InventoryRowData } from "./fakeData.js";
import { INVENTORY_TABS, inventoryRowViews } from "./inventoryRows.js";

function rows(): InventoryRowData[] {
  return [
    { itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0 },
    { itemId: "bandage", name: "Bandage", qty: 3, category: "usables", boundSlot: null },
    { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null },
    { itemId: "hammer", name: "Heavy Hammer", qty: 1, category: "weapons", boundSlot: 4 },
  ];
}

describe("INVENTORY_TABS", () => {
  it("ships v1's four filters verbatim, in order", () => {
    expect(INVENTORY_TABS.map((tab) => tab.id)).toEqual(["all", "weapons", "usables", "materials"]);
  });
});

describe("inventoryRowViews", () => {
  it("the 'all' tab includes every category, sorted by display name", () => {
    const views = inventoryRowViews(rows(), "all");
    expect(views.map((v) => v.itemId)).toEqual(["bandage", "hammer", "rag", "sword"]);
  });

  it("filters to just the active tab's category", () => {
    expect(inventoryRowViews(rows(), "weapons").map((v) => v.itemId)).toEqual(["hammer", "sword"]);
    expect(inventoryRowViews(rows(), "usables").map((v) => v.itemId)).toEqual(["bandage"]);
    expect(inventoryRowViews(rows(), "materials").map((v) => v.itemId)).toEqual(["rag"]);
  });

  it("marks isWeapon true only for the weapons category", () => {
    const views = inventoryRowViews(rows(), "all");
    expect(views.find((v) => v.itemId === "sword")?.isWeapon).toBe(true);
    expect(views.find((v) => v.itemId === "rag")?.isWeapon).toBe(false);
  });

  it("passes qty and boundSlot straight through", () => {
    const views = inventoryRowViews(rows(), "weapons");
    expect(views.find((v) => v.itemId === "hammer")).toMatchObject({ qty: 1, boundSlot: 4 });
    expect(views.find((v) => v.itemId === "sword")).toMatchObject({ qty: 1, boundSlot: 0 });
  });

  it("does not mutate the input array's order", () => {
    const input = rows();
    const originalOrder = input.map((r) => r.itemId);
    inventoryRowViews(input, "all");
    expect(input.map((r) => r.itemId)).toEqual(originalOrder);
  });
});
