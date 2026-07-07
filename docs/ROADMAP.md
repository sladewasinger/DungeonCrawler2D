# Roadmap — Epics, Goals, and Release Timeline

From empty repo to fully complete game. Dates assume part-time development starting **July 2026**; each release is a playable, shippable build. This is a **real-time co-op multiplayer** game (PvE parties of 1–4), so multiplayer lands in the very first release — the earliest epics are basic graphics, world generation, and multiplayer support, in that order. Everything after builds on a server-authoritative simulation.

---

## Release overview

| Release | Name | Target | Theme |
| --- | --- | --- | --- |
| v0.1 | Walking Skeleton | **Sep 2026** | Scaffold, procedural dungeon, 2+ players walking the same dungeon in real time |
| v0.2 | Living Engine | **Nov 2026** | Server-authoritative effects engine, items, inventory, throwables |
| v0.3 | Dangerous Dungeon | **Jan 2027** | Combat, enemies, area effects, effect interactions |
| v0.4 | Home Base | **Mar 2027** | Base scene, crafting table, recipe-based crafting |
| v0.5 | The Spark | **May 2027** | AI crafting — natural-language item creation |
| v0.6 | Invention Economy | **Jun 2027** | Global item registry — accepted items craftable by all players |
| v0.7 | The Long Game | **Aug 2027** | Progression, difficulty scaling, server-side saves, meta loop |
| v0.8 | Beta | **Oct 2027** | Content pass, art/audio polish, balancing, playtesting |
| v1.0 | Release | **Dec 2027** | Launch on web (itch.io + own domain), post-launch plan |

(Launch moved Oct → Dec 2027 vs. the pre-multiplayer plan: the multiplayer core in v0.1–v0.2 is real work, and every later system is built server-authoritative from the start rather than retrofitted — cheaper overall, but slower up front.)

## Multiplayer model (assumptions to confirm)

- **Co-op PvE**, parties of 1–4, one party per dungeon run; solo play is just a party of one
- **Drop-in/drop-out**: players can join a friend's run in progress at the base or between floors
- **Server-authoritative**: the dungeon sim (movement validation, effects, combat, loot) runs on the game server; clients send intents and render state. Cheat-resistant by construction.
- **Personal bases, instanced**: each player has their own base; party members can visit. (Alternative — shared party base — is an open design question.)
- No PvP at launch (the effects system would make it fun later — friendly-fire molotovs — but it's out of scope through v1.0)

---

## Epic 0 — Foundation (v0.1)

**Goal:** A cleanly organized monorepo any developer can clone, run (client + server), and understand in under 10 minutes.

- [ ] Git repo, `.gitignore`, README, planning docs (this doc)
- [ ] npm workspaces monorepo: `packages/engine` (shared, pure), `packages/client` (Phaser 3 + Vite), `packages/game-server` (Node + ws), `packages/services` (Lambda handlers, v0.5+) — per [ARCHITECTURE.md](ARCHITECTURE.md)
- [ ] Strict TS everywhere; `engine` imports nothing from client or server
- [ ] Vitest wired up; engine logic testable headlessly
- [ ] `npm run dev` starts client + local game server together
- [ ] Placeholder pixel-art tileset (16×16) generated/committed; asset pipeline documented

**Done when:** One command runs the stack locally; `npm test` passes.

## Epic 1 — Procedural Dungeon Generation (v0.1)

**Goal:** Every run generates a new, fully connected dungeon — **deterministically from a seed**, because in multiplayer the server sends only `(seed, depth)` and every client generates the identical map locally.

- [ ] Seeded RNG (reproducible dungeons from a seed string)
- [ ] Room-and-corridor generator (BSP or room-scatter + corridor carving), fully connected, no orphan rooms
- [ ] Logical grid model (`DungeonMap`: floor/wall/door/spawn/exit) decoupled from rendering
- [ ] Tilemap renderer mapping the logical grid to the pixel tileset
- [ ] Debug overlay: seed display, regenerate key, room outlines
- [ ] Unit tests: connectivity, bounds, **byte-exact determinism per seed** (this is now a networking correctness requirement, not a nicety)

**Done when:** Same seed produces an identical dungeon on two different machines.

## Epic 2 — Multiplayer Core (v0.1) ⭐

**Goal:** The load-bearing epic. A server-authoritative session that 2+ players can join and walk around in together, feeling responsive.

- [ ] Game server process: runs the shared `engine` simulation at a fixed tick (~20 Hz), owns truth
- [ ] WebSocket protocol (JSON first, binary later if needed): client→server **intents** (move, use, drop…), server→client **snapshots/events** (entity deltas, effect events, spawns)
- [ ] Sessions/rooms: create, join by code/link, leave, host-independent (server owns the session, not a player)
- [ ] Player movement: client-side prediction for your own character, interpolation for others, server reconciliation
- [ ] Map sync via `(seed, depth)` only; entity spawns as events
- [ ] Join-in-progress: late joiner receives seed + full entity snapshot
- [ ] Disconnect handling: grace period, re-join, party continues
- [ ] Two headless-client + in-process-server simulation tests (no browser) for protocol correctness
- [ ] Terraform baseline + deployed playtest server (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md)) so remote friends can playtest

