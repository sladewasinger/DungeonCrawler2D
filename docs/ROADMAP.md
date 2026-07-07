# Roadmap — Epics, Goals, and Release Timeline

From empty repo to fully complete game. Dates assume part-time development starting **July 2026**; each release is a playable, shippable build. Epics are ordered by dependency — the effects engine (E3) and data-driven items (E4) must land before AI crafting (E8) is possible.

---

## Release overview

| Release | Name | Target | Theme |
| --- | --- | --- | --- |
| v0.1 | Walking Skeleton | **Aug 2026** | Phaser 3 + TS + Vite scaffold, procedural dungeon, walkable player |
| v0.2 | Living Engine | **Sep 2026** | Generic effects engine, items, inventory, throwables |
| v0.3 | Dangerous Dungeon | **Nov 2026** | Combat, enemies, area effects, effect interactions |
| v0.4 | Home Base | **Dec 2026** | Base scene, crafting table, recipe-based crafting |
| v0.5 | The Spark | **Feb 2027** | AI crafting — natural-language item creation, local persistence |
| v0.6 | Shared World | **Apr 2027** | Backend item registry — accepted items become craftable for all players |
| v0.7 | The Long Game | **Jun 2027** | Progression, difficulty scaling, save system, meta loop |
| v0.8 | Beta | **Aug 2027** | Content pass, art/audio polish, balancing, playtesting |
| v1.0 | Release | **Oct 2027** | Launch on web (itch.io + own domain), post-launch plan |

---

## Epic 0 — Foundation (v0.1)

**Goal:** A cleanly organized repo any developer can clone, run, and understand in under 10 minutes.

- [ ] Git repo, `.gitignore`, README, planning docs (this doc)
- [ ] Phaser 3 + TypeScript + Vite scaffold; strict TS config
- [ ] Folder structure per [ARCHITECTURE.md](ARCHITECTURE.md) — `engine/` (game-agnostic) vs `game/` (content) split
- [ ] Vitest wired up; engine logic testable headlessly (no Phaser dependency in core systems)
- [ ] Placeholder pixel-art tileset (16×16) generated/committed; asset pipeline documented

**Done when:** `npm run dev` shows a rendered scene; `npm test` passes in CI-able fashion.

## Epic 1 — Procedural Dungeon Generation (v0.1)

**Goal:** Every run generates a new, fully connected, seeded dungeon.

- [ ] Seeded RNG (reproducible dungeons from a seed string)
- [ ] Room-and-corridor generator (BSP or room-scatter + corridor carving), fully connected, no orphan rooms
- [ ] Logical grid model (`DungeonMap`: floor/wall/door/spawn/exit) decoupled from rendering
- [ ] Tilemap renderer mapping the logical grid to the pixel tileset
- [ ] Debug overlay: seed display, regenerate key, room outlines
- [ ] Unit tests: connectivity, bounds, determinism per seed

**Done when:** Pressing `R` regenerates a new connected dungeon; same seed ⇒ same dungeon.

## Epic 2 — Player & Core Loop (v0.1)

**Goal:** A controllable character exploring the dungeon.

- [ ] Top-down player movement (WASD/arrows), wall collision via Arcade Physics
- [ ] Camera follow with dungeon-bounds clamping
- [ ] Player stats block (health, speed) — the substrate effects will modify later
- [ ] Dungeon exit → generates next floor (depth counter)

**Done when:** You can walk a generated dungeon, descend floors, and it feels responsive.

## Epic 3 — Effects Engine (v0.2)

**Goal:** The generic, data-driven effect model in [EFFECTS.md](EFFECTS.md) — the heart of the game. No effect is hard-coded as a special case; "bleeding", "on fire", "poisoned", "regenerating" are all *data* composed from a small set of coded **primitives** (damage-over-time, stat modifier, spawn entity, ignite, spread, transform-on-exposure…).

- [ ] `EffectPrimitive` catalog (tick damage/heal, stat mod, movement mod, spread, transform, spawn)
- [ ] `StatusEffect` = data: primitives + duration + tick rate + stacking rule + tags
- [ ] Effect lifecycle: apply → tick → expire/refresh/stack; resistance & immunity hooks
- [ ] Tag-driven interaction rules (fire + wet ⇒ extinguish; fire + flammable ⇒ ignite; exposure timers: char, cook)
- [ ] Base status set as data files: bleeding, poisoned, on fire, wet, healing, slowed, burned/charred
- [ ] Headless unit tests for every primitive and interaction rule

**Done when:** A new status effect (e.g. "frozen") can be added purely as a data file with zero engine changes.

## Epic 4 — Items, Inventory & Throwables (v0.2)

**Goal:** Items are pure data referencing effect primitives — the format AI crafting will later emit.

- [ ] `ItemDefinition` JSON schema: identity, tags (flammable, liquid, sharp…), behaviors (consumable, throwable, equippable), effect payloads
- [ ] Inventory system: pickup, drop, stack, hotbar UI
- [ ] Throwable system: arc/projectile, impact resolution (apply effects, spawn area effect, break)
- [ ] Consumables (drink/eat/apply) wired to the effects engine
- [ ] Starter item set as data: vodka bottle, rag, bandage, knife, torch, water flask, raw meat
- [ ] Item definition validation (schema + referenced-primitive checks) — shared later by AI crafting

**Done when:** A thrown torch onto an oil-tagged item ignites it, using only data definitions.

## Epic 5 — Area Effects (v0.3)

**Goal:** The ground itself participates in the effect system.

