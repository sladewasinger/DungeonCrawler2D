# Architecture

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Rendering/game framework | **Phaser 3** (Arcade Physics) | Mature, well-documented, ideal for top-down tile games |
| Language | **TypeScript** (strict) | Data schemas for items/effects need real types |
| Build/dev | **Vite** | Instant HMR, trivial static deploy |
| Tests | **Vitest** | Same toolchain as Vite; runs the headless engine core |
| Backend (v0.5+) | Node + TypeScript (Fastify or similar) | AI API proxy first, item registry later |
| Persistence | localStorage → backend DB (v0.6) | Start simple, migrate behind a storage interface |

## The one rule that matters

**`engine/` is game-agnostic and Phaser-free; `game/` is content and presentation.**

Everything that defines *what the game is* — effect primitives, interaction rules, dungeon generation, item semantics — lives in `engine/` as pure TypeScript, testable in Node with no browser. Phaser scenes in `game/` are a *view* over that simulation. This is not aesthetic preference; it's what makes the AI crafting feature tractable: the AI emits data conforming to engine schemas, and we can validate and simulate a proposed item entirely headlessly before it ever renders.

## Directory layout

```
dungeoncrawler2D/
├── docs/                      # This documentation
├── public/                    # Static assets served as-is
├── assets/                    # Source art (aseprite/png), pre-pipeline
├── src/
│   ├── main.ts                # Vite entry: boots Phaser
│   ├── engine/                # ── PURE, PHASER-FREE ──
│   │   ├── core/              # RNG (seeded), event bus, clock/ticks, ids
│   │   ├── dungeon/           # Procedural generation: DungeonMap, generators
│   │   ├── entities/          # Entity model, stats, tags
│   │   ├── effects/           # Primitives, StatusEffect, interaction rules (see EFFECTS.md)
│   │   ├── areas/             # Tile-region area effects, spread/decay sim
│   │   ├── items/             # ItemDefinition schema, inventory, validation
│   │   ├── combat/            # Damage resolution, death
│   │   └── crafting/          # Recipe matching; AI proposal validation (v0.5)
│   ├── game/                  # ── PHASER-FACING ──
│   │   ├── scenes/            # Boot, Dungeon, Base, UI overlay scenes
│   │   ├── render/            # Tilemap renderer, sprite sync, effect VFX
│   │   ├── input/             # Keyboard/mouse → engine intents
│   │   └── ui/                # Inventory, hotbar, crafting dialog, HUD
│   └── content/               # ── DATA, NOT CODE ──
│       ├── effects/*.json     # bleeding.json, on-fire.json, wet.json, ...
│       ├── items/*.json       # vodka-bottle.json, rag.json, knife.json, ...
│       ├── enemies/*.json
│       └── tilesets/          # Tileset metadata (which tiles are flammable, etc.)
├── server/                    # (v0.5+) AI proxy, later item registry
└── tests/                     # Vitest suites mirroring src/engine/
```

## Core runtime model

### Simulation loop

The engine runs a fixed-tick simulation (e.g. 10 ticks/sec for effects — DoT cadence doesn't need 60fps) driven by Phaser's update loop. Phaser handles per-frame movement/physics/rendering; the engine tick handles effect ticks, area spread, exposure timers. Engine state is authoritative; render objects mirror it via an event bus (`EffectApplied`, `AreaSpawned`, `EntityDied`…), which is also what makes headless tests trivial.

### Entities, stats, tags

An `Entity` is an id + stat block + **tag set** + active effects + (optional) inventory. Tags are the universal vocabulary that everything keys off:

- Material/state tags: `flammable`, `liquid`, `wet`, `metal`, `organic`, `sharp`
- Behavioral tags: `enemy`, `player`, `item`, `container`
- Effect-owned tags: being on fire adds `burning`; standing in water adds `wet`

Interaction rules (see [EFFECTS.md](EFFECTS.md)) are written against tags, never against specific items. That's why an AI-invented item slots in: if it says `tags: ["flammable", "liquid"]`, every existing rule about flammable liquids already applies to it.

### Data-driven content

Every effect, item, and enemy is a JSON file validated against a TypeScript schema (zod) at load time. Code interprets; data defines. The schemas are the contract shared by: hand-authored content, unit tests, and (in v0.5) the AI's structured output. One validator, three consumers.

### Dungeon generation

`generateDungeon(seed, depth, config) → DungeonMap` — a pure function. `DungeonMap` is a logical grid (floor/wall/door/void + spawn/exit/decoration markers + room metadata). The renderer maps it to tiles; the spawner populates it with enemies/items using the same seeded RNG. Determinism (same seed ⇒ same dungeon) is a tested invariant, and makes bug reports reproducible.

## Rendering & art pipeline

- 16×16 pixel tiles, rendered at 3–4× zoom with `pixelArt: true` (nearest-neighbor)
- Top-down view; Don't Starve-adjacent mood via palette and silhouette, not detail
- Placeholder art is programmatically generated colored tiles at first; real tilesets swap in behind the same tileset-metadata format
- Effect VFX (fire, poison bubbles, splashes) are small particle configs keyed by effect tags — an AI item tagged `fire` automatically gets fire VFX

## AI crafting (summary — full design in [AI_CRAFTING.md](AI_CRAFTING.md))

```
Crafting UI ──prompt+ingredients──▶ server/ proxy ──▶ AI API (structured output)
     ▲                                                        │
     │                                              ItemDefinition proposal
     │                                                        ▼
  accept/deny result ◀── engine/crafting validator (schema, primitives, budget)
```

The browser never holds API keys; the engine never trusts AI output — every proposal passes the same validator hand-authored content does, plus a balance-budget check.

## Testing strategy

- **Unit (majority):** effect primitives, interaction rules, stacking, dungeon connectivity/determinism, item validation — all headless engine code
- **Simulation tests:** scripted scenarios ("throw molotov on wet ground next to plant-monster") run for N ticks in Node, asserting outcomes
- **Manual/playtest:** Phaser layer, feel, performance

## Conventions

- Strict TS, no `any` in `engine/`
- `engine/` imports nothing from `game/` or `phaser` (enforced by lint rule)
- Content JSON is kebab-case ids (`vodka-bottle`), referenced by id everywhere
- Every new primitive or interaction rule lands with unit tests in the same PR
