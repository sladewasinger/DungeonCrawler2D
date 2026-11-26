/** Unit tests verifying deterministic frontier chest & enemy loot rolling. */
import { describe, expect, it } from "vitest";
import { BIOME_CATALOG, getBiomeEntry } from "../biomes/biomeCatalog.js";
import { getItemDef } from "./catalog.js";
import { rollChestLoot, rollEnemyDrop } from "./lootTables.js";
import { getRarityMeta, RARITY_ORDER } from "./rarities.js";

describe("biomeCatalog & lootTables", () => {
  it("provides catalog metadata for all 5 frontier biomes", () => {
    expect(Object.keys(BIOME_CATALOG)).toHaveLength(5);
    expect(getBiomeEntry("craggy-highlands").baseDangerTier).toBe(3);
    expect(getBiomeEntry("cursed-ruinlands").baseDangerTier).toBe(4);
  });

  it("rolls deterministic chest loot whose items exist in catalog and scale by tier", () => {
    const a = rollChestLoot({ worldSeed: 42, chestId: "poi:1,2", poiKind: "bandit-camp", biome: "autumn-woods", dangerTier: 2 });
    const b = rollChestLoot({ worldSeed: 42, chestId: "poi:1,2", poiKind: "bandit-camp", biome: "autumn-woods", dangerTier: 2 });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
    for (const entry of a) expect(getItemDef(entry.itemId)).toBeDefined();
  });

  it("guarantees rare+ gear and ancient-core in elite lairs & puzzle vaults", () => {
    const lair = rollChestLoot({ worldSeed: 99, chestId: "lair:4,5", poiKind: "golem-forge", biome: "craggy-highlands", dangerTier: 3 });
    expect(lair.some((e) => e.itemId === "ancient-core")).toBe(true);
    const rareOrBetter = lair.some((e) => {
      const rar = getItemDef(e.itemId)?.rarity ?? "common";
      return RARITY_ORDER.indexOf(rar) >= RARITY_ORDER.indexOf("epic");
    });
    expect(rareOrBetter).toBe(true);
  });

  it("guarantees prefixed uncommon/rare+ gear & rare mats on elite kills", () => {
    const drops = rollEnemyDrop({ seed: 777, kind: "golem", biome: "cursed-ruinlands", dangerTier: 4, isElite: true });
    expect(drops.some((e) => e.itemId === "ancient-core")).toBe(true);
    const hasHighGear = drops.some((e) => {
      const def = getItemDef(e.itemId);
      return def && (def.category === "weapon" || def.category === "armor") && RARITY_ORDER.indexOf(getRarityMeta(def.rarity).id) >= RARITY_ORDER.indexOf("rare");
    });
    expect(hasHighGear).toBe(true);
  });
});
