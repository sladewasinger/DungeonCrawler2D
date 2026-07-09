# Roadmap — Epics, Goals, and Release Timeline

From empty repo to fully complete game. Dates assume part-time development starting **July 2026**; each release is a playable, shippable build. This is a **real-time PvPvE multiplayer** game set in a vast dungeon of stacked, isolated floor-worlds with a **continuous height axis** (cliffs, chasms, cloud cities, flight, fall damage) — players spawn apart, can fight or befriend anyone they meet, safety exists only in safe rooms, and reaching the stairway down is the objective. The player-facing design lives in [GAME_DESIGN.md](GAME_DESIGN.md); this doc sequences the work. Earliest epics: basic graphics, world generation, multiplayer support.

---

## Release overview

| Release | Name | Target | Theme |
| --- | --- | --- | --- |
| v0.1 | Walking Skeleton | **Sep 2026** | Scaffold, vast heightmapped world gen, players spawning apart and finding each other in real time |
| v0.2 | Living Engine | **Nov 2026** | Server-authoritative effects engine, items, inventory, throwables |
| v0.3 | Dangerous Dungeon | **Jan 2027** | Combat — PvE and PvP — area effects, sanctuary enforcement |
| v0.4 | Safe Haven | **Mar 2027** | Safe rooms that stretch: personal & party rooms, party system, recipe crafting |
| v0.5 | Social Fabric | **Apr 2027** | Fistbump → DMs, global chat, mute/block everything, HUD widget foundation |
| v0.6 | The Spark | **Jun 2027** | AI crafting — natural-language item creation |
| v0.7 | Invention Economy | **Jul 2027** | Global item registry — accepted items craftable by all players |
| v0.8 | The Long Game | **Sep 2027** | Floor lifecycle & descent, accounts, progression, editable HUD |
| v0.9 | Beta | **Nov 2027** | Content pass, art/audio polish, balancing, load testing |
| v1.0 | Release | **Jan 2028** | Launch on web (itch.io + own domain), moderation, post-launch plan |

(Launch moved to Jan 2028: PvPvE + vast shared world + social systems are genuinely more game than instanced co-op runs. Worth it — this design has an identity.)

> **Progress note (2026-07-07):** Epics 0–7 are implemented and tested (76 tests: unit + multi-client sim integration + live-browser Playwright) — far ahead of the dates above. Remaining v0.1–v0.4 stragglers: the deployed playtest server (waiting on the hosting decision) and the deferred items marked below.

---

## Epic 0 — Foundation (v0.1)

**Goal:** A cleanly organized monorepo any developer can clone, run (client + server), and understand in under 10 minutes.

- [x] Git repo, `.gitignore`, README, planning docs (this doc)
- [x] npm workspaces monorepo: `packages/engine` (shared, pure), `packages/client` (Phaser 3 + Vite), `packages/game-server` (Node + ws) — per [ARCHITECTURE.md](ARCHITECTURE.md); `packages/services` (Lambda handlers) arrives in v0.6
- [x] Strict TS everywhere; `engine` imports nothing from client or server
- [x] Vitest wired up; engine logic testable headlessly
- [x] `npm run dev` starts client + local game server together
- [x] Art pipeline: `tools/generate-art.mjs` (`npm run art`) bakes committed PNG spritesheets + `atlas.json` frame indices — see the pixel-art item in Epic 1; hand-drawn art later replaces the generator output behind the same atlas contract

**Done when:** One command runs the stack locally; `npm test` passes.

## Epic 1 — Vast World Generation (v0.1)

**Goal:** Floors big enough to get lost in, generated lazily in deterministic chunks — because the server ships coordinates and seeds, never tiles.

