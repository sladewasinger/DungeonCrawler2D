# Architecture

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Rendering/game framework | **Phaser 3** (client only) | Mature, well-documented, ideal for top-down tile games |
| Language | **TypeScript** (strict, everywhere) | One language across engine/client/server; data schemas need real types |
| Shared simulation | **`packages/engine`** — pure TS, no Phaser, no Node APIs | Runs authoritatively on the game server *and* on the client for prediction; testable headlessly |
| Game server | **Node + `ws`** on a small EC2 instance | Real-time authoritative sim needs a stateful process (see [INFRASTRUCTURE.md](INFRASTRUCTURE.md)) |
| Build/dev | **Vite** (client), esbuild (server bundles) | Instant HMR; trivial static deploy |
| Tests | **Vitest** | Same toolchain; runs the headless engine and protocol tests |
| Services (v0.5+) | AWS Lambda (crafting AI proxy, registry) | Request/response work stays serverless — ~$0 idle |
| Persistence | Server memory (session) → DynamoDB (stash, registry, accounts) | Start simple, migrate behind a storage interface |
| Infrastructure | AWS, defined in Terraform | Hybrid: serverless control plane + small stateful game server |

## The one rule that matters

**`engine` is pure and platform-free; everything else is a shell around it.**

Everything that defines *what the game is* — effect primitives, interaction rules, dungeon generation, item semantics, combat resolution — lives in `packages/engine` as pure TypeScript with no Phaser and no Node-specific APIs. This was already the plan for testability and AI crafting; multiplayer makes it load-bearing:

- The **game server** imports the engine and runs it as the authoritative simulation.
- The **client** imports the same engine for local prediction of your own character and renders server state with Phaser.
- **Tests** run the engine (and whole client↔server protocol exchanges) headlessly in Node.
- **AI crafting** proposals are validated against the same schemas the engine loads — one validator, every consumer.

## Repo layout (npm workspaces)

```
dungeoncrawler2D/
├── docs/                        # This documentation
├── assets/pack/                 # Source art (Craftpix asset pack + license), pre-pipeline
├── tools/generate-art.mjs       # Bakes the committed spritesheets + atlas.json from measured pack slices
├── tools/render-sample.ts       # Renders docs/art-samples/ proof images via the client's tileframes.ts
├── tools/tile-studio/           # In-browser map editor (npm run studio): palette + rule learning + WFC paint → dc2d-map JSON
├── tests/e2e/                   # Playwright live-browser suite (npm run test:e2e)
├── packages/
│   ├── content/                 # ── DATA, NOT CODE (@dc2d/content) — shared by server & client ──
│   │   └── src/                 #   statuses/areas/items/enemies/recipes/rules JSON,
│   │                            #   zod-validated with cross-reference checks at import
│   ├── engine/                  # ── PURE: no Phaser, no Node APIs ──
│   │   ├── core/                #   Seeded RNG, event bus, fixed-tick clock, ids
│   │   ├── world/               #   Layout pipeline: types, terrain (caves+corridors), generate, pockets, world cache
│   │   │   └── features/        #   Deliberate stamps: fixed kiosks/stairways, platforms, terraces, rooms, testzone, custommap
│   │   ├── entities/            #   Entity model, stats, tags
│   │   ├── effects/             #   Primitives, StatusEffect, interaction rules (EFFECTS.md)
│   │   ├── areas/               #   Tile-region area effects, spread/decay sim
│   │   ├── items/               #   ItemDefinition schema, inventory, validation
│   │   ├── combat/              #   Damage resolution, death/downed
│   │   ├── crafting/            #   Recipe matching; AI proposal validation (v0.5)
│   │   └── net/                 #   Protocol types: intents, events, snapshots (shared contract)
│   ├── client/                  # ── PHASER + VITE ──
│   │   ├── scenes/              #   Scene orchestration: frame loop, fixed-step sampling, camera
│   │   ├── render/              #   TerrainRenderer, EntityRenderer, AreaRenderer, atlas constants
│   │   ├── net/                 #   connection (socket + intents), prediction, apply (server truth), interpolate, identity
│   │   ├── input/               #   Keyboard/mouse → intents (controller.ts)
│   │   └── ui/                  #   HUD widget registry (GAME_DESIGN.md), panels, contextual prompts, proximity queries
│   ├── game-server/             # ── NODE + ws ──
│   │   ├── sim/                 #   The authoritative sim — one module per concern over a shared
│   │   │                        #   SimState (state.ts): players, actions, inventory, social,
│   │   │                        #   enemies, projectiles, statuses, deaths, spawn, snapshots,
│   │   │                        #   testzone; GameSim facade + tick order in index.ts
│   │   ├── server.ts            #   ws transport: decode/zod-validate → sim; snapshots out
│   │   ├── store.ts             #   File-backed player store (stash, identity) → DynamoDB in v0.8
│   │   └── main.ts
│   └── services/                # ── (v0.5+) LAMBDA HANDLERS ──
│       ├── craft/               #   AI crafting proxy
│       └── registry/            #   Item registry (v0.6)
├── infra/                       # Terraform — see INFRASTRUCTURE.md
└── tests/                       # Vitest: engine units + headless client/server sim tests
```

