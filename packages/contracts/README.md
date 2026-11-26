# @dc2d/contracts — Tier 1 Pure Domain Contracts

Zero-dependency leaf package holding pure cross-package domain IDs, const-tuple enums (`GroundKind`, `PropKind`), canonical unions, and declarative contract interfaces (`PropSpec`, `RecipeDef`, `EffectRule`). Contains **no data tables or runtime side effects**.

## Architectural Role (Tier 1)
- Imports **no** `@dc2d/*` packages, **no** Node built-ins (`node:*`), and **no** renderers (`pixi.js`).
- Imported cleanly by Tier 2 (`@dc2d/content`), Tier 3 (`@dc2d/engine`), and Tier 4 (`@dc2d/game-server`, `@dc2d/client`).

## Modules
- [world.ts](./src/world.ts) — Chunk constants, runtime `GroundKind` / `PropKind` values, biome, danger tier, and POI kind unions.
- [items.ts](./src/items.ts) — Shared rarity, armor slot, structure kind, recipe, item category, weapon archetype, cosmetic slot, and harvest spec contracts.
- [combat.ts](./src/combat.ts) — Shared gore, weapon archetype, entity/wildlife/AI state, damage element/kind, and composable `EffectGraph` rule types.
- [propSpecTypes.ts](./src/propSpecTypes.ts) — Declarative `PropSpec` capability interface implemented exhaustively in `@dc2d/content`.
- [index.ts](./src/index.ts) — Barrel exports for downstream workspace packages.
