# `@dc2d/content`

Pure static game data and Zod validation schemas shared by engine, server, and
client. Contains no runtime platform dependencies (`phaser`, `ws`, Node built-ins,
or other `@dc2d/*` packages).

## Contents

- `index.ts` — Typed, Zod-validated catalog exports.
- `data/items.json` & `data/recipes.json` — Weapons, consumables, materials,
  and crafting recipes.
- `data/enemies.json` — Enemy stats, hurtboxes, and behavior definitions.
- `data/areas.json` & `data/areaReactions.json` — Elemental ground zones and
  cross-area interaction rules.
- `data/statuses.json` & `data/rules.json` — Status effects and global combat/game
  rules.
- `data/liveTuning.json` & `data/liveTuning.schema.ts` — Runtime-adjustable
  gameplay tuning knobs.
- `data/tileCatalog.json` & `data/tileCatalog.schema.ts` — Indexed tile pack
  metadata for `assets/packs/`.
- `data/strings.json` — UI and announcement copy.
