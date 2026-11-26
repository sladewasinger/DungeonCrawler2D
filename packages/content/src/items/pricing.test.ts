/** Unit tests for deterministic item pricing, sell values, upgrades, and gold drops. */
import { describe, expect, it } from "vitest";
import { computeItemValue, computeReforgeCost, computeSellPrice, computeUpgradeCost, rollGoldDrop } from "./pricing.js";

describe("pricing and economy formulas", () => {
  it("[REQ-P9-09] scales item values deterministically across rarity, prefixes, and upgrades", () => {
    const plain = computeItemValue({ itemId: "sword" });
    const prefixed = computeItemValue({ itemId: "sword", prefixId: "ancient" });
    const upgraded = computeItemValue({ itemId: "sword", prefixId: "ancient", upgradeLevel: 3 });
    expect(prefixed).toBeGreaterThan(plain);
    expect(upgraded).toBeGreaterThan(prefixed);
    expect(computeSellPrice({ itemId: "wood" })).toBeGreaterThanOrEqual(2);
    expect(computeSellPrice({ itemId: "sword", prefixId: "keen", upgradeLevel: 2 })).toBe(
      Math.max(2, Math.floor(computeItemValue({ itemId: "sword", prefixId: "keen", upgradeLevel: 2 }) * 0.5)),
    );
  });

  it("computes progressive Blacksmith reforge and +1..+3 upgrade costs and caps at +3", () => {
    const rSword = computeReforgeCost({ itemId: "sword" });
    expect(rSword.gold).toBe(40);
    expect(computeUpgradeCost(0)?.nextLevel).toBe(1);
    expect(computeUpgradeCost(1)?.material.itemId).toBe("iron-ingot");
    expect(computeUpgradeCost(2)?.material.itemId).toBe("sunstone");
    expect(computeUpgradeCost(3)).toBeNull();
    expect(rollGoldDrop({ tier: 1, unitRoll: 0.5 })).toBeGreaterThanOrEqual(3);
    expect(rollGoldDrop({ tier: 4, isElite: true, unitRoll: 0.9 })).toBeGreaterThanOrEqual(60);
  });
});
