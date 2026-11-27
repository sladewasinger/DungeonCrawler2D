# `@dc2d/content`

Tier-2 pure declarative game catalogs and visual palettes (depends only on `@dc2d/contracts`):

## Architecture & Directories
| Directory | Covers |
| --- | --- |
| [`src/items/`](./src/items/README.md) | `76` item definitions, `5` rarity tiers, `18` prefixes, stat resolver, and seeded biome/POI loot tables |
| [`src/props/`](./src/props/README.md) | Compile-time-exhaustive `PROP_SPECS` capability registry (`satisfies Record<PropKind, PropSpec>`) |
| `src/biomes/` | Overworld biome metadata (`BIOME_CATALOG`: names, danger tiers, wildlife rosters, particle themes) |
| `src/recipes/` | Hand, campfire, and smelting/crafting recipes (`RECIPE_CATALOG`) |
| `src/character/` | Armor recolor palettes, skin/eye/hair tone triads (`HAIR_PALETTES`, `ARMOR_VISUAL_STYLES`) |
| `src/world/` | Atmospheric light palettes (`FOREST_LIGHT_STYLE`), quality presets (`QUALITY_PRESETS`), and outline presets |