- [x] Seeded RNG; chunk geometry deterministic from `(worldSeed, floor, chunkCoord)` — byte-exact across machines (a networking correctness requirement), all integer-hash based
- [x] Chunked generator: noise caves + a corridor network between jittered chunk centers (the global connectivity guarantee); interior wall-enclosed pockets sealed
- [x] **Layout first, height second** (reworked 2026-07-08): the base dungeon generates FLAT — cave-noise walls + the corridor network + features, all at height 0 — so the layout can be judged as a dungeon on its own. The per-tile height field stays in the data model (entities live at `(x, y, z)`, physics unchanged), but height is only ever *added by deliberate features*: wall tops (+2 jumpable platforms), ruin platform clusters, the authored proving ground. No noise heightfield — a height change exists because something was built there, never because a contour crossed a hallway (a generate.test invariant now enforces the flat base)
- [x] Fixed features placed deterministically per floor: **safe-room entrance kiosks** (portal doors every 3×3 chunks; the rooms behind them arrive in v0.4) and inert stairway markers (functional in v0.8); biome regions come with floor identity (v0.8)
- [x] Logical grid model (chunks: tiles + height + zone tags like `sanctuary`) decoupled from rendering
- [x] Client-side chunk streaming: generate/render chunks entering view, cull chunks leaving
- [x] **Pixel art** (64×64, real committed binaries): terrain sourced from the Cainos "Pixel Art Top Down — Basic" pack in `assets/topdown/` (the same pack Tile Studio authors with — one look everywhere), composed into our spritesheets by `npm run art` — rough stone-ground floors, cap-and-brick wall grammar, weathered cliff faces, teal-slab sanctuary, procedural stair treads + ledge-rim overlays + hooded crawler sprites (gold self / blue peers); rendered via tilemap layers with per-tile elevation tint (Craftpix in `assets/pack/` remains only for the stash chest)
- [x] Debug overlay: seed/pos/chunk/ping/fps display, chunk-border toggle
- [x] **Dev harness** (2026-07-09): server-side debug intents — god mode (full heal + no knockback every tick) and teleport — gated on the game server's `debugCommands` option (on for local dev and the e2e server, hard-off under `NODE_ENV=production`; deploy checklist must also set `DEBUG_COMMANDS=0`). Chat commands `/god` and `/tp X Y` in the dev client; `conn.debugGod()`/`conn.debugTeleport()` for scripted verification. This is how features get verified: fixed seed, teleport to the feature, assert — never blind-walking a live world ([sim.test](../packages/game-server/src/sim.test.ts) covers the off-by-default gate; the e2e suite teleports to a raised section and climbs it with real keys)
- [x] **Raised sections** (`engine/world/terraces.ts`, 2026-07-09): the first "height second" district feature — ~1 in 4 eligible chunks raises a room-sized rect (+2) anchored on its corridor junction, hard ledges all around, with railed staircase entries carved only where the hallways cross the boundary; cliff faces render on the section's own south-edge row (feet stop at the visible base) and the top border reads via new north rims (4-bit rim masks)
- [x] **Tile Studio** (`npm run studio`, [tools/tile-studio/](../tools/tile-studio/README.md)): auto-split tile palette with logic tagging and rectangle multi-select, freeform example painting, adjacency-rule learning, and a backtracking constraint solver that completes borders around seeded regions; **two art layers** (2026-07-09) — the solver owns the ground layer, a top layer paints objects/walls over it (exported as `art2`, rendered by the game on its own tilemap layer) so ground shows beneath authored borders/structures; exports `dc2d-map` JSON that both server and client stamp over generation (`custommap.ts`) — drop an export at `packages/client/public/assets/custom-map.json` and walk through your own room in-game. Authoring sheet is the Cainos top-down pack composed per [TILESET.md](TILESET.md)
- [x] **Legible verticality** (2026-07 playtest pass): elevation tint spans the whole height range (higher = brighter/warmer, depths darker/cooler), real TX Struct staircase tiles (N-S + rotated E-W) with run-edge railings ready for authored/feature stairs, and +2/+4 rises get brick cliff faces — every height change reads at a glance ([docs/art-samples/](art-samples/))
- [x] **Walls occlude honestly** (2026-07-08): a wall renders as real floor + a brick face in the lower half of its own cell + a top **cap on a layer shifted half a tile north, drawn above entities** — so walking up from the south you stop at the visible base, and standing north of a wall you're half-hidden behind its body (sprite depth bumps above the cap when you're actually on a wall top)
- [x] **Ruin platform clusters** (`engine/world/platforms.ts`, ~1 in 4 chunks): flattened pads holding 3–5 mesas that rise in jumpable +2 tiers (centerpiece +4), anchored off the corridor junction so connectivity never breaks; the server spawns loot on the tops — see the platform, make the jump, take the prize
- [x] **Walls are terrain** (2026-07-08): a wall tile is the local ground raised +2 — height (not a solidity flag) blocks walking into it, and the top is a walkable platform: jump on, walk the ridge, fall off; enemies can't jump, so high ground is a real tactic; projectiles clear walls only if their arc does; stretch-room perimeters rise +6 (unjumpable) so instanced rooms stay sealed; rendered floor-under/wall-top-over with south faces from the shared cliff-face overlay ([walls.test.ts](../packages/engine/src/world/walls.test.ts) drives the real physics over generated chunks)
- [x] Unit tests: cross-chunk connectivity (BFS with the walk rule), byte-exact determinism, seam continuity, safe-room entrance invariants, platform tier jumpability + corridor clearance

