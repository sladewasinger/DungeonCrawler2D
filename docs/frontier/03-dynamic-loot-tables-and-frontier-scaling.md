# Spec 03 — Dynamic Loot Tables, Frontier Distance Scaling & Elites

> **Touchpoints**:
> `@dc2d/content` (`src/items/lootTables.ts`, `src/recipes/recipes.ts`),
> `@dc2d/engine` (`src/world/biomes/macroBiome.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/wildlife/lootManager.ts`, `src/sim/wildlife/loot/eliteScaling.ts`, `src/sim/wildlife/worldEcology.ts`),
> `@dc2d/client` (`src/render/combat/entitySprites.ts`).

---

## 1. Frontier Distance & Danger Tier Formula

Exploration outward is governed by a clear 4-tier progression scale (`DangerTier: 1 | 2 | 3 | 4`):

- **Distance Tier**:
  - `r < 48` tiles -> Distance Tier `1`
  - `48 <= r < 112` tiles -> Distance Tier `2`
  - `112 <= r < 192` tiles -> Distance Tier `3`
  - `r >= 192` tiles -> Distance Tier `4`
- **Biome Base Tier**:
  - `verdant-forest`: `1`
  - `autumn-woods`: `2`
  - `misty-bog`: `2`
  - `craggy-highlands`: `3`
  - `cursed-ruinlands`: `4`
- **Effective `DangerTier`**: `clamp(Math.max(biomeTier, distanceTier), 1, 4)` (or `clamp(Math.round((biomeTier + distanceTier) / 2), 1, 4)` when stepping into harsh outer biomes near spawn, guaranteeing outer rings always escalate!). Specifically: `clamp(Math.max(distanceTier, Math.min(4, biomeTier)), 1, 4)`.

---

## 2. Seeded Chest & Drop Loot Tables (`lootTables.ts`)

`rollChestLoot({ worldSeed, chestId, poiKind, biome, dangerTier })` replaces hardcoded chest arrays:
- Deterministic PRNG seeded from `worldSeed` + hashed `chestId` so world resets/seeds remain reproducible.
- **Slot Structure**:
  1. **Core Supplies (1–3 stacks)**: arrows, bandages, cooked meat, torches, or frontier elixirs scaled by tier.
  2. **Biome & Tier Materials (1–3 stacks)**: wood/flint/stone in Tier I; copper-ore/amber-resin/bog-spore in Tier II; iron-ore/sunstone in Tier III; shadow-shard/ancient-core in Tier IV.
  3. **Gear & Relics (1–3 items)**: rolled by POI category (`bandit-camp`, `ancient-ruins`, `micro`, `lair`, `puzzle`, `friendly`) + `DangerTier` rarity weights:
     - **Tier I**: `70% Common / 26% Uncommon / 4% Rare` (`20%` prefix chance)
     - **Tier II**: `35% Common / 44% Uncommon / 18% Rare / 3% Epic` (`40%` prefix chance)
     - **Tier III**: `12% Common / 38% Uncommon / 34% Rare / 14% Epic / 2% Legendary` (`65%` prefix chance)
     - **Tier IV**: `0% Common / 22% Uncommon / 42% Rare / 28% Epic / 8% Legendary` (`85%` prefix chance)
  - **Elite Lairs & Puzzle Vaults**: Guarantee at least 1 `Rare+` item (or `Epic+` in Tier III–IV) plus `ancient-core` / biome shards!

`rollEnemyDrop({ seed, kind, biome, dangerTier, isElite })` upgrades creature drops:
- Regular mobs scale material drops and have a small chance (`5%–15%` by tier) to drop an `Uncommon+` gear item.
- **Elite Mini-Bosses** always drop `1–2` rare biome materials (`ancient-core` / `sunstone` / `shadow-shard`) + `1` guaranteed `Uncommon+` (Tier III–IV: `Rare+`) prefixed weapon or armor piece!

---

## 3. Elite Scaling & Danger-Scaled Wildlife (`eliteScaling.ts`)

- **Danger-Tier Creature Scaling**: Non-POI and POI mobs outside spawn scale gently with `DangerTier`:
  - Tier I: `1.0×` HP / `1.0×` damage
  - Tier II: `1.25×` HP / `1.15×` damage
  - Tier III: `1.55×` HP / `1.3×` damage
  - Tier IV: `1.9×` HP / `1.5×` damage
- **Elite Mini-Bosses (`isElite: true`)**:
  - Spawned as the centerpiece guard of the 4 Elite Lairs (`Broodmother` Spider, `Orc Warchief`, `Runic Golem`, `Cursed Warden` Skeleton) and rarely (`8%`) as wandering Tier III–IV champions.
  - `2.6×` HP, `1.45×` damage, `1.22×` scale, golden aura ring & custom title nameplate in `EntityView`.

---

## 4. Frontier Crafting Loop (`recipes.ts`)

Biome materials and ores feed meaningful Workbench & Campfire crafting recipes:
- **Smelting (Campfire)**: `copper-ore -> copper-ingot`, `iron-ore -> iron-ingot`.
- **Frontier Weapons (Workbench)**: `copper-sword`, `copper-spear`, `bandit-cutlass`, `bog-dagger` (`bog-spore`), `amber-recurve-bow` (`amber-resin`), `frost-hatchet` (`iron-ingot` + `sunstone`), `shadowfang-spear` (`shadow-shard` + `ancient-core`), `golem-maul` (`iron-ingot` + `ancient-core`).
- **Frontier Armor Sets & Shields (Workbench)**: `moss-stalker-*`, `autumn-ranger-*`, `iron-knight-*`, `shadowsteel-*`, `reinforced-shield`, `runic-buckler`.
- **Frontier Elixirs (Campfire)**: `swiftness-draught`, `ironbark-tonic`, `shadow-oil`, `phoenix-salve`.