- [ ] Tile-region area effect model: wet ground, fire, poison cloud, oil slick, smoke
- [ ] Spread/decay simulation (fire spreads to flammable tiles, consumes fuel, leaves char; clouds drift and dissipate)
- [ ] Entity ↔ area interaction: standing in fire applies "on fire"; wet ground applies "wet" and slows
- [ ] Area ↔ area interaction via the same tag rules (fire meets wet ⇒ steam/extinguish)
- [ ] Exposure timers: items left in fire char, then are destroyed; raw meat cooks

**Done when:** A molotov-like item (data only) creates spreading fire that interacts correctly with wet ground, entities, and dropped items.

## Epic 6 — Combat & Enemies (v0.3)

**Goal:** Something to use all these effects on.

- [ ] Enemy framework: data-defined enemies (stats, tags, drops, behavior params)
- [ ] Basic AI behaviors: wander, chase, melee, ranged (composable state machine)
- [ ] Melee + throwable combat for the player; damage types routed through effects engine
- [ ] Enemy status vulnerability via tags (a plant-monster is flammable; a slime is immune to bleed)
- [ ] Death, loot drops, floor population during generation
- [ ] 4–6 starter enemies as data files

**Done when:** Setting a plant-monster on fire kills it faster than a knife does, purely due to its tags.

## Epic 7 — Base & Crafting Table (v0.4)

**Goal:** The player's persistent home and the physical site of crafting.

- [ ] Base scene (small fixed map) with portal to/from dungeon runs
- [ ] Persistent stash (localStorage first; server-side in v0.6)
- [ ] Crafting table interactable + crafting UI (select ingredients from inventory)
- [ ] Recipe-based crafting for known items (the deterministic path; AI path comes next)
- [ ] Death penalty loop: die in dungeon ⇒ lose carried items, keep stash

**Done when:** The core loop holds: base → dungeon → loot → return → craft → repeat.

## Epic 8 — AI Crafting (v0.5) ⭐

**Goal:** The signature feature, per [AI_CRAFTING.md](AI_CRAFTING.md). Free-text prompt at the crafting table → AI composes a new `ItemDefinition` from existing primitives → engine validates → accept/deny → item exists.

- [ ] Crafting prompt UI (text input + selected ingredients)
- [ ] Server-side proxy for the AI API (never ship API keys to the browser) — minimal Node service
- [ ] Prompt engineering: system prompt encoding the primitive catalog, tag vocabulary, balance budget, and output JSON schema
- [ ] Structured output → `ItemDefinition` proposal; schema + semantic validation (only known primitives/tags, power budget vs. ingredient cost)
- [ ] Accept/deny pipeline with player-facing result ("The tinkerer refuses…" on deny); consume ingredients on accept
- [ ] Generated-item presentation: name, description, procedural/palette-swap sprite strategy
- [ ] Local persistence of accepted items; dedupe (same ingredients + similar intent ⇒ same item)
- [ ] Abuse guards: rate limiting, content moderation on names/descriptions, cost caps

**Done when:** "Combine rag + vodka bottle into a molotov cocktail" yields a working fire-bomb item that was never coded, and a nonsense request is cleanly denied.

## Epic 9 — Shared Item Registry (v0.6)

**Goal:** Accepted AI items become part of the world for every player.

- [ ] Backend service + database (item registry, user accounts or anonymous IDs)
- [ ] Accepted items published to registry; other players with matching ingredients can craft them (recipe discovery)
- [ ] Canonicalization: near-duplicate proposals resolve to the existing registry item
- [ ] Moderation/reporting flow and admin kill-switch for problem items
- [ ] Registry browser UI ("codex" of discovered items, credited to first crafter)

**Done when:** Player A invents an item; Player B sees it as a craftable recipe.

## Epic 10 — Progression & Meta (v0.7)

**Goal:** A reason to keep playing.

- [ ] Difficulty scaling by depth (enemy stats, density, dungeon size, new biome tilesets)
- [ ] Player progression (levels or unlock-based; kept simple)
- [ ] Save system: base upgrades, stash, codex, run-in-progress
- [ ] Dungeon variety: biomes with different tags (flooded floors, overgrown floors) that feed the effect system
- [ ] Boss floors every N depths

## Epic 11 — Content, Art & Audio Polish (v0.8)

**Goal:** From systems-demo to game.

- [ ] Final pixel-art pass: tilesets, character/enemy animations, item icons, effect VFX (fire, poison, splash)
- [ ] Audio: SFX for combat/effects/UI, ambient loops, music
- [ ] Juice: screen shake, hit flashes, particles, damage numbers
- [ ] Onboarding/tutorialization of the crafting hook
- [ ] Balancing pass driven by playtest feedback; closed beta

## Epic 12 — Launch (v1.0)

**Goal:** Shipped and sustainable.

- [ ] Production hosting (static frontend + backend), monitoring, error reporting
- [ ] AI API cost controls at scale (caching, registry-first lookups so repeat crafts never call the API)
- [ ] itch.io page + landing page, trailer/GIFs
- [ ] Launch; post-launch cadence plan (content drops = new base items/tags, which multiply AI-craftable space)

---

## Development principles

1. **Engine/content split.** `engine/` never imports from `game/`. Content is data; systems are code.
2. **Data-first.** If a feature can be a JSON/data file interpreted by a primitive, it must be. This is what makes Epic 8 possible — the AI writes data, never code.
3. **Headless-testable core.** Effects, items, dungeon gen, and interactions run without a renderer; Phaser is the view layer.
4. **Every release is playable.** No release ships as pure infrastructure.
5. **The AI is a composer, not a programmer.** It can only arrange primitives the engine already trusts, inside a validated budget. Deny is always a safe outcome.
