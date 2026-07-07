# Roadmap — Epics, Goals, and Release Timeline

From empty repo to fully complete game. Dates assume part-time development starting **July 2026**; each release is a playable, shippable build. This is a **real-time PvPvE multiplayer** game set in a vast shared dungeon — players spawn apart, can fight or befriend anyone they meet, and safety exists only in safe rooms. The player-facing design (world structure, PvP rules, safe/stretch rooms, social systems, editable HUD) lives in [GAME_DESIGN.md](GAME_DESIGN.md); this doc sequences the work. Earliest epics: basic graphics, world generation, multiplayer support.

---

## Release overview

| Release | Name | Target | Theme |
| --- | --- | --- | --- |
| v0.1 | Walking Skeleton | **Sep 2026** | Scaffold, vast chunked world gen, players spawning apart and finding each other in real time |
| v0.2 | Living Engine | **Nov 2026** | Server-authoritative effects engine, items, inventory, throwables |
| v0.3 | Dangerous Dungeon | **Jan 2027** | Combat — PvE and PvP — area effects, sanctuary enforcement |
| v0.4 | Safe Haven | **Mar 2027** | Safe rooms that stretch: personal & party rooms, party system, recipe crafting |
| v0.5 | Social Fabric | **Apr 2027** | Fistbump → DMs, global chat, mute/block everything, HUD widget foundation |
| v0.6 | The Spark | **Jun 2027** | AI crafting — natural-language item creation |
| v0.7 | Invention Economy | **Jul 2027** | Global item registry — accepted items craftable by all players |
| v0.8 | The Long Game | **Sep 2027** | Progression, accounts, descent/depth scaling, editable HUD |
| v0.9 | Beta | **Nov 2027** | Content pass, art/audio polish, balancing, load testing |
| v1.0 | Release | **Jan 2028** | Launch on web (itch.io + own domain), moderation, post-launch plan |

(Launch moved to Jan 2028: PvPvE + vast shared world + social systems are genuinely more game than instanced co-op runs. Worth it — this design has an identity.)

---

## Epic 0 — Foundation (v0.1)

**Goal:** A cleanly organized monorepo any developer can clone, run (client + server), and understand in under 10 minutes.

- [ ] Git repo, `.gitignore`, README, planning docs (this doc)
- [ ] npm workspaces monorepo: `packages/engine` (shared, pure), `packages/client` (Phaser 3 + Vite), `packages/game-server` (Node + ws), `packages/services` (Lambda handlers, v0.6+) — per [ARCHITECTURE.md](ARCHITECTURE.md)
- [ ] Strict TS everywhere; `engine` imports nothing from client or server
- [ ] Vitest wired up; engine logic testable headlessly
- [ ] `npm run dev` starts client + local game server together
- [ ] Placeholder pixel-art tileset (16×16) generated/committed; asset pipeline documented

**Done when:** One command runs the stack locally; `npm test` passes.

## Epic 1 — Vast World Generation (v0.1)

**Goal:** Floors big enough to get lost in, generated lazily in deterministic chunks — because the server ships coordinates and seeds, never tiles.

- [ ] Seeded RNG; chunk geometry deterministic from `(worldSeed, floor, chunkCoord)` — byte-exact across machines (a networking correctness requirement)
- [ ] Chunked generator producing connected caves/rooms/corridors across chunk boundaries, no orphan regions
- [ ] Fixed features placed deterministically per floor: **safe rooms** (with door slots for stretch rooms), stairways down, biome regions
- [ ] Logical grid model (`DungeonMap` chunks: floor/wall/door/spawn/exit + zone tags like `sanctuary`) decoupled from rendering
- [ ] Client-side chunk streaming: generate/render chunks entering view, drop chunks leaving
- [ ] Debug overlay: seed/chunk display, teleport, chunk borders
- [ ] Unit tests: cross-chunk connectivity, determinism, safe-room placement invariants

**Done when:** Two machines given the same seed render identical geometry at any coordinate, and a player can walk for minutes without hitting an edge or a seam.

## Epic 2 — Multiplayer Core (v0.1) ⭐

**Goal:** The load-bearing epic. A server-authoritative shared world that many players occupy at once, spawning apart on a vast floor and stumbling onto each other.