**Done when:** Two people on different networks explore the same generated dungeon together, movement feels responsive (<150 ms perceived), and a dropped client can rejoin.

## Epic 3 — Effects Engine (v0.2)

**Goal:** The generic, data-driven effect model in [EFFECTS.md](EFFECTS.md), running **authoritatively on the game server**. No effect is a special case; "bleeding", "on fire", "poisoned" are data composed from coded primitives. Because effects are server-side, all players see the same fire spread the same way — and nobody can cheat a debuff away.

- [ ] `EffectPrimitive` catalog (tick damage/heal, stat mod, movement mod, spread, transform, spawn)
- [ ] `StatusEffect` = data: primitives + duration + tick rate + stacking rule + tags
- [ ] Effect lifecycle on the server tick: apply → tick → expire/refresh/stack; resistance & immunity hooks
- [ ] Effect events broadcast to clients (`EffectApplied`, `EffectExpired`, `EntityTransformed`) — clients render, never simulate outcomes
- [ ] Tag-driven interaction rules (fire + wet ⇒ extinguish; fire + flammable ⇒ ignite; exposure timers: char, cook)
- [ ] Base status set as data files: bleeding, poisoned, on fire, wet, healing, slowed, burned/charred
- [ ] Headless unit tests for every primitive and interaction rule

**Done when:** A new status effect (e.g. "frozen") can be added purely as a data file, and all party members observe identical outcomes.

## Epic 4 — Items, Inventory & Throwables (v0.2)

**Goal:** Items are pure data referencing effect primitives — the format AI crafting will later emit. Server-authoritative inventory (no item-duplication cheats).

- [ ] `ItemDefinition` JSON schema: identity, tags (flammable, liquid, sharp…), behaviors (consumable, throwable, equippable), effect payloads
- [ ] Server-side inventory: pickup, drop, stack, trade-by-drop between party members; hotbar UI client-side
- [ ] Throwable system: intent → server simulates arc + impact (apply effects, spawn area effect, break) → clients render projectile
- [ ] Consumables (drink/eat/apply) wired to the effects engine
- [ ] Starter item set as data: vodka bottle, rag, bandage, knife, torch, water flask, raw meat
- [ ] Item definition validation (schema + referenced-primitive checks) — shared later by AI crafting

**Done when:** Player A throws a torch, player B sees the same arc, and the oil it lands on ignites for everyone.

## Epic 5 — Area Effects (v0.3)

**Goal:** The ground itself participates in the effect system, simulated once on the server.

- [ ] Tile-region area effect model: wet ground, fire, poison cloud, oil slick, smoke
- [ ] Spread/decay simulation on the server tick (fire spreads to flammable tiles, consumes fuel, leaves char; clouds drift and dissipate); area state deltas broadcast
- [ ] Entity ↔ area interaction: standing in fire applies "on fire"; wet ground applies "wet" and slows
- [ ] Area ↔ area interaction via the same tag rules (fire meets wet ⇒ steam/extinguish)
- [ ] Exposure timers: items left in fire char, then are destroyed; raw meat cooks

**Done when:** A molotov-like item (data only) creates spreading fire that all party members see identically, interacting correctly with wet ground, entities, and dropped items.

## Epic 6 — Combat & Enemies (v0.3)

**Goal:** Something to use all these effects on — together.