**Done when:** Two machines given the same seed render identical geometry (heights included) at any coordinate, and a player can walk for minutes without hitting an edge or a seam — past cliffs and chasms with legible elevation.

## Epic 1.5 — Code Organization (retrofit, 2026-07)

**Goal:** Package boundaries stayed clean through Epics 0–7, but individual files didn't — `sim.ts` reached 1,400 lines. Split every oversized module along its domain seams and make the standard explicit in [ARCHITECTURE.md](ARCHITECTURE.md) § Code organization so it can't drift again.

- [x] **game-server:** `sim.ts` god-class → `src/sim/` — shared `SimState` (state.ts) + one module per concern (players, actions, inventory, social, enemies, projectiles, statuses, deaths, spawn, snapshots, testzone) behind a `GameSim` facade whose `step()` reads as the tick order; public API unchanged (server.ts and all 22 sim tests untouched in behavior)
- [x] **client net:** `connection.ts` → transport/intents (connection.ts), movement prediction (prediction.ts), server-truth application (apply.ts), entity interpolation (interpolate.ts), browser identity (identity.ts)
- [x] **client scene:** 650-line `DungeonScene` → frame orchestration only, with `render/` (TerrainRenderer, EntityRenderer, AreaRenderer + shared constants), `input/controller.ts` (keyboard/mouse → intents), and `ui/` (Panels state, contextual prompts, proximity queries)
- [x] **engine worldgen:** `generate.ts` → terrain sampling (terrain.ts), fixed features (features.ts), reachability sealing (pockets.ts), thin `generateChunk` orchestrator
- [x] **Standard documented:** ~300-line soft cap, facade-folder pattern, state-in-one-place, seam-driven splits — ARCHITECTURE.md § Code organization + Conventions
- [x] Behavior-preserving: full vitest suite (87) and Playwright e2e (8) green, `npm run typecheck` clean

**Done when:** No source file needs scrolling to understand its job, every file is ≤ ~300 lines, and a new contributor can find any mechanic from the folder listing alone.

## Epic 2 — Multiplayer Core (v0.1) ⭐

**Goal:** The load-bearing epic. A server-authoritative shared world that many players occupy at once, spawning apart on a vast floor and stumbling onto each other.

