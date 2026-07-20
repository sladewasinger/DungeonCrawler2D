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

> **Progress note (2026-07-10):** Epics 0–7.6 are implemented and tested (131 unit/integration tests + 16 live-browser scenarios) — far ahead of the dates above. Remaining v0.1–v0.4 stragglers: the deployed playtest server (waiting on the hosting decision) and the deferred items marked below.

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
- [x] **Walls are raised terrain with projected facades** (2026-07-08, facade contract completed 2026-07-19): a wall tile is the local ground raised +2 and its top is a walkable platform: jump on, walk the ridge, fall off. The angled view projects its south face into the lower floor cell, where a derived `wallFaceAt` span stops grounded movement, pathing, and low projectiles at the visible base without falsifying that cell's surface height. High jumps and projectile arcs can clear the top; explicit door tiles remain openings. Stretch-room perimeters rise +6 (unjumpable) so instanced rooms stay sealed. Engine regressions cover generated walls, facade movement/ejection, and projectile clearance.
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

## Epic 7.5 — Enemy & Particle Refinement (complete 2026-07-10)

**Goal:** Make combat readable at a glance. Enemy motion must communicate its intent, and particles must originate from the action that created them rather than being baked into a static sprite.

- [x] Animation-state contract: enemies can replicate `idle`, `walk`, `windup`, `spit`, and `recover` states independently of positional movement
- [x] **Spitter foundation:** distinct idle, walk, wind-up, open-mouth release, and recovery frames; the delayed ranged attack drives those states server-side
- [x] **Spitter launch readability:** the release frame contains no baked projectile; a short muzzle particle starts at the open mouth while the authoritative projectile begins its flight
- [x] Live visual verification of the spitter wind-up, release, recovery, and projectile handoff
- [x] Give slime, plant-creeper, and skeleton their own intent-readable idle, walk, attack, and recovery animation sets (`enemySprites.ts` state contract; server attack/recovery snapshots; centered alpha-frame sets)
- [x] Standardize reusable launch, impact, hit, death, and status particles with clear source positions, layering, and lifetimes (`CombatParticles`)
- [x] Review combat scenes at normal play speed for visual timing, projectile origin, and readability under multiple simultaneous entities

**Done when:** Every starter enemy has separate locomotion and attack intent, and every combat particle visibly originates from the actor, projectile, or area that caused it.

## Epic 7.6 — Core Game Feel & Verticality Polish (complete 2026-07-10)

**Goal:** Make the current build feel coherent before adding more systems. The character should read as an animated person instead of a rotating token, vertical traversal should be forgiving and visually honest, and every entity should occupy the world at a deliberate scale and depth.

**Original audit findings (2026-07-10, resolved below):** The player had one static frame and the whole image rotated toward movement/aim; enemies were forced into one `58×58` display box even though their visible bounds differed; entities used fixed depth values except for a wall-tile special case; ordinary platform faces and stair objects always rendered below entities; and the +2 jump was physically possible but had only a small clearance margin, with no chained-platform regression covering a second rise hidden behind a taller foreground platform.