- [ ] Enemy framework: data-defined enemies (stats, tags, drops, behavior params), AI runs on the server
- [ ] Basic AI behaviors: wander, chase (nearest/aggro-table target across the party), melee, ranged
- [ ] Melee + throwable combat; damage types routed through effects engine; hit registration server-side with lag compensation kept simple (generous hitboxes over rewind)
- [ ] Enemy status vulnerability via tags (a plant-monster is flammable; a slime is immune to bleed)
- [ ] Death & downed state: downed players can be revived by party members; solo death ends the run
- [ ] Loot drops (per-player or shared — start shared, it's simpler and co-op-friendly), floor population during generation
- [ ] Difficulty scales with party size (enemy count/HP)
- [ ] 4–6 starter enemies as data files

**Done when:** A party of two kites a plant-monster into their own fire wall and it dies faster than to knives, on both screens.

## Epic 7 — Base & Crafting Table (v0.4)

**Goal:** The player's persistent home and the physical site of crafting.

- [ ] Personal base scene (small fixed map), instanced per player; party members can visit
- [ ] Party flow: form party at base or via invite → portal into a shared dungeon run → return to base
- [ ] Persistent stash, server-side per account (anonymous id first, real accounts in v0.7)
- [ ] Crafting table interactable + crafting UI (select ingredients from inventory)
- [ ] Recipe-based crafting for known items (the deterministic path; AI path comes next)
- [ ] Death penalty loop: party wipe ⇒ lose carried items, keep stash

**Done when:** The core loop holds for a duo: base → party up → dungeon → loot → return → craft → repeat.

## Epic 8 — AI Crafting (v0.5) ⭐

**Goal:** The signature feature, per [AI_CRAFTING.md](AI_CRAFTING.md). Free-text prompt at the crafting table → AI composes a new `ItemDefinition` from existing primitives → validation → accept/deny → the item exists — for your whole party, immediately.

- [ ] Crafting prompt UI (text input + selected ingredients)
- [ ] Crafting service Lambda (`POST /craft`) — not latency-sensitive, stays serverless; AI key in SSM (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md))
- [ ] Prompt engineering: system prompt encoding the primitive catalog, tag vocabulary, balance budget, and output JSON schema
- [ ] Structured output → `ItemDefinition` proposal; schema + semantic validation (only known primitives/tags, power budget vs. ingredient cost)
- [ ] Accept/deny pipeline with player-facing result ("The tinkerer refuses…" on deny); consume ingredients on accept
- [ ] Accepted definition pushed to the player's game session — the game server loads it like any content file and broadcasts it, so party members can immediately be hit by (or borrow) the new invention
- [ ] Generated-item presentation: name, description, procedural/palette-swap sprite strategy
- [ ] Dedupe (same ingredients + similar intent ⇒ same item)
- [ ] Abuse guards: rate limiting, content moderation on names/descriptions, cost caps

**Done when:** "Combine rag + vodka bottle into a molotov cocktail" yields a working fire-bomb that your party member can watch you throw, and a nonsense request is cleanly denied.

## Epic 9 — Shared Item Registry (v0.6)

**Goal:** Accepted AI items become part of the world for every player, not just your party.

- [ ] Registry in DynamoDB + Lambda routes; CloudFront-cached registry reads
- [ ] Accepted items published to registry; other players with matching ingredients can craft them (recipe discovery)
- [ ] Canonicalization: near-duplicate proposals resolve to the existing registry item
- [ ] Game servers pull registry definitions on demand (with local cache) so any session can instantiate any registered item
- [ ] Moderation/reporting flow and admin kill-switch for problem items
- [ ] Registry browser UI ("codex" of discovered items, credited to first crafter)

**Done when:** Player A invents an item; player C — a stranger — discovers and crafts it the next day.

## Epic 10 — Progression & Meta (v0.7)

**Goal:** A reason to keep playing together.

- [ ] Accounts (lightweight: email or OAuth) replacing anonymous ids; stash/codex/progression server-side
- [ ] Difficulty scaling by depth and party size (enemy stats, density, dungeon size, new biome tilesets)
- [ ] Player progression (levels or unlock-based; kept simple)
- [ ] Dungeon variety: biomes with different tags (flooded floors, overgrown floors) that feed the effect system
- [ ] Boss floors every N depths — designed for party mechanics
- [ ] Friends/recent-players list; invite links

## Epic 11 — Content, Art & Audio Polish (v0.8)

**Goal:** From systems-demo to game.

- [ ] Final pixel-art pass: tilesets, character/enemy animations (+ per-player color variants), item icons, effect VFX
- [ ] Audio: SFX for combat/effects/UI, ambient loops, music
- [ ] Juice: screen shake, hit flashes, particles, damage numbers
- [ ] Netcode polish pass: interpolation tuning, packet-loss resilience, spectate-while-dead
- [ ] Onboarding/tutorialization of the crafting hook; solo play must feel complete too
- [ ] Balancing pass driven by playtest feedback; closed beta with concurrent-load test

## Epic 12 — Launch (v1.0)

**Goal:** Shipped and sustainable.

- [ ] Production hardening: monitoring, error reporting, alarms; game-server capacity plan (scale-out path in [INFRASTRUCTURE.md](INFRASTRUCTURE.md))
- [ ] AI API cost controls at scale (caching, registry-first lookups so repeat crafts never call the API)
- [ ] itch.io page + landing page, trailer/GIFs (co-op clips are the marketing)
- [ ] Launch; post-launch cadence plan (content drops = new base items/tags, which multiply AI-craftable space)

---

## Development principles

1. **Server-authoritative from day one.** The dungeon sim runs on the game server; clients send intents and render. Every system after v0.1 is built on this — nothing gets "multiplayer added later."
2. **Engine/content split.** `engine` is pure, shared by server and client, and never imports from either. Content is data; systems are code.
3. **Determinism is a network feature.** Seeded generation means maps ship as a seed, not tiles. Tested, byte-exact.
4. **Data-first.** If a feature can be a JSON/data file interpreted by a primitive, it must be. This is what makes Epic 8 possible — the AI writes data, never code.
5. **Every release is playable — with a friend.** Playtest every release as a duo minimum.
6. **The AI is a composer, not a programmer.** It can only arrange primitives the engine already trusts, inside a validated budget. Deny is always a safe outcome.
