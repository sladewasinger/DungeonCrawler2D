# Content Items, Prefixes & Loot (`packages/content/src/items`)

Declarative catalog of all `76` items, five-tier rarities, `18` rolled prefixes, instance stat resolver, and seeded biome/POI loot rollers:

- `catalog.ts`: Base gear/resources (`ITEM_CATALOG`), `STARTER_LOADOUT`, `STARTER_ARMOR`, `isBowItem`, `isMeleeItem`, `isShieldItem`, `resolveBlockMode`, and `ItemDef` accessors.
- `frontierWeapons.ts`, `frontierArmor.ts`, `frontierMaterials.ts`: Frontier weapons, 4 armor/shield tiers, smelting ingots, reagents, and tactical elixirs.
- `rarities.ts`: Five-tier `RARITY_META` (`common`..`legendary`) palette, glow colors, and `bumpRarity`.
- `prefixes.ts`: `PREFIX_CATALOG` (`18` stat/perk prefixes with weapon/tool/armor/offhand/bow target filtering).
- `statResolver.ts`: Pure `resolveItemInstance` combining base `ItemDef` + prefix modifiers.
- `lootTables.ts`: Seeded `rollChestLoot`, `rollEnemyDrop`, and `classifyPoiLootCategory` across all 5 macro biomes & danger tiers.
