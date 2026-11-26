/** Unit tests for Blacksmith prefix reforging & +1..+3 upgrade limits [REQ-P9-10][REQ-P9-11]. */
import { eligiblePrefixesForItem, getItemDef } from "@dc2d/content";
import { describe, expect, it } from "vitest";
import { createEmptyInventoryState } from "./slotModel.js";
import { applyBlacksmithReforge, applyBlacksmithUpgrade } from "./upgradeOps.js";

const TEST_SWORD = "sword";
const COPPER_INGOT = "copper-ingot";

describe("[REQ-P9-10] Blacksmith prefix reforging", () => {
  it("deducts gold/materials and replaces prefixId with a distinct valid category prefix preserving upgradeLevel", () => {
    const state = createEmptyInventoryState();
    const swordDef = getItemDef(TEST_SWORD);
    if (!swordDef) throw new Error("expected iron-sword def");
    const eligible = eligiblePrefixesForItem(swordDef).map((p) => p.id);
    const initialPrefix = eligible[0];
    if (!initialPrefix || eligible.length < 2) throw new Error("expected >=2 prefixes");
    state.slots[0] = { itemId: TEST_SWORD, count: 1, prefixId: initialPrefix, upgradeLevel: 2 };
    state.slots[9] = { itemId: COPPER_INGOT, count: 3 };
    state.slots[10] = { itemId: "flint", count: 3 };

    const res = applyBlacksmithReforge({ slots: state.slots, gold: 200, slotIndex: 0, unitRoll: 0.42 });
    expect(res.ok).toBe(true);
    expect(res.gold).toBeLessThan(200);
    expect(res.updatedItem?.prefixId).toBeDefined();
    expect(res.updatedItem?.prefixId).not.toBe(initialPrefix);
    expect(eligible).toContain(res.updatedItem?.prefixId);
    expect(res.updatedItem?.upgradeLevel).toBe(2);
  });

  it("rejects insufficient gold without mutating slots", () => {
    const state = createEmptyInventoryState();
    state.slots[0] = { itemId: TEST_SWORD, count: 1, prefixId: "keen" };
    state.slots[9] = { itemId: COPPER_INGOT, count: 3 };
    const res = applyBlacksmithReforge({ slots: state.slots, gold: 5, slotIndex: 0, unitRoll: 0.1 });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("Not enough Gold");
    expect(res.slots[0]?.prefixId).toBe("keen");
  });
});

describe("[REQ-P9-11] Blacksmith +1..+3 upgrade rules", () => {
  it("upgrades +0 -> +1 -> +2 -> +3 and rejects +4 cleanly", () => {
    const state = createEmptyInventoryState();
    state.slots[0] = { itemId: TEST_SWORD, count: 1, prefixId: "keen" };
    state.slots[9] = { itemId: COPPER_INGOT, count: 5 };
    state.slots[10] = { itemId: "iron-ingot", count: 5 };
    state.slots[11] = { itemId: "sunstone", count: 5 };

    const r1 = applyBlacksmithUpgrade({ slots: state.slots, gold: 1000, slotIndex: 0 });
    expect(r1.ok).toBe(true);
    expect(r1.updatedItem?.upgradeLevel).toBe(1);

    const r2 = applyBlacksmithUpgrade({ slots: r1.slots, gold: r1.gold, slotIndex: 0 });
    expect(r2.ok).toBe(true);
    expect(r2.updatedItem?.upgradeLevel).toBe(2);

    const r3 = applyBlacksmithUpgrade({ slots: r2.slots, gold: r2.gold, slotIndex: 0 });
    expect(r3.ok).toBe(true);
    expect(r3.updatedItem?.upgradeLevel).toBe(3);

    const r4 = applyBlacksmithUpgrade({ slots: r3.slots, gold: r3.gold, slotIndex: 0 });
    expect(r4.ok).toBe(false);
    expect(r4.error).toContain("+3");
    expect(r4.updatedItem).toBeUndefined();
    expect(r4.slots[0]?.upgradeLevel).toBe(3);
  });
});
