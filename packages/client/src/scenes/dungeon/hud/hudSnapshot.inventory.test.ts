import { describe, expect, it } from "vitest";
import { snapshotOf, source } from "./hudSnapshot.test.js";

describe("buildHudSnapshot inventory and progression", () => {
  it("builds inventory rows with hotbar bindings", () => {
    const hotbar = ["sword", null, null, null, null, null, null, null, null];
    const inventory = [{ item: "sword", qty: 1 }, { item: "rag", qty: 6 }];
    expect(snapshotOf(source({ hotbar, inventory })).inventory).toEqual([
      { itemId: "sword", name: "Rusty Sword", qty: 1, category: "weapons", boundSlot: 0, canUse: false, canHotbar: false, flavor: expect.any(String) },
      { itemId: "rag", name: "Rag", qty: 6, category: "materials", boundSlot: null, canUse: false, canHotbar: false, flavor: expect.any(String) },
    ]);
  });
  it("builds nearby craft rows", () => {
    const craft = snapshotOf(source({ inventory: [{ item: "rag", qty: 6 }], craftTableNearby: true })).craft;
    expect(craft.nearby).toBe(true); expect(craft.recipes.find((row) => row.recipeId === "bandage")?.craftable).toBe(true);
  });
  it("reports unavailable craft tables", () => expect(snapshotOf(source({ craftTableNearby: false })).craft.nearby).toBe(false));
  it("builds personal stash columns", () => {
    const stash = snapshotOf(source({ inventory: [{ item: "sword", qty: 1 }], stash: [{ item: "bandage", qty: 2 }], stashNearby: true })).stash;
    expect(stash).toEqual({ kind: "personal", nearby: true, inventory: [{ index: 0, itemId: "sword", name: "Rusty Sword", qty: 1 }], entries: [{ index: 0, itemId: "bandage", name: "Bandage", qty: 2 }] });
  });
  it("handles absent and loot stashes", () => {
    expect(snapshotOf(source({ stash: null, stashNearby: true })).stash.entries).toEqual([]);
    expect(snapshotOf(source({ stash: [{ item: "rag", qty: 3 }], stashNearby: true, stashKind: "loot" })).stash.kind).toBe("loot");
  });
  it("passes toast, seed input text, and progression", () => {
    const toast = { msg: "Crafted bandage", until: 12345 };
    const snapshot = snapshotOf(source({ lastToast: toast, toasts: [{ msg: "Missing rag", until: 999 }], seedInputText: "e2e-world", xp: 220, level: 3, xpForNext: 80 }));
    expect(snapshot.lastToast).toBe(toast); expect(snapshot.toasts).toEqual([{ msg: "Missing rag", until: 999 }]);
    expect(snapshot.seedInputText).toBe("e2e-world"); expect(snapshot.xp).toEqual({ xp: 220, level: 3, xpForNext: 80 });
  });
});