- [ ] Game server process: runs the shared `engine` simulation at a fixed tick (~20 Hz), owns truth; simulates only **active chunks** (near players), hibernates the rest with persisted deltas
- [ ] WebSocket protocol (JSON first): client→server **intents** (move, use, drop…), server→client **snapshots/events**
- [ ] **Area-of-interest replication:** each client receives deltas only for entities within its view radius — mandatory on a vast map, and it's also what makes "stumbling upon someone" a moment
- [ ] Random spawn placement (away from players/enemy clusters) + spawn protection flag
- [ ] Player movement: client-side prediction for your own character, interpolation for others, server reconciliation
- [ ] Join/leave/reconnect: connect → spawn; disconnect grace period; rejoin restores position and inventory
- [ ] Headless multi-client + in-process-server simulation tests for protocol and AOI correctness
- [ ] Terraform baseline + deployed playtest server (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md)) so remote friends can playtest

**Done when:** Three people on different networks spawn apart on one vast floor, wander, and find each other — movement feels responsive (<150 ms perceived), and a dropped client rejoins where they left.

## Epic 3 — Effects Engine (v0.2)

**Goal:** The generic, data-driven effect model in [EFFECTS.md](EFFECTS.md), running **authoritatively on the game server**. No effect is a special case; "bleeding", "on fire", "poisoned" are data composed from coded primitives. Server-side effects mean every nearby player sees the same fire spread — and nobody can cheat a debuff away.

- [ ] `EffectPrimitive` catalog (tick damage/heal, stat mod, movement mod, spread, transform, spawn)
- [ ] `StatusEffect` = data: primitives + duration + tick rate + stacking rule + tags
- [ ] Effect lifecycle on the server tick: apply → tick → expire/refresh/stack; resistance & immunity hooks
- [ ] **Zone tags:** effects respect map zones — the `sanctuary` tag suppresses hostile primitives (groundwork for safe rooms in v0.3/v0.4)
- [ ] Effect events broadcast within AOI (`EffectApplied`, `EffectExpired`, `EntityTransformed`) — clients render, never simulate outcomes
- [ ] Tag-driven interaction rules (fire + wet ⇒ extinguish; fire + flammable ⇒ ignite; exposure timers: char, cook)
- [ ] Base status set as data files: bleeding, poisoned, on fire, wet, healing, slowed, burned/charred
- [ ] Headless unit tests for every primitive and interaction rule

**Done when:** A new status effect (e.g. "frozen") can be added purely as a data file, and all observers see identical outcomes.

## Epic 4 — Items, Inventory & Throwables (v0.2)

**Goal:** Items are pure data referencing effect primitives — the format AI crafting will later emit. Server-authoritative inventory (no duplication cheats — this matters double in PvP, where items are stakes).

- [ ] `ItemDefinition` JSON schema: identity, tags (flammable, liquid, sharp…), behaviors (consumable, throwable, equippable), effect payloads
- [ ] Server-side inventory: pickup, drop, stack; drops visible to anyone in AOI (loot is contested by design); hotbar UI client-side
- [ ] Throwable system: intent → server simulates arc + impact (apply effects, spawn area effect, break) → observers render projectile
- [ ] Consumables (drink/eat/apply) wired to the effects engine
- [ ] Starter item set as data: vodka bottle, rag, bandage, knife, torch, water flask, raw meat
- [ ] Item definition validation (schema + referenced-primitive checks) — shared later by AI crafting

**Done when:** Player A throws a torch, a passing stranger sees the same arc, and the oil it lands on ignites for everyone.

## Epic 5 — Area Effects (v0.3)

**Goal:** The ground itself participates in the effect system, simulated once on the server.

- [ ] Tile-region area effect model: wet ground, fire, poison cloud, oil slick, smoke
- [ ] Spread/decay simulation on the server tick (fire spreads to flammable tiles, consumes fuel, leaves char; clouds drift and dissipate); deltas broadcast within AOI; hibernating chunks pause their areas
- [ ] Entity ↔ area interaction: standing in fire applies "on fire"; wet ground applies "wet" and slows
- [ ] Area ↔ area interaction via the same tag rules (fire meets wet ⇒ steam/extinguish)
- [ ] **Sanctuary boundary:** hostile areas cannot enter or be placed inside `sanctuary` zones — fire dies at the safe-room threshold
- [ ] Exposure timers: items left in fire char, then are destroyed; raw meat cooks

**Done when:** A molotov-like item (data only) creates spreading fire that every observer sees identically — and that stops dead at a safe-room door.

## Epic 6 — Combat: PvE & PvP (v0.3)

**Goal:** Something to use all these effects on — monsters, and each other.