- [x] Game server process: runs the shared `engine` simulation at a fixed 20 Hz tick, owns truth (per-chunk hibernation becomes meaningful when chunks gain state — effects/enemies in v0.2/v0.3)
- [x] WebSocket protocol (JSON, zod-validated server-side): client→server **intents**, server→client **snapshots** — speedhack-shaped input is rejected at the schema
- [x] **Area-of-interest replication:** each client receives only entities within its view radius, with enter/leave notices — mandatory on a vast map, and it's also what makes "stumbling upon someone" a moment
- [x] Random spawn placement guaranteeing distance from other players (candidates sampled on the corridor network, so spawns are never in isolated pockets) — no spawn shield; distance is the protection
- [x] Player movement: client-side prediction through the same engine `stepBody` the server runs, snapshot reconciliation with input replay, ~120 ms interpolation for others
- [x] **z from day one:** entities are `(x, y, z)` in the protocol; server-side gravity, jumping, and falling (fall *damage* arrives with the effects engine in v0.2)
- [x] Shadow-blob rendering: shadow anchors ground position, sprite offsets by z
- [x] Join/leave/reconnect: connect → spawn; 30 s disconnect grace; resume token restores identity and position
- [x] Headless multi-client + in-process-server simulation tests for protocol, AOI, reconnect, and multi-client convergence
- [x] **Dev proving ground** (engine `testzone.ts`, stamped over chunks (0,0)–(1,1), spawns prefer it — remove before v0.9): terraced hill to a h5 summit, stair ramp to four h3 jump pillars over 2/3/4-tile gaps, a jump-climb drop tower with h2/4/6/8 bands, a chasm with an exit ramp, and a safe-room entrance kiosk — plus per-epic example fixtures (see Epics 3–7)
- [x] **Camera & motion polish:** fixed-timestep render interpolation of the predicted body plus an eased camera follow (snaps on teleports) — no more 20 Hz stepping jitter
- [ ] Terraform baseline + deployed playtest server (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md)) — **deferred until the hosting account is decided**; meanwhile local dev mimics prod topology (standalone game-server process + static client over the real protocol)

**Done when:** Three people on different networks spawn apart on one vast floor, wander, jump off ledges, and find each other — movement feels responsive (<150 ms perceived), and a dropped client rejoins where they left.

## Epic 3 — Effects Engine (v0.2)

**Goal:** The generic, data-driven effect model in [EFFECTS.md](EFFECTS.md), running **authoritatively on the game server**. No effect is a special case; "bleeding", "on fire", "poisoned" are data composed from coded primitives. Server-side effects mean every nearby player sees the same fire spread — and nobody can cheat a debuff away.