- [x] **Player character and animation pass:** replace whole-sprite rotation with directional, feet-anchored `idle`, `walk`, `jump`, `fall`, `land`, `attack`, and `downed` presentation; keep held weapons, shadows, nameplates, status tints, and the occlusion silhouette attached correctly in every state
- [x] **Sprite scale and anchor contract:** define visual bounds, feet origin, shadow size, health/name offsets, and world-space footprint separately; tune each enemy archetype against the player and tiles (starter enemies should be modestly smaller than today) instead of forcing every enemy into the same display box
- [x] **Unified draw ordering:** derive entity ordering from the screen-space feet position and elevation, split terrain into below-entity and occluding layers, and make walls, ordinary cliff/platform faces, stair bodies/rails, entities, held items, projectiles, particles, bars, labels, and the self-ghost agree about what is in front
- [x] **Stair and fall polish:** audit every stair orientation and long ramp at 20 Hz and normal play speed; remove visual popping/bobbing at ramp boundaries; keep the shadow grounded during jumps/falls; add clear takeoff, falling, landing, and damaging-impact feedback without changing authoritative outcomes
- [x] **Chained-platform traversal fix:** reproduce and fix the failed jump onto a second +2 platform behind/above a taller foreground platform; make valid h0→h2→h4 routes reliable from all four cardinal approaches and diagonals without allowing rises above the jump apex or bypassing collision
- [x] **Traversal forgiveness:** tune jump buffering/coyote time, ledge clearance, landing tolerance, and collision sampling so intended platform jumps do not require sub-tick timing; preserve deterministic client prediction and server reconciliation
- [x] **Normal-speed combat readability pass:** fold in Epic 7.5's remaining multi-entity review; tune enemy animation cadence, facing, projectile origin, attack tells, particle density, and overlap behavior after the new scale/depth rules land
- [x] **Polish regression harness:** add focused engine tests for chained rises, corner/diagonal approaches, stepping off and landing, and too-tall rejection; add client tests for animation/scale/depth contracts plus live-browser scenarios and screenshots for stairs, stacked platforms, falling, wall/platform occlusion, and crowded combat
- [x] **Whole-build feel sweep:** play through the dungeon, traversal sandbox, combat fixtures, doors, pickups, throwables, death/revive, and safe rooms at normal speed; record and resolve any remaining high-salience camera, input-feedback, clipping, or visual-consistency issues found during the sweep

**Done when:** The player never tips sideways as a rotated static sprite; every starter enemy is consistently scaled and readable; stairs, falls, and chained +2 platform climbs work reliably from every intended approach; occlusion is correct around walls, platforms, and stairs; and deterministic unit plus live-browser regression coverage protects those behaviors.

## Epic 7.7 — Playtest Lifecycle, Character & Safe-Room Rework

**Goal:** Correct the highest-friction playtest issues before expanding the feature set, then replace the temporary character and room flows with production-quality foundations.