- [ ] Enemy framework: data-defined enemies (stats, tags, drops, behavior params), AI runs on the server (active chunks only)
- [ ] Basic AI behaviors: wander, chase (aggro table across nearby players — kiting a horde onto a stranger is legal and hilarious), melee, ranged
- [ ] Melee + throwable combat; damage types routed through effects engine; hit registration server-side (generous hitboxes over rewind)
- [ ] **PvP rules per [GAME_DESIGN.md](GAME_DESIGN.md):** unaffiliated players damage each other; party members don't (toggle, default off); `sanctuary` suppresses everything; spawn protection until expiry or aggression
- [ ] Enemy status vulnerability via tags (a plant-monster is flammable; a slime is immune to bleed)
- [ ] Death: drop carried items where you fell (anyone may loot — including your killer), respawn at random location, keep stash; downed-then-revive state for party members
- [ ] 4–6 starter enemies as data files

**Done when:** Two strangers can fight over a loot drop with molotovs and knives — or ignore each other — and a plant-monster kited into their crossfire burns either way.

## Epic 7 — Safe Rooms & Parties (v0.4)

**Goal:** Sanctuary, the stretch-room system, and consent-based grouping.

- [ ] Safe-room sanctuary rules live (zone tag from Epics 3/5 + PvP rules from Epic 6, now with real rooms)
- [ ] **Stretch rooms:** personal door in every safe room → your instanced personal room (stash + crafting table); implementation: portal-attached instanced sub-maps, not floor geometry
- [ ] **Party rooms:** party door → shared common room with individual member rooms off it
- [ ] Party system: invite/accept (mutual consent), leave/disband, party chat channel plumbing, friendly-fire flag, member position pings outside AOI
- [ ] Persistent stash, server-side per player (anonymous id first, accounts in v0.8)
- [ ] Crafting table interactable + crafting UI (select ingredients from inventory)
- [ ] Recipe-based crafting for known items (the deterministic path; AI path comes in v0.6)

**Done when:** Two strangers meet in a safe room, party up, enter their new party room together, then each retreat through their own personal door to craft in private.

## Epic 8 — Social Fabric (v0.5)

**Goal:** The systems in [GAME_DESIGN.md](GAME_DESIGN.md) § Social fabric: meeting people is the game's magic moment, so the plumbing around it must be consent-first.

- [ ] **Fistbump:** proximity emote handshake (both within window) → mutual contacts → DMs + quick party invite unlocked
- [ ] Chat channels: global, party, DM, proximity — multiplexed over the existing websocket, one chat widget with tabs
- [ ] Mute/block, server-enforced: mute channel, mute player, block player (kills DMs, fistbumps, invites); DM policy (contacts-only/everyone/nobody); profanity filter toggle; persisted per player
- [ ] Rate limiting on all chat (the cheapest griefing surface)
- [ ] **HUD widget foundation:** all HUD elements (health, hotbar, buffs, chat, party frames) refactored/built as layout-config widgets per GAME_DESIGN.md — the editable-HUD groundwork, editor ships v0.8
- [ ] Contact list UI; online status (toggleable, of course)

**Done when:** Two strangers meet, fistbump, DM each other from opposite ends of the floor — and a third player who muted global chat and blocked one of them never hears from either.

## Epic 9 — AI Crafting (v0.6) ⭐

**Goal:** The signature feature, per [AI_CRAFTING.md](AI_CRAFTING.md). Free-text prompt at your personal-room crafting table → AI composes a new `ItemDefinition` from existing primitives → validation → accept/deny → the item exists, and the dungeon just got more dangerous for everyone.

- [ ] Crafting prompt UI (text input + selected ingredients)
- [ ] Crafting service Lambda (`POST /craft`) — not latency-sensitive, stays serverless; AI key in SSM (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md))
- [ ] Prompt engineering: system prompt encoding the primitive catalog, tag vocabulary, balance budget, and output JSON schema
- [ ] Structured output → `ItemDefinition` proposal; schema + semantic validation (only known primitives/tags, power budget vs. ingredient cost)
- [ ] Accept/deny pipeline with player-facing result ("The tinkerer refuses…" on deny); consume ingredients on accept
- [ ] Accepted definition pushed to the game server — loaded like any content file and usable immediately; anyone in your AOI can watch (and suffer) the debut
- [ ] Generated-item presentation: name, description, procedural/palette-swap sprite strategy
- [ ] Dedupe (same ingredients + similar intent ⇒ same item)
- [ ] Abuse guards: rate limiting, content moderation on names/descriptions, cost caps — **balance validation matters double in PvP**, since every AI item is also a weapon against players