- [x] `EffectPrimitive` catalog: modify_health, modify_stat, apply/remove_status, spawn_area, destroy_entity (spread/transform live in the area system)
- [x] `StatusEffect` = data: primitives + duration + tick rate + stacking rule + tags (`@dc2d/content`, zod-validated with cross-reference checks — the same validator AI crafting will use)
- [x] Effect lifecycle on the server tick: apply → tick → expire/refresh/stack; immunity (slime can't bleed) and damage-scale (flammable plants burn ×2) hooks
- [x] **Zone tags:** `sanctuary` suppresses damage, debuffs, and hostile areas — server-enforced
- [x] Effect events broadcast within AOI (hp deltas, status on/off, deaths) — clients render, never simulate outcomes
- [x] Tag-driven interaction rules to a bounded fixpoint (fire + wet ⇒ both extinguish); fire ignites the flammable via area contact
- [x] **Verticality as data:** fall damage scaled by drop height (liquids break falls), feather-fall negates, sticky-feet grips against knockback, `airborne` derived tag
- [x] Base status set as data: bleeding, poisoned, on-fire, wet, healing, regenerating, bandaged, slowed, feather-fall, sticky-feet
- [x] Headless unit tests for primitives, lifecycle, rules, immunity, sanctuary, and scaling
- [x] **In-game examples (proving ground):** standing fire and poison patches near spawn apply on-fire/poisoned on contact; a ground bandage cures bleeding; raw meat gambles poison — every base status is triggerable in play

**Done when:** A new status effect (e.g. "frozen") can be added purely as a data file, and all observers see identical outcomes.

## Epic 4 — Items, Inventory & Throwables (v0.2)

**Goal:** Items are pure data referencing effect primitives — the format AI crafting will later emit. Server-authoritative inventory (no duplication cheats — this matters double in PvP, where items are stakes).

- [x] `ItemDefinition` JSON schema: identity, tags (flammable, liquid, sharp…), behaviors (consumable, throwable, weapon), effect payloads
- [x] **Server-side inventory, reworked 2026-07-09**: UNLIMITED inventory (one stack per item def — no capacity games), a 9-slot **hotbar of bindings** (a slot references an item def; using it consumes from the stack, and the binding survives an empty stack), and a **character equipment slot** — weapons equip there and melee swings use the equipped weapon, never a hotbar slot (armor joins later). First pickup of a usable auto-binds it and the first weapon auto-equips, so what you grab is immediately usable. Drops visible to anyone in AOI (loot is contested by design). Protocol v5
- [x] **Hotbar & input UX**: number keys 1–9 (and clicking a slot) **USE** a bound consumable; selecting a throwable arms it, draws its mouse-aimed ballistic path, and the next world click throws it. **[I] opens the inventory panel** (DOM overlay like chat, pending HUD-widget conversion with the v0.8 editor): search, filter tabs (All/Weapons/Usables/Materials), click-an-item-press-1–9 to bind, Equip/Unequip, Drop; range-gated craft/stash panels close for real when you walk away; melee swings render a visible arc, hit or miss
- [x] Throwable system: intent → server ballistic arc + impact (direct hits, effect primitives at the tile, break chance) → observers render the projectile
- [x] Consumables wired to the effects engine (bandage strips bleeding; raw meat gambles poison)
- [x] Starter item set as data: vodka bottle, rag, stick, bandage, knife, torch, water flask, raw meat
- [x] Item definition validation (schema + referenced-primitive checks) — shared later by AI crafting
- [x] **In-game examples (proving ground):** a weapon rack on the ground at spawn — rusty sword, heavy hammer, knife — plus throwables (torch, vodka bottle, water flask), consumables (bandage, raw meat), and crafting ingredients (rags, stick); walk on, [R] to pick up, hotbar to use ([e2e-tested](../tests/e2e/game.spec.ts))

**Done when:** Player A throws a torch, a passing stranger sees the same arc, and the oil it lands on ignites for everyone.

## Epic 5 — Area Effects (v0.3)

**Goal:** The ground itself participates in the effect system, simulated once on the server.

- [x] Tile-region area effect model: wet ground, fire, poison cloud, oil slick, smoke, steam
- [x] Spread/decay simulation on the server tick: fire spreads only along flammable fuel (oil lines) and consumes it; clouds dissipate; deltas broadcast within AOI (charred-tile visuals deferred to the v0.9 art pass)
- [x] Entity ↔ area interaction: standing in fire ignites you; wet ground applies "wet" and slows; oil slows
- [x] Area ↔ area interaction: fire meets wet ⇒ steam; fire meets oil ⇒ ignition
- [x] **Height-aware propagation:** heavy gas and liquids never spread uphill, smoke never spreads downhill; ground areas can't touch airborne entities
- [x] **Sanctuary boundary:** hostile areas cannot enter or be placed inside `sanctuary` zones — fire dies at the safe-room threshold
- [x] Exposure timers: items left in fire char and are destroyed (raw-meat → cooked transform deferred with the food system)
- [x] **In-game examples (proving ground):** permanent fire, poison, oil, and wet patches near spawn (reseeded by the sim as they decay) — walk into them, throw the water flask at the fire for steam, torch the oil slick

**Done when:** A molotov-like item (data only) creates spreading fire that every observer sees identically — and that stops dead at a safe-room door.

## Epic 6 — Combat: PvE & PvP (v0.3)

**Goal:** Something to use all these effects on — monsters, and each other.

- [x] Enemy framework: data-defined enemies (stats, tags, drops, attack params); AI runs server-side, frozen when no player is near
- [x] Basic AI behaviors: wander, chase nearest visible player (sanctuary-blind — kiting a horde onto a stranger is legal and hilarious), melee strike, ranged spit
- [x] Melee + throwable combat; damage routed through the effects engine with source tags; hit registration server-side (generous hitboxes over rewind); swings gate on a 350 ms server-enforced cooldown (client mirrors it, so the arc never lies — spam-clicking is not the meta)
- [x] Knockback interacts with ledges — fall damage is a weapon, in PvE and PvP alike (sticky-feet grips)
- [x] **PvP rules per [GAME_DESIGN.md](GAME_DESIGN.md):** everyone can damage everyone — friendly fire is always on, even in parties; `sanctuary` suppresses everything
- [x] **Melee targeting aid:** swings resolve against the best target in the arc, hostiles preferred over party members; an arc with no hostile hits whoever's there; AoE/throwables/areas hit everyone, always
- [x] Enemy status vulnerability via tags (plant-creeper burns ×2; slime immune to bleed; skeleton immune to bleed and poison)
- [x] Death: **full loot drop** where you fell (anyone may loot — including your killer), respawn at random distant location, keep stash; downed-then-revive for party members with a 30 s bleed-out
- [x] 4 starter enemies as data files: slime, plant-creeper, skeleton, spitter (pixel-art three-frame motion sprites)
- [x] **In-game examples (proving ground):** all four enemy kinds placed as fixtures — a slime pit south of spawn (the e2e combat arena), a creeper and a fast skeleton to the west, a poison spitter on the hill; sword/hammer pickups make the damage difference feelable

**Done when:** Two strangers can fight over a loot drop with molotovs and knives — or ignore each other — and a plant-monster kited into their crossfire burns either way.

## Epic 7 — Safe Rooms & Parties (v0.4)

**Goal:** Sanctuary, the stretch-room system, and consent-based grouping.

- [x] Safe-room sanctuary rules live: no damage, no debuffs, no hostile areas, enemies can't enter
- [x] **Safe rooms are door portals** (GAME_DESIGN.md § Safe rooms): the overworld shows an entrance kiosk whose door teleports you into the region's instanced safe room — sanctuary interior with communal stash, crafting table, and the stretch-room doors; same door → same room for everyone
- [x] **Stretch rooms:** personal door in every safe room → your instanced personal room (stash + crafting table + exit door); implemented as a reserved chunk band of deterministic sub-maps, entry by server teleport, rooms spaced beyond AOI
- [x] **Party rooms:** party door → shared common room, with a personal door inside (shared geometry, per-player destination — that's the stretch trick)
- [x] **Exit doors unwind like a stack:** floor → safe room → personal room and back out the way you came (e2e-tested with a real browser walking the whole loop)
- [x] Party system: invite/accept via proximity (mutual consent, [F] fistbump flow), leave/disband, party chat channel, member position pings outside AOI (friendly fire stays on — no flag)
- [x] Persistent stash, server-side per anonymous clientId (file-backed store; DynamoDB + accounts land in v0.8)
- [x] Crafting table interactable + crafting panel UI
- [x] Recipe-based crafting for known items (bandage, torch — the deterministic path; AI path comes in v0.6)

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
- [ ] **Descent goes live:** stairways become functional one-way shard handoffs to the next floor (floors run forever and stairs are open — the timed **Seasons** lifecycle is post-v1.0, below)
- [ ] Floor identity & difficulty scaling: enemy stats/density per floor, biome tilesets feeding the tag system — flooded floors, overgrown floors (sky set pieces like the floating castle: post-v1.0)
- [ ] Player progression (levels or unlock-based; kept simple)
- [ ] Boss chambers on deeper floors — designed so strangers have a reason to temporarily ally
- [ ] **Editable HUD editor:** drag/resize/toggle/reset over the v0.5 widget foundation; layouts sync to account

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

### Post-v1.0 (recorded now, designed later)

- **Seasons:** parallel game instances run as timed seasons — floor 1 open ~1 week, floor 2 ~9 days, subsequent floors ~2 weeks, stairways sealed until late in each window; joins close when a season's floor 1 ends, newcomers start a fresh season/world (GAME_DESIGN.md § Resolved decisions)
- **Sky set pieces:** the floating castle — reachable by rope, flight, teleportation, maybe a vehicle; the height model already supports it

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