Dependency rule (lint-enforced): `engine` imports nothing from other packages; `client`, `game-server`, and `services` import `engine`; nobody imports across the other three.

## Code organization

Package boundaries alone don't keep code maintainable — Epic 1.5 exists because `sim.ts` quietly grew to 1,400 lines inside a perfectly clean package layout. These rules keep files human-sized; treat crossing them as a review blocker, not a cleanup for later:

- **~300 lines is the soft cap for a source file.** Not a hard limit — a cohesive 320-line module beats two awkward halves — but crossing it is the prompt to split by concern. A file you can't summarize in one sentence ("enemy population and per-tick AI") is already two files.
- **A subsystem that outgrows one file becomes a folder with a facade.** Pattern (see `game-server/src/sim/`): a shared state type in `state.ts`, sibling modules exporting plain functions that take that state as their first argument, and an `index.ts` facade that owns the state instance, the public API, and the orchestration order (the sim's tick order lives in one `step()` anyone can read top to bottom). Consumers import the facade, never the internals — the split is invisible from outside the folder.
- **State lives in one place; behavior lives in modules.** No module-level mutable state hiding in the siblings — everything mutable hangs off the one state object, so any function's inputs are visible in its signature.
- **Split along the domain's own seams, not line counts.** The client splits as transport / prediction / server-truth application / interpolation because those are the netcode's real seams; the scene splits as input → intents, render, contextual UI. If a split forces two files to share private details, it was the wrong seam.
- **Every file opens with a doc comment** saying what it owns and why it exists — the codebase should be navigable from folder listings and first lines alone.
- **New epics add folders/modules, not length.** When a feature lands as +400 lines to an existing file, that's the drift this section forbids — the same feature lands as a new module wired into the facade.

## Networking model

**Server-authoritative, intent/event protocol.** The game server owns the truth; clients are input devices and renderers. In a PvPvE game this isn't just good practice — a client that could lie about damage or position would be a direct weapon against other players. It falls out naturally from the pure-engine design.

```
client                          game server (authoritative)
──────                          ────────────────────────────
input → intent  ──────────────▶ validate intent
                                engine tick (20 Hz): movement,
predict own movement            effects, areas, combat, AI
interpolate other entities ◀── AOI-scoped deltas + events (~15–20 Hz)
reconcile own position     ◀── authoritative position corrections
render (60 fps, Phaser)
```

Key decisions:

- **Tick rates:** server simulates at a fixed **20 Hz** (effects internally tick slower, e.g. 2–10 Hz — DoT cadence doesn't need more). Clients render at 60 fps, interpolating between snapshots (~100 ms buffer).
- **Intents up, events down.** Clients never say "I took damage" or "the fire spread" — they say "I pressed up" / "I threw item X at tile Y". The server replies with what actually happened. All effect/combat/loot outcomes are computed exactly once, on the server.
- **Prediction only for your own movement.** Top-down walking predicts trivially; server reconciliation corrects drift. Everything else (projectiles, effects, enemies) is rendered from server events with interpolation — at co-op latencies (<150 ms) this feels fine and keeps the code simple.
- **Area-of-interest (AOI) replication.** The floor is vast and shared, so full-world broadcast is impossible by design: each client receives entity/effect deltas only within a view radius around its player. AOI is simultaneously the bandwidth cap (per-player traffic is constant regardless of world size), the *fog of dread* (you genuinely don't know who's out there), and what makes stumbling onto a stranger an event.
- **Geometry ships as seeds.** Chunks are deterministic from `(worldSeed, floor, chunkCoord)`, so the server sends coordinates, never tiles; a joining client gets its position + an AOI entity snapshot and generates everything else locally.
- **Chat rides the same socket** as lightweight channel messages (global / party / DM / proximity), fanned out server-side with mute/block lists enforced *before* delivery — a blocked player's messages never reach your client.
- **Protocol lives in `engine/net`** as typed messages (zod-validated on the server — never trust the client, doubly so in PvP), JSON-encoded first. Binary encoding (msgpack) is a v0.9 optimization if profiling demands it.
- **Shards are server-owned.** No player is "host"; disconnects get a grace period and the floor keeps simulating. One game-server process hosts one or more floor shards.

### World model: floors, chunks, stretch rooms

- A **floor is exactly one shard, and floors never interact.** No shared space, no cross-floor effects — a floor is a self-contained world with its own difficulty, biome, and lifecycle. Descent through a stairway is a one-way handoff: the shard broker moves the player's connection (and state) to the next floor's shard. This makes sharding trivially clean — nothing ever spans a shard boundary.
- **Floors run indefinitely for now** (see [GAME_DESIGN.md](GAME_DESIGN.md)): one global world, stairways open, new players start on floor 1. The timed **Seasons** lifecycle (post-v1.0) will add a lightweight controller (scheduled Lambda or the broker) that opens stairways on each floor's time gate and closes seasons to new joins.
- **Terrain is heightmapped.** Each chunk carries a continuous height field alongside its tile/zone data; entities live at `(x, y, z)`. Gravity, jump arcs, and landings are part of the engine's physics step from v0.1 — retrofitting z into a shipped protocol and generator would be miserable, so it's in the data model from the first commit.
- **Walls are terrain, not axioms.** A wall tile is the local ground raised `WALL_RISE` (2 — above STEP_UP, under the jump apex): its *height* blocks walking, its top is a walkable platform you can jump onto, walk across, and fall off, and projectiles clear it only if their arc does. Nothing in movement special-cases walls; only furniture (crafting table, stash) is solid by fiat. Stretch-room perimeters rise +6 — beyond the jump apex — so instanced rooms stay sealed.
- The server keeps **active chunks** (near players) hot in the tick loop and **hibernates** the rest, persisting their deltas (looted items, burned/charred tiles, opened doors) so the world stays consistent when someone wanders back.
- **Fixed features** — safe rooms, stairways, biome regions — are placed deterministically per floor, identical for every player.
- Map regions carry **zone tags** (`sanctuary` on safe rooms) that the effects engine reads like any other tag — sanctuary is data plus one interaction rule, not special-case code (see [EFFECTS.md](EFFECTS.md)).
- **Stretch rooms** (personal rooms, party rooms — see [GAME_DESIGN.md](GAME_DESIGN.md)) are small instanced sub-maps attached to safe rooms by portal. They're simulated as tiny always-`sanctuary` chunks keyed by player/party id, not part of floor geometry — which is how one safe-room door can lead somewhere different for each player.

### Simulation loop

The engine exposes a pure step function — `tick(state, intents, dt) → {state, events}` — with no timers or sockets of its own. The tick includes the z-physics step: gravity, jump arcs, and landings, with fall damage routed through the effects engine like any other damage. The game server drives it on a 20 Hz interval and broadcasts the resulting events/deltas. The client drives the same function for its own predicted entity, and Vitest drives it directly in tests (including full two-client protocol simulations with no network and no browser).

### Entities, stats, tags

An `Entity` is an id + position `(x, y, z)` + stat block + **tag set** + active effects + (optional) inventory. Tags are the universal vocabulary that everything keys off:

- Material/state tags: `flammable`, `liquid`, `wet`, `metal`, `organic`, `sharp`
- Behavioral tags: `enemy`, `player`, `item`, `container`
- Effect-owned tags: being on fire adds `burning`; standing in water adds `wet`
- Zone tags on map regions: `sanctuary` (safe rooms — hostile primitives suppressed); later biome tags like `flooded`, `overgrown`

Interaction rules (see [EFFECTS.md](EFFECTS.md)) are written against tags, never against specific items. That's why an AI-invented item slots in: if it says `tags: ["flammable", "liquid"]`, every existing rule about flammable liquids already applies to it — on the server, for the whole party.

### Data-driven content

Every effect, item, and enemy is a JSON file in `content/`, validated against a TypeScript schema (zod) at load time — by the game server (authoritative), by the client (rendering metadata), and in v0.5 against the AI's structured output. Code interprets; data defines. When an AI-crafted item is accepted, the game server loads its definition exactly like a shipped content file and broadcasts it to the session.

### World generation

`generateChunk(worldSeed, floor, chunkCoord) → DungeonChunk` — a pure function over seeded hashes, built **layout first, height second**:

1. **Flat layout.** Cave-noise walls + the corridor network (long hallways between jittered chunk centers — the global connectivity guarantee) + fixed features (safe-room kiosks, stairway pads) + a reachability pass that seals orphan pockets. Everything at height 0, so the dungeon reads as a dungeon on its own.
2. **Deliberate height.** Verticality is only ever *added by features that make sense as places*: wall tiles rise `WALL_RISE` (+2 — jumpable platforms with real collision at their base), ruin platform clusters stamp tiered mesas with loot on top, and the authored proving ground carries its own geometry. There is **no noise heightfield** — a height change exists because something was built there, never because a contour happened to cross a hallway. (Tried the other order first; it produces staircases splitting hallways that are mathematically valid and conceptually meaningless.)

**Wave-function collapse is the planned decoration layer** (v0.8 biomes/ruins): the noise + corridor skeleton stays structural — it owns connectivity, determinism, and chunk-locality, none of which WFC provides naturally — while seeded WFC textures constrained regions (room interiors, ruin patches) whose border cells the skeleton pins, so per-chunk solving can't contradict neighbors. Determinism is a **tested networking invariant**: the same inputs must produce byte-identical geometry and heights on every machine, because clients regenerate chunks locally from coordinates the server sends. Spawned entities (enemies, loot, players) are placed by the server and sent as events, so only static geometry and zones rely on determinism. The generator's contract and test suite cover cross-chunk connectivity, the flat-base invariant, and platform-tier jumpability.

## Rendering & art pipeline

- **64×64 pixel tiles**, `pixelArt: true` (nearest-neighbor); top-down view; Don't Starve-adjacent mood via palette and silhouette, not detail
- **Assets are baked binaries**: `tools/generate-art.mjs` (`npm run art`) composes the tile atlas from the Craftpix top-down dungeon pack in `assets/pack/` (16×16 source tiles upscaled 4×, sanctuary recolored teal, cliff faces reusing the pack masonry) plus procedural pieces (stair treads, rim overlays, player sprites), writing committed PNGs + `atlas.json` (frame indices) that the client imports — one source of truth. New/replacement art slots in behind the same atlas contract
- **Chunks render as Phaser tilemap layers** (base terrain + overlay for wall tops, cliff faces, ledge rims, and stair treads) sharing the single atlas texture on the GPU — at 64px/tile, per-chunk canvases would be 2048² textures; tilemaps keep memory flat. Height shading is a per-tile elevation tint spanning the full height range (higher = brighter/warmer, depths darker/cooler); treads draw wherever the height field forms a walkable ramp, so climb routes are readable without any extra tile data. Walls render in two honest layers — real floor underneath (tinted at the ground they rise from), the wall-top platform over it (tinted at its raised height) — and their south faces come from the same cliff-face overlay as any ledge, so the art always agrees with the physics. Variant selection is `hash2D(wx, wy)`, so every client draws the identical world
- **Verticality rendering:** a shadow blob anchors every entity's ground position; the sprite lifts off the shadow by its height **above the local terrain** (`z − heightAt(x, y)`) — zero when grounded on any plateau, growing only mid-jump/mid-fall. (Lifting by absolute z is wrong: terrain art doesn't shift with height in top-down, so grounded players on high ground would float.) Cliff-face and rim tiles make elevation legible at a glance
- Player characters get palette-swap variants so players are distinguishable at a glance
- Effect VFX (fire, poison bubbles, splashes) are small particle configs keyed by effect tags — an AI item tagged `fire` automatically gets fire VFX

## AI crafting (summary — full design in [AI_CRAFTING.md](AI_CRAFTING.md))

```
Crafting UI ──prompt+ingredients──▶ Lambda (services/craft) ──▶ AI API (structured output)
     ▲                                                        │
     │                                              ItemDefinition proposal
     │                                                        ▼
  accept/deny ◀── engine/crafting validator (schema, primitives, budget)
     │
     └── on accept: definition persisted + pushed to the game server,
         which broadcasts it to the session like any content file
```

Crafting is request/response and not latency-sensitive, so it stays on Lambda even though gameplay runs on a stateful server. The browser never holds API keys; the engine never trusts AI output.

## Testing strategy

- **Unit (majority):** effect primitives, interaction rules, stacking, dungeon connectivity/determinism, item validation, melee targeting, AI decisions, area buoyancy — all headless engine code
- **Live-browser e2e (Playwright):** a real chromium drives the real client against a real server — trusted keyboard movement/jumps, two-context AOI + party flows, combat, reload-resume (`npm run test:e2e`)
- **Protocol/sim tests:** in-process game server + several headless clients exchanging real protocol messages; scripted scenarios ("A throws a molotov at B near a safe-room door while C watches from outside AOI range") run for N ticks, asserting observers converge, sanctuary suppresses, and out-of-range clients receive nothing
- **Determinism tests:** same `(worldSeed, floor, chunkCoord)` ⇒ byte-identical chunk, run in CI on Linux + local on Windows to catch platform drift
- **Dev harness for verification:** fixed seeds everywhere (`e2e-world` for Playwright, `dev-world-1` locally) plus server-gated debug intents — `/god` (no damage, no knockback) and `/tp X Y` — so a feature is verified by teleporting straight to it and asserting, not by wandering a live PvP world. Gated by the server's `debugCommands` option: on for dev/e2e, hard-off in production
- **Manual/playtest:** Phaser layer, feel, latency tuning — every release playtested as a duo minimum

## Conventions

- File size and module structure per **Code organization** above — ~300-line soft cap, facade folders for subsystems, no god files
- Strict TS, no `any` in `engine`
- `engine` imports nothing from other packages or `phaser`/`ws` (enforced by lint rule)
- All server-received messages are zod-validated before touching the sim — the client is untrusted input
- Content JSON is kebab-case ids (`vodka-bottle`), referenced by id everywhere
- Every new primitive, interaction rule, or protocol message lands with tests in the same PR