**Done when:** "Combine rag + vodka bottle into a molotov cocktail" yields a working fire-bomb you can throw at a monster — or a stranger — and a nonsense request is cleanly denied.

## Epic 10 — Shared Item Registry (v0.7)

**Goal:** Accepted AI items become part of the world for every player.

- [ ] Registry in DynamoDB + Lambda routes; CloudFront-cached registry reads
- [ ] Accepted items published to registry; other players with matching ingredients can craft them (recipe discovery)
- [ ] Canonicalization: near-duplicate proposals resolve to the existing registry item
- [ ] Game servers pull registry definitions on demand (with local cache) so any shard can instantiate any registered item
- [ ] Moderation/reporting flow and admin kill-switch for problem items
- [ ] Registry browser UI ("codex" of discovered items, credited to first crafter)

**Done when:** Player A invents an item; a stranger on another shard discovers, crafts, and gets killed by it the next day.

## Epic 11 — Progression & Meta (v0.8)

**Goal:** A reason to keep descending.

- [ ] Accounts (lightweight: email or OAuth) replacing anonymous ids; stash/codex/contacts/settings server-side
- [ ] Descent: stairways down, difficulty scaling by depth (enemy stats, density, new biome tilesets feeding the tag system — flooded floors, overgrown floors)
- [ ] Player progression (levels or unlock-based; kept simple)
- [ ] Boss chambers on deeper floors — designed so strangers have a reason to temporarily ally
- [ ] **Editable HUD editor:** drag/resize/toggle/reset over the v0.5 widget foundation; layouts sync to account
- [ ] Floor lifecycle: hibernation/persistence policy, and the world-reset decision from GAME_DESIGN.md open questions

## Epic 12 — Content, Art & Audio Polish (v0.9)

**Goal:** From systems-demo to game.

- [ ] Final pixel-art pass: tilesets, character/enemy animations (+ per-player color variants), item icons, effect VFX
- [ ] Audio: SFX for combat/effects/UI, ambient loops, music; distinct audio cue when another player enters your AOI (the *someone's here* shiver)
- [ ] Juice: screen shake, hit flashes, particles, damage numbers
- [ ] Netcode polish: interpolation tuning, packet-loss resilience, AOI radius tuning, shard load testing
- [ ] Onboarding: teach sanctuary, fistbump, and "you can be hurt out here" fast; solo play must feel complete
- [ ] Balancing pass driven by playtest feedback; closed beta

## Epic 13 — Launch (v1.0)

**Goal:** Shipped and sustainable.

- [ ] Production hardening: monitoring, error reporting, alarms; shard capacity plan (scale-out path in [INFRASTRUCTURE.md](INFRASTRUCTURE.md))
- [ ] **Moderation for launch:** report flow for chat + item names, automated filtering, admin tools — a PvPvE game with global chat cannot launch without this
- [ ] AI API cost controls at scale (caching, registry-first lookups so repeat crafts never call the API)
- [ ] itch.io page + landing page, trailer/GIFs (fistbump-then-betrayal clips will market themselves)
- [ ] Launch; post-launch cadence plan (content drops = new base items/tags, which multiply AI-craftable space)

---

## Development principles

1. **Server-authoritative from day one.** The world sim runs on the game server; clients send intents and render. In a PvPvE game the client is an adversary, not just untrusted.
2. **Consent is the social contract.** Parties, fistbumps, DMs — every social connection is mutual opt-in, and everything is mutable/blockable. PvP is the one non-consensual system, and sanctuary + spawn protection bound it.
3. **Engine/content split.** `engine` is pure, shared by server and client, and never imports from either. Content is data; systems are code.
4. **Determinism is a network feature.** Geometry ships as seeds and chunk coords, never tiles. Tested, byte-exact.
5. **Data-first.** If a feature can be a JSON/data file interpreted by a primitive, it must be — even safe rooms are just a zone tag the effects engine respects. This is what makes AI crafting possible.
6. **HUD is widgets.** No fixed-position UI, ever — every element is a layout-config widget from its first commit (GAME_DESIGN.md § Editable HUD).
7. **Every release is playable — with strangers.** Playtest every release with at least three people who don't coordinate beforehand.
8. **The AI is a composer, not a programmer.** It can only arrange primitives the engine already trusts, inside a validated budget. Deny is always a safe outcome.
