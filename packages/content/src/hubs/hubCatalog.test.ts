/** Unit tests for Merchant catalog, Floor Guide quests, and rotating 3-Bounty generator. */
import { describe, expect, it } from "vitest";
import { getItemDef } from "../items/catalog.js";
import { BOUNTY_TEMPLATES, generateFloorBounties } from "./bounties.js";
import { MERCHANT_STOCK, resolveMerchantCatalog } from "./merchantCatalog.js";
import { FLOOR_GUIDE_QUESTS } from "./quests.js";

describe("hub catalogs", () => {
  it("[REQ-P9-08] validates every merchant offer references a valid item and positive gold cost", () => {
    expect(MERCHANT_STOCK.length).toBeGreaterThanOrEqual(8);
    for (const offer of resolveMerchantCatalog(1337, 0)) {
      expect(getItemDef(offer.itemId)).toBeDefined();
      expect(offer.goldCost).toBeGreaterThan(0);
      expect(offer.quantity).toBeGreaterThan(0);
    }
  });

  it("[REQ-P9-13] provides >= 4 Floor Guide quests with positive Gold and valid item rewards", () => {
    expect(FLOOR_GUIDE_QUESTS.length).toBeGreaterThanOrEqual(4);
    for (const q of FLOOR_GUIDE_QUESTS) {
      expect(q.rewardGold).toBeGreaterThan(0);
      if (q.rewardItem) expect(getItemDef(q.rewardItem.itemId)).toBeDefined();
    }
  });

  it("[REQ-P9-12] generates 3 distinct deterministic bounties per floor cycle", () => {
    const board = generateFloorBounties(1337, 0);
    expect(board).toEqual(generateFloorBounties(1337, 0));
    expect(board.length).toBe(3);
    expect(new Set(board.map((b) => b.id)).size).toBe(3);
    expect(BOUNTY_TEMPLATES.every((b) => b.rewardGold > 0)).toBe(true);
  });
});
