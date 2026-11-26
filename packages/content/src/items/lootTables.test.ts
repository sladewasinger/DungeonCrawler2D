/** Unit tests verifying deterministic frontier chest & enemy loot rolling. */
import { describe, expect, it } from "vitest";
import { BIOME_CATALOG, getBiomeEntry } from "../biomes/biomeCatalog.js";
import { getItemDef } from "./catalog.js";
import { rollChestLoot, rollEnemyDrop } from "./lootTables.js";
import { getRarityMeta, RARITY_ORDER } from "./rarities.js";

const CURSED_BIOME = "cursed-ruinlands";
const POI_BANDIT = "bandit-camp";
const ITEM_CORE = "ancient-core";

describe("biomeCatalog & lootTables", () => {
  it("provides catalog metadata for all 5 frontier biomes", () => {
    expect(Object.keys(BIOME_CATALOG)).toHaveLength(5);
    expect(getBiomeEntry("craggy-highlands").baseDangerTier).toBe(3);
    expect(getBiomeEntry(CURSED_BIOME).baseDangerTier).toBe(4);
  });

  it("rolls deterministic chest loot whose items exist in catalog and scale by tier", () => {
    const a = rollChestLoot({ worldSeed: 42, chestId: "poi:1,2", poiKind: POI_BANDIT, biome: "autumn-woods", dangerTier: 2 });
    const b = rollChestLoot({ worldSeed: 42, chestId: "poi:1,2", poiKind: POI_BANDIT, biome: "autumn-woods", dangerTier: 2 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
    for (const entry of a) expect(getItemDef(entry.itemId)).toBeDefined();
  });

  it("guarantees rare+ gear and ancient-core in elite lairs & puzzle vaults", () => {
    const lair = rollChestLoot({ worldSeed: 99, chestId: "lair:4,5", poiKind: "golem-forge", biome: "craggy-highlands", dangerTier: 3 });
    expect(lair.some((e) => e.itemId === ITEM_CORE)).toBe(true);
    const rareOrBetter = lair.some((e) => {
      const rar = getItemDef(e.itemId)?.rarity ?? "common";
      return RARITY_ORDER.indexOf(rar) >= RARITY_ORDER.indexOf("rare");
    });
    expect(rareOrBetter).toBe(true);
  });

  it("guarantees prefixed uncommon/rare+ gear & rare mats on elite kills", () => {
    const drops = rollEnemyDrop({ seed: 777, kind: "golem", biome: CURSED_BIOME, dangerTier: 4, isElite: true });
    expect(drops.some((e) => e.itemId === ITEM_CORE)).toBe(true);
    const hasHighGear = drops.some((e) => {
      const def = getItemDef(e.itemId);
      return def && (def.category === "weapon" || def.category === "armor") && RARITY_ORDER.indexOf(getRarityMeta(def.rarity).id) >= RARITY_ORDER.indexOf("rare");
    });
    expect(hasHighGear).toBe(true);
  });

  it("caps Tier 1 regular chests at common/uncommon gear and escalates Tier 5 vaults", () => {
    for (let i = 0; i < 25; i++) {
      const t1 = rollChestLoot({ worldSeed: 42 + i, chestId: `t1:${i}`, poiKind: POI_BANDIT, biome: "verdant-forest", dangerTier: 1 });
      for (const e of t1) {
        const def = getItemDef(e.itemId);
        if (def && (def.category === "weapon" || def.category === "armor" || def.category === "tool")) {
          expect(["common", "uncommon"]).toContain(def.rarity);
        }
      }
    }
    const t5 = rollChestLoot({ worldSeed: 99, chestId: "vault:200,0", poiKind: "brazier-vault", biome: CURSED_BIOME, dangerTier: 5 });
    expect(t5.some((e) => e.itemId === ITEM_CORE)).toBe(true);
  });
});