- [x] **Session menu:** add an always-available in-game menu with Resume, confirmed Kill Crawler, and Exit to Mode Select so players can move between the dungeon and traversal sandbox without reloading
- [x] **Death lockout:** dead players cannot move, jump, attack, use items, interact, chat, or mutate inventory/party state; client prediction stops immediately and enemies ignore dead, downed, and disconnected players until respawn/reconnect
- [x] **Held-input continuity:** keyboard enable/disable transitions are idempotent so server snapshots never clear held WASD state or introduce movement stutter
- [ ] **Crawler art rebuild:** replace the current faceless-hood views with one cohesive, more detailed crawler spritesheet covering idle, walk, and attack in four visual directions (north/south/east/west). Simulation and input remain 8-way; diagonal movement resolves to a stable dominant-axis facing so it never rapidly flips between animation sets.
- [x] **Enemy scale correction:** tune every starter enemy to approximately crawler size; current live enemies are only slightly too small, so preserve their relative silhouettes rather than making a dramatic scale jump (2026-07-19: user confirmed current scaling is right — no change needed)
- [x] **Run input:** hold Shift to run, with server-authoritative speed, deterministic prediction, animation cadence, stamina/balance decision, and keyboard help text updated together
- [ ] **Snappier jump ascent:** increase upward acceleration/initial velocity feel without changing the accepted falling speed, then rerun the chained-platform and client reconciliation regressions
- [ ] **Safe-room hierarchy correction:** the shared lobby has no stash or crafting table; solo players see only their personal-room door and no party door; party members see only their party door in the lobby; the party room contains one door per member leading to that member's private stash room plus one shared crafting table
- [ ] **Conditional room replication:** generate and reveal personal/party doors from authoritative membership and room ownership so clients never see or enter an inapplicable door; update return-stack behavior and multiplayer room tests
- [ ] **Inventory window (Phase 1 of the Crawler OS HUD — [docs/HUD_OS.md](HUD_OS.md)):** the immediate next client feature, decoupled from the rest of this epic's character/room rework — a proper `WidgetRegistry` window replacing the DOM `InventoryPanel` overlay, opened on [i]/[Tab]: v1's All/Weapons/Usables/Materials filter tabs, atlas-sprite item rows with qty, click-to-bind to a hotbar slot, equip/unequip, drop; search stays deferred. The state and intents it needs already exist on `Connection` (`inventory`, `hotbar`, `weapon`, `assignSlot`/`equip`/`drop`) — this phase is UI only, spec'd concretely enough to build with no other brief
- [ ] **Walls are solid, period (user-decreed 2026-07-19, supersedes "wall tops are walkable platforms"):** TILE.Wall blocks absolutely — visual height stays, collision height is figuratively infinite; nothing jumps over a wall or into the black void it bounds. High-ground tactics live exclusively on raised floor terraces. Engine isWalkable + movement + affected tests; kills the void-jumping bug class outright
- [x] **Readable UI font:** current pixel font at 2x reads blurry/over-pixelated (user report) — switch HUD text to a clearer face (monogram may remain for flavor headers); update VISUAL_DIRECTION's pixel-font rule accordingly. Ping/FPS/coords become bare floating numbers, no panel chip behind them (2026-07-19: A/B'd monogram-larger vs system-sans; system sans won decisively — `ui/font.ts`'s `uiTextStyle`, monogram kept for the title screen only)
- [ ] **Wall vertical-extent rule (generator, user-decreed 2026-07-19 — see VISUAL_DIRECTION.md):** every raised surface of height z must span ≥ z+1 tiles north-to-south (z face rows + ≥1 walkable top row; width unbounded). Acceptance fixture: docs/examples/user-kiosk-terrace-example.json (the user's hand-painted kiosk/pit/terrace map — load via the editor's import button). Hard worldgen invariant with a multi-seed test asserting no malformed shallow walls; requires re-tuning wall/ridge/dais/landmark placement depths. Companion fixes in the same pass: safe-room kiosks become z2 terraces (not rock masses) with the door carried in the face and the top platform intact; doors render as the standalone leaf over ordinary wall rows (no frame-post half-walls, no masonry recolor, no suppression gap); pit rims draw ONE outline (surrounding ground's), never doubled by interior face side-closures

**Done when:** A playtester can safely switch modes or intentionally die, dead players are inert and untargetable, diagonal crawler motion reads cleanly in every direction, running and jumping feel intentional, the safe-room doors and facilities exactly match solo or party membership, and the inventory window is live.

> **Deploy-wave sequencing (2026-07-19):** Epics 7.8–7.12 below ship as independent production deploys, per the standing auto-deploy rule — each wave builds, ships, and goes live before the next starts. **Wave 1** is already queued and is not one of the epics below: it's the four still-unchecked Epic 7.7 bullets above — the inventory window, walls-solid collision, the wall vertical-extent generator rule (with its kiosk/door/pit companion fixes), and the readable UI font (with chipless ping/FPS/coord indicators). New waves: **wave 2** = Epic 7.8. **wave 3** = Epics 7.9 and 7.10 together, in the same deploy, because 7.9's DM denial message depends on 7.10's contact store existing. **wave 4** = Epic 7.11. **wave 5** = Epic 7.12. Every open call below is a logged default in [ASSUMPTIONS.md](ASSUMPTIONS.md) — nothing here is final, it's what ships absent a correction.

## Epic 7.8 — Starting Kit & Throwable Torches (deploy wave 2)

**Goal:** New crawlers start armed and lit, and torches stop being one-shot throwables — a landed torch becomes a real, server-authoritative light source using the baked-lighting BFS flood already proven for world-gen torches and doors ([tileLight.ts](../packages/client/src/render/terrain/tileLight.ts): level 14 at the source, minus one per orthogonal step, stopped by walls — "ZERO per-frame lighting cost" by design), not a cheap decorative overlay.

- [x] **Starter kit:** every new crawler spawns with a full stack of 3 torches in inventory (`torch`'s existing `maxStack: 3`) and the Rusty Sword (`sword` item def) auto-equipped to the character weapon slot (ASSUMPTIONS.md #1) — the same "first weapon auto-equips" rule Epic 4 already applies on pickup, just applied at spawn too; granted exactly once per persistent `clientId`, never re-granted on death/respawn or reconnect (#2), and the stash stays untouched (#3)
- [x] **Throwable torch, new impact behavior:** the ballistic arc (Epic 4) is unchanged, but `onImpact` no longer breaks the torch into a `spawn_area(area-fire)` puddle — that retires the item's current `breakChance: 1` v1-ported behavior for torches specifically (molotov-style fire-on-impact stays available via the vodka bottle) (#4). `ItemDefinition`'s `throwable` schema grows a data-first field so a landing can place a persistent world entity instead of running impact primitives — not a torch-only code special case, per the engine/content split (#5)
- [x] **In-flight glow:** an additive light rides the flight path through the lighting system's existing accent-light path (`LightingSystem.setAccentLights`, [lighting/index.ts](../packages/client/src/render/lighting/index.ts)) — the same per-frame mechanism area VFX already use, no new light channel
- [x] **On landing, real baked light:** the placed-torch entity triggers a one-time BFS rebake of its chunk (+ apron) through `computeLightField`, the same deterministic flood scanned once at chunk build for authored torches/doors — this epic makes that bake dynamic per placed entity for the first time, while keeping the "zero per-frame cost" property intact (#10); pickup and burnout trigger the mirror-image rebake so the tile darkens again. While planted, the torch is light-only — no `on-fire`/ignite-flammable hazard tag, diverging from its unchanged flammable melee-hit behavior (#6)
- [x] **Burn timer:** 180s lifetime + despawn + rebake-out shipped (ASSUMPTIONS #40/#42); the fading-ember tell moved to the remaining list below (#7)
- [ ] **Pickup:** interacting with a still-burning or spent placed torch restores exactly one inventory torch, no partial-durability tracking (#8); a per-floor cap on concurrently placed torches (#9) bounds worst-case rebake cost against spam-placement
- [ ] Fading-ember visual tell in a placed torch's last ~15s (#7, deferred from the wave-2 build)
- [ ] Re-verify multi-torch FPS on real hardware and recapture `wave2-torch-multi.png` fronted — the committed proof reads 24fps from Chromium background-tab throttling while fronted tabs read 95-144fps (wave-2 audit minor)
- [ ] Starter-kit grant durability: the exactly-once guarantee rides PlayerStore's 2s debounced disk write; a hard crash within ~2s of a brand-new player's first join re-grants the kit on next join — flush synchronously on first-join grant (wave-2 audit minor, store.ts scheduleSave)
- [ ] Atlas icons for bandage/rag/torch/raw-meat/stick — inventory rows currently show letter-fallback chips for items with no atlas sprite (wave-1 note)
- [x] Server-authoritative placement and expiry, replicated to every AOI client exactly like any other entity — no client can plant, extend, or hide a torch unilaterally
- [x] Engine/server tests: idempotent starter-kit grant across reconnect/respawn, placement/expiry/pickup lifecycle, cap enforcement; client tests for the flight-glow accent light and the placement/pickup/burnout rebake triggers

**Done when:** A new crawler spawns holding a sword and three torches, throws one into a dark corridor, and everyone in AOI watches it land and light the room for real — then watches it gutter out three minutes later, or gets there first and picks it back up.

## Epic 7.9 — Slash Commands, Global Chat & DMs (deploy wave 3)

**Goal:** Chat grows from `party`/`local` ([client.ts](../packages/engine/src/net/client.ts)'s current `clientChatSchema` channel enum) into a real multi-channel surface with a client-side command parser on the chat line — the first slice of GAME_DESIGN.md § Social fabric's chat model and Epic 8's chat-channel bullet, pulled forward.

- [x] Chat-line command parser: `/help`, `/dm <name> <msg>` (alias `/whisper`), `/r` (reply to last DM thread), `/who` (nearby count + online count), plus the existing dev `/god`/`/tp` staying exactly as dev-gated as today (Epic 1's `debugCommands` server option) — unrecognized `/`-prefixed input returns an "unknown command" system message rather than being sent as chat text (#19)
- [x] **Protocol extension:** `clientChatSchema`'s channel enum grows from `["party", "local"]` to include `global` and `dm`; bumps `PROTOCOL_VERSION` past its current `10` ([constants.ts](../packages/engine/src/core/constants.ts)) (#11)
- [x] **Global is truly global, immediately:** per GAME_DESIGN.md § Resolved decisions #7 ("global chat is truly global"), fans out to every connected socket with no unlock and no level gate (#14) — scoped for now to every socket on the current game-server process, i.e. both the `dungeon` and `sandbox` sims `server.ts` already runs (#13), and further scoped so `dungeon` and `sandbox` don't bleed into each other's global/`, /who` counts (#12); real cross-floor fan-out (INFRASTRUCTURE.md's future pub/sub hop) waits on Epic 11's multi-floor shard infrastructure, since only one floor runs per instance today
- [x] **DMs require mutual contacts:** gated on Epic 7.10's fistbump contact list, with a clear denial message otherwise (#15); name targeting for `/dm`/`/whisper`/`/r` is case-insensitive exact match, with an ambiguity error on multiple online matches (#17); `/r` follows the most recent DM thread in either direction (#18)
- [x] **Rate limiting — SHIPPED STRICTER THAN SPEC'D, needs Austin's confirmation:** one flat 5 messages/rolling-10s cap across ALL channels (and /who), instead of the 5-global/10-local+party split written here (ASSUMPTIONS #46). Strictly tighter, so no abuse surface; loosening back to the split is a two-constant change in game-server/src/sim/contacts.ts if preferred (#16)
- [x] **Chat widget grows tabs:** the existing `chat` HUD window ([chatPanel.ts](../packages/client/src/ui/widgets/hud/chatPanel.ts)) adds `global` and `dm` tabs alongside its current channels, phase-1-level implementation per HUD_OS.md § 5 (hand-built tab strip, not yet the shared `tabBar.ts` lift that HUD_OS.md schedules for its own Phase 3)
- [x] Server + protocol tests for command parsing, channel fan-out scoping, DM gating/denial, rate limiting, and name-ambiguity resolution

**Done when:** A player types `/who`, sees who's nearby and how many are online, DMs a contact with `/dm`, gets a clean denial DMing a stranger, and a flood of `/g` spam gets throttled without touching anyone's ability to talk in local or party chat.

## Epic 7.10 — Fistbump Contacts (deploy wave 3, same deploy as 7.9)

**Goal:** The hold-to-fistbump gesture from GAME_DESIGN.md § Social fabric and Epic 8's first bullet, pulled forward on its own — contacts only, never a party. ("This gesture never creates or joins a party" — Epic 8 — so explicit party management stays there.)

- [x] **Hold-F contact gesture:** holding F keeps the crawler's arm extended (movement still available); mutual proximity contact while both players hold the pose creates a mutual contact. Today's F key is a *tap* to invite/accept a party (`input/index.ts`'s `bindKeys`) — this epic layers hold-vs-tap so a quick tap keeps that existing party flow working unchanged, and only a sustained hold (assumed 400ms) triggers the new fistbump gesture (#20); otherwise this epic would silently remove the only way to party up until Epic 8's explicit party menu exists. Contact range is assumed at 1.5 tiles — genuine physical contact, tighter than the existing 6-tile `INVITE_RANGE_TILES` party-invite proximity gate in [social.ts](../packages/game-server/src/sim/social.ts) (#21)
- [x] **Contact store:** persists per `clientId` in the server store, file-backed the same way the stash already is (`PlayerStore`), surviving restarts (#22); no cap on list size, matching the unlimited-inventory philosophy elsewhere (#23)
- [x] **Contact list window:** a defaults-off HUD-OS window (registered `defaultVisible: false` in the `WidgetRegistry`, browsable from the edit-HUD catalog once Phase 2 lands, openable directly before then) — display name resolves live for online contacts, falls back to last-known name for offline ones (#23)
- [x] Contacts unlock DMs (Epic 7.9); the contacts window's per-row DM button prefills `/dm <name> ` in the chat input — true in-line autocomplete over the contact list deferred to Epic 8's chat polish
- [ ] Recapture wave-3 visual proofs: wave3-dm-flow.png was never persisted and wave3-fistbump-hold.png shows an item-pickup prompt instead of the radial hold ring (~400ms window vs dark art direction) — capture both on real hardware (wave-3 audit minor)
- [ ] Chat input rough edge: Enter-to-send can occasionally leave/reopen an empty input box (suspected capture-vs-bubble interaction between ChatInputBox's Enter listener and Phaser's global ENTER binding, both pre-wave-3) — chase if it reproduces outside browser automation
- [x] Block/mute explicitly deferred to Epic 8 proper, where mute/block/DM-policy already lives (#24) — noted here so it isn't mistaken for in-scope
- [x] Server tests for mutual-hold detection, contact persistence across restart, and DM/autocomplete gating on contact state

**Done when:** Two strangers hold F, touch, and become contacts — restart the server and they're still contacts — and a quick F-tap still invites a nearby stranger to a party exactly like it does today.

## Epic 7.11 — Effects Showcase & Test Bench (deploy wave 4)

**Goal:** A zero-server living test bench for area effects and combat VFX, built by growing the existing paint tool rather than standing up a second one (#25) — because the engine is isomorphic ("`engine` is pure and platform-free; everything else is a shell around it," ARCHITECTURE.md § The one rule that matters), the same pure effects/areas systems the server runs authoritatively can run identically, client-only, over a hand-painted map.

- [x] **DECISION, logged as an assumption:** enhance the existing `?scene=editor` ([EditorScene.ts](../packages/client/src/scenes/editor/EditorScene.ts), currently terrain-paint-only via `paintPanel.ts`) instead of building a second tool (#25)
- [x] **New brush palette section:** area-effect brushes (fire, poison, oil, wet, steam — EFFECTS.md's launch area set) painting live area tiles; an entity-spawner brush for the 4 starter enemies plus ground items
- [x] **SIMULATE toggle:** runs the pure engine's effects/areas systems client-side over the painted map at the same fixed `TICK_RATE` the server uses, entirely local with no network traffic (#26); fire spreads along painted oil, poison drifts, enemies wander and attack a dummy target — a new client-only training-dummy entity (regenerating HP, not an engine-authoritative entity kind, so it needs no server plumbing) (#27); toggling off freezes state in place, a separate reset clears the canvas back to blank (#26)
- [x] **Blood VFX:** hit-splatter particles + short-lived floor decals, cosmetic only with no gameplay effect (#28), assumed to fade over 10s from a pooled cap so a long fight doesn't accumulate unbounded decals (#29) — triggered off the existing `hit`/`death` `GameEvent`s (already broadcast within AOI per [server.ts](../packages/engine/src/net/server.ts)) in both the live game and the showcase's local SIMULATE loop
- [x] Client tests for the new brushes' pure paint logic, the SIMULATE tick's determinism over a fixed painted fixture, and blood-decal pooling/expiry

- [ ] Fix AreaEffectPool.sync rig staleness: reusing a rig by id never notices a sprite-kind change for the same id (oil catching fire keeps rendering as oil) — bench worked around it by folding defId into the view id (bench/views.ts); apply the real fix in vfx/areaEffectPool.ts and check scenes/dungeon/areaViews.ts for the same latent bug (wave-4 find)
- [ ] Recapture wave4-blood-hit.png / wave4-blood-decals.png with clearer splatter + fading-alpha decal gradient — audit judged the current pair low-fidelity though the code is verified correct (wave-4 audit minor)
- [ ] Bench Spitter fires an instant hit at the dummy instead of a rendered projectile (ASSUMPTIONS #60) — add projectile rendering to the bench sim when convenient

**Done when:** Someone paints an oil line next to a fire brush, hits SIMULATE, and watches it spread exactly like the live game would — entirely offline — and a combat hit in either the showcase or the real game splatters and leaves a decal that fades on its own.

## Epic 7.12 — v1 Parity & Playability Gaps (deploy wave 5)

**Goal:** Audit v1 (`reference/`, frozen per its own README's "proven logic and hard-won invariants" mandate) against v2's current state and close the user-visible gaps — the last wave before Epic 8 proper.

- [x] **Crafting-table panel:** recipe crafting already exists server-side (`clientCraftSchema`, content-driven per `packages/content`); v1 had a panel (`reference/client/ui/panels.ts` + `inventoryPanel.ts`); v2's client has none (`inputAdapters.ts`'s `createInputPanels()` is a hardcoded stub, per HUD_OS.md § 7 Phase 1's own note) — ship it as an HUD-OS window, range-gated open/close like today's DOM `Panels` class, reading recipes straight from content (#30)
- [x] **Stash panel:** same gap, same treatment (#30) — server-side `clientStashSchema` put/take already works; v2 has no client panel for it
- [ ] **Run input:** hold Shift to run, server-authoritative speed, deterministic prediction, animation cadence, stamina/balance decision, keyboard help text — this is Epic 7.7's own still-unchecked bullet, folded in unchanged, just relocated into the wave plan (#31)
- [x] **Party downed/revive UX:** the 30s bleed-out revive already runs server-side (`deaths.ts`); client presentation is missing. Extend `partySnapshotSchema` (today: `id`/`name`/`x`/`y` only) with `hp`/`downed` so off-AOI party frames can show it, plus an on-screen revive prompt when standing near a downed party member (#32)
- [x] **Reconnect UX polish:** the resume-toast widget already exists and works (`ReconnectToastWidget`) — verify it end-to-end, then add the piece that doesn't exist yet: a real door-return stack, so resuming mid-nested-room (personal room → safe room → floor) restores the same nesting, not just x/y (#33)
- [x] **Committed Playwright e2e suite restoration:** v1 had 16 live-browser scenarios (`reference/e2e/game.spec.ts`); v2 has screenshot tooling but an empty `tests/` directory — no committed e2e specs survived the rewrite. Restore the core flows as new specs under `tests/e2e/`, ported-not-copied per `reference/README.md`'s "copy ideas, not files" rule: join/move/jump, two-client AOI visibility, combat, safe-room door round-trip (#34)
- [x] **Production smoke expansion:** two-client convergence tested against the deployed prod instance — runnable only once Epic 2's deployed playtest server (still unchecked/deferred as of this writing) exists; logged here so it isn't silently dropped from the wave (#35)
- [ ] **v1-parity scan, two more gaps found:** a dedicated title/mode-select screen — v1 had one (`reference/client/ui/titleScreen.ts`, 123 lines); v2's equivalent is a thin `scenes/title/background.ts` — audit for missing affordances and close them; and confirming v1's session-menu scope (`reference/client/ui/gameMenu.ts`) is fully matched by Epic 7.7's already-shipped session menu rather than assuming parity (#36)
- [ ] Note: the remaining unchecked Epic 7.7 bullets this wave plan doesn't touch — crawler art rebuild, snappier jump ascent, safe-room hierarchy correction, conditional room replication — stay unscheduled here, assumed to land in a later wave not yet defined rather than dropped (#37)

- [x] **Pointer world-transform reliability audit:** Phaser's shared pointer.worldX/worldY is silently rewritten by whichever active scene's camera last hit-tests it — with HudScene running in parallel, its un-zoomed camera can stomp the game camera's transform. The new combat code already defends itself via camera.getWorldPoint; audit the pre-existing consumers (input/pointer.ts click-attack, ui hotbar throw-aim) against the live stack and convert them to getWorldPoint where affected, with a regression test

- [ ] Extend tests/e2e/ to cover the wave-5 features themselves — crafting, stash, Shift-run, downed/revive, reconnect-nesting have integration-test + manual coverage but no e2e spec yet (wave-5 audit minor)
- [ ] Recapture wave5-downed-pose.png — current frame is a death/respawn overlay, not the distinct downed pose; wave5-downed-revive.png (revive ring) is the genuine proof (wave-5 audit minor)
- [ ] Protocol-mismatch UX: a stale client currently enters a silent ~1-attempt/sec reconnect loop on version bumps (net/socket.ts) — detect the protocol_mismatch error code and show a "new version — refresh" prompt instead (wave-5 audit minor)
- [ ] Title/mode-select audit + session-menu parity confirmation (#36) — NOT done in wave 5: no lane owned it; the e2e lane's sandbox-fixture discovery (ASSUMPTIONS #78: no level picker exists to reach sandbox) makes this concrete

**Done when:** A fresh clone has a committed e2e suite that passes locally, crafting and stash are usable from the client without dev tools, a downed party member's status is visible to their team, reconnecting mid-safe-room-nesting puts you back exactly where you were, and a prod-targeted smoke test confirms two strangers still converge on the live deploy.

## Epic 7.13 — Playtest Hardening II (deploy wave 7, user screenshots 2026-07-20)

**Goal:** Austin's second playtest filed a systemic defect list with annotated screenshots. Every item below ships or has a root-cause writeup; his verdict — "fill out the damn roadmap and don't stop until it's complete" — is the standing directive.

- [x] Melee arc 180-ish -> 90 degrees total (MELEE_ARC_COS 0.35 -> 0.7071)
- [ ] **Kill feedback:** enemies currently vanish on death — no burst, no guts, no corpse. Investigate why wave-4 death VFX doesn't read on live; ship a real kill moment: blood explosion + gib particles + brief corpse/bones fade + hit-stop tick
- [ ] **XP + levels (Epic 11 core, pulled forward):** server-authoritative XP on kill, floating +XP numbers, character level on the HUD, level-up flourish; persistence in PlayerStore
- [ ] **Starter-kit famine:** dying drops everything and the kit never re-grants -> new/returning players are permanently Unarmed (Austin joined to exactly this). Re-grant sword+torches on respawn when the player has no weapon (log assumption); also fix the "YOU DIED on first join" overlay bug (death overlay must only show after a real death event this session)
- [ ] **1-tile corridor stuck-walking:** moving left in a 1-wide hallway requires pixel-perfect alignment — add corner-slide/auto-nudge assist in engine movement so near-misses glide into the gap
- [ ] **z visual lift:** jumping/stepping onto a z1 platform keeps the sprite at the same screen y — entities must render y-offset by their z (sprite, shadow, nameplate), or elevation reads as nothing
- [ ] **Terrain legibility overhaul (the "absolute mess" walls):** his screenshots show brick face strips scattered mid-floor, black void patches inside rooms, disconnected ledges — the dungeon reads as noise. Reproduce at his coords (x36,y-51 / x47,y-54 / x49,y-54 / x41,y-56 on the prod seed), diagnose worldgen fragmentation vs render grammar, and make generated dungeons READ: cohesive wall masses, clear top-vs-face contrast, no orphan face strips
- [ ] **Enemies in the void:** enemies stand/walk in chasm/void areas (screenshots show nameplated creepers in pure black) — enemy movement must respect walkability like players; chasm kills them too
- [x] Blood decals last 45s (was 10s), pool cap 96; sword no longer a sliver (weapon sprite now WORLD_PIXEL_SCALE like every other entity); torch-halo budget 12 -> 24 so lights stop blinking in mid-screen
- [ ] **Health bars only after damage** (DCC-book style): nameplate HP bars hidden until an entity first takes damage this encounter (show on damage, linger, hide when full again) — user directive
- [ ] **Movement stutters:** random hitches while walking — suspect synchronous chunk-visual baking when a new chunk scrolls into view; profile and move the bake off the hot frame (budgeted/ahead-of-camera)
- [ ] **Torch pop-in residue:** after the 24-light budget, add a fade-in (~250ms) on newly activated halos so any remaining swap reads as kindling, not popping
- [ ] **"Single walls" legibility (user screenshots #2, 2026-07-20):** legal 2-deep z1 ridges read as floating 1-row brick strips with bare side caps because their TOP row renders identical to plain floor — the terrain-legibility lane must make raised tops visually distinct (tone/edge treatment) and re-audit orphan strips beside chasm rims ("single walls in the void")
- [ ] Inventory selection outline z-order (yellow ring renders under the Drop button), "Unarmed" chip text centering, and a general HUD alignment pass

## Epic 8 — Social Fabric (v0.5)

**Goal:** The systems in [GAME_DESIGN.md](GAME_DESIGN.md) § Social fabric: meeting people is the game's magic moment, so the plumbing around it must be consent-first.

- [ ] **Hold-to-fistbump contact gesture:** holding F keeps the crawler's arm extended while movement remains available; physical contact between two crawlers simultaneously holding the pose creates a mutual chat contact. This gesture never creates or joins a party.
- [ ] **Explicit party management menu (large lift):** create a party, browse contacts/nearby players, send and accept/decline invites, leave, kick, and disband; party membership changes only through these menu actions, never through fistbumps
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
- [ ] **Editable HUD editor ([docs/HUD_OS.md](HUD_OS.md)):** the "Crawler OS" HUD system's remaining phases land here over the v0.5 widget foundation — Phase 2 (edit-HUD mode: move/resize/toggle/reset), Phase 3 (window catalog + settings + tabs-as-primitive), Phase 4 (pinning, opacity, per-window settings, account-synced layouts, gated on this epic's account system); layouts sync to account. Phase 1 (inventory window) ships earlier, in Epic 7.7

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
