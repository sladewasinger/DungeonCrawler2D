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
├── assets/                      # Source art (aseprite/png), pre-pipeline
├── content/                     # ── DATA, NOT CODE — shared by server & client ──
│   ├── effects/*.json           #   bleeding.json, on-fire.json, wet.json, ...
│   ├── items/*.json             #   vodka-bottle.json, rag.json, knife.json, ...
│   ├── enemies/*.json
│   └── tilesets/                #   Tileset metadata (which tiles are flammable, etc.)
├── packages/
│   ├── engine/                  # ── PURE: no Phaser, no Node APIs ──
│   │   ├── core/                #   Seeded RNG, event bus, fixed-tick clock, ids
│   │   ├── dungeon/             #   Procedural generation: DungeonMap, generators
│   │   ├── entities/            #   Entity model, stats, tags
│   │   ├── effects/             #   Primitives, StatusEffect, interaction rules (EFFECTS.md)
│   │   ├── areas/               #   Tile-region area effects, spread/decay sim
│   │   ├── items/               #   ItemDefinition schema, inventory, validation
│   │   ├── combat/              #   Damage resolution, death/downed
│   │   ├── crafting/            #   Recipe matching; AI proposal validation (v0.5)
│   │   └── net/                 #   Protocol types: intents, events, snapshots (shared contract)
│   ├── client/                  # ── PHASER + VITE ──
│   │   ├── scenes/              #   Boot, Dungeon, Base, UI overlay scenes
│   │   ├── render/              #   Tilemap renderer, entity sprite sync, effect VFX
│   │   ├── net/                 #   WebSocket client, prediction, interpolation, reconciliation
│   │   ├── input/               #   Keyboard/mouse → intents
│   │   └── ui/                  #   Inventory, hotbar, crafting dialog, party HUD
│   ├── game-server/             # ── NODE + ws ──
│   │   ├── session/             #   Rooms: create/join/leave, join-in-progress, reconnect
│   │   ├── sim/                 #   Runs engine at fixed tick; snapshot/delta broadcasting
│   │   └── main.ts
│   └── services/                # ── (v0.5+) LAMBDA HANDLERS ──
│       ├── craft/               #   AI crafting proxy
│       └── registry/            #   Item registry (v0.6)
├── infra/                       # Terraform — see INFRASTRUCTURE.md
└── tests/                       # Vitest: engine units + headless client/server sim tests
```

Dependency rule (lint-enforced): `engine` imports nothing from other packages; `client`, `game-server`, and `services` import `engine`; nobody imports across the other three.

## Networking model

**Server-authoritative, intent/event protocol.** The game server owns the truth; clients are input devices and renderers. This is the standard architecture for cheat-resistant co-op, and it falls out naturally from the pure-engine design.

```
client                          game server (authoritative)
──────                          ────────────────────────────
input → intent  ──────────────▶ validate intent
                                engine tick (20 Hz): movement,
predict own movement            effects, areas, combat, AI
interpolate other entities ◀── snapshot deltas + events (~15–20 Hz)
reconcile own position     ◀── authoritative position corrections
render (60 fps, Phaser)
```

Key decisions:

- **Tick rates:** server simulates at a fixed **20 Hz** (effects internally tick slower, e.g. 2–10 Hz — DoT cadence doesn't need more). Clients render at 60 fps, interpolating between snapshots (~100 ms buffer).
- **Intents up, events down.** Clients never say "I took damage" or "the fire spread" — they say "I pressed up" / "I threw item X at tile Y". The server replies with what actually happened. All effect/combat/loot outcomes are computed exactly once, on the server.
- **Prediction only for your own movement.** Top-down walking predicts trivially; server reconciliation corrects drift. Everything else (projectiles, effects, enemies) is rendered from server events with interpolation — at co-op latencies (<150 ms) this feels fine and keeps the code simple.
- **Maps ship as a seed.** `generateDungeon(seed, depth, config)` is deterministic, so a floor transfer is a few bytes; late joiners get seed + one full entity snapshot.
- **Protocol lives in `engine/net`** as typed messages (zod-validated on the server — never trust the client), JSON-encoded first. Binary encoding (msgpack) is a v0.8 optimization if profiling demands it; at 4 players and this message volume it likely never will.
- **Sessions are server-owned.** No player is "host"; anyone can disconnect and the run continues. Reconnect grace period restores the player.

### Simulation loop

The engine exposes a pure step function — `tick(state, intents, dt) → {state, events}` — with no timers or sockets of its own. The game server drives it on a 20 Hz interval and broadcasts the resulting events/deltas. The client drives the same function for its own predicted entity, and Vitest drives it directly in tests (including full two-client protocol simulations with no network and no browser).

### Entities, stats, tags

An `Entity` is an id + stat block + **tag set** + active effects + (optional) inventory. Tags are the universal vocabulary that everything keys off:

- Material/state tags: `flammable`, `liquid`, `wet`, `metal`, `organic`, `sharp`
- Behavioral tags: `enemy`, `player`, `item`, `container`
- Effect-owned tags: being on fire adds `burning`; standing in water adds `wet`

Interaction rules (see [EFFECTS.md](EFFECTS.md)) are written against tags, never against specific items. That's why an AI-invented item slots in: if it says `tags: ["flammable", "liquid"]`, every existing rule about flammable liquids already applies to it — on the server, for the whole party.

### Data-driven content

Every effect, item, and enemy is a JSON file in `content/`, validated against a TypeScript schema (zod) at load time — by the game server (authoritative), by the client (rendering metadata), and in v0.5 against the AI's structured output. Code interprets; data defines. When an AI-crafted item is accepted, the game server loads its definition exactly like a shipped content file and broadcasts it to the session.

### Dungeon generation

`generateDungeon(seed, depth, config) → DungeonMap` — a pure function over a seeded RNG. Determinism is a **tested networking invariant**: the same seed must produce a byte-identical map on every machine, because clients regenerate the map locally from the seed the server sends. Spawned entities (enemies, loot) are placed by the server and sent as events, so only static geometry relies on determinism.

## Rendering & art pipeline

- 16×16 pixel tiles, rendered at 3–4× zoom with `pixelArt: true` (nearest-neighbor)
- Top-down view; Don't Starve-adjacent mood via palette and silhouette, not detail
- Placeholder art is programmatically generated colored tiles at first; real tilesets swap in behind the same tileset-metadata format
- Player characters get palette-swap variants so party members are distinguishable at a glance
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

- **Unit (majority):** effect primitives, interaction rules, stacking, dungeon connectivity/determinism, item validation — all headless engine code
- **Protocol/sim tests:** in-process game server + two headless clients exchanging real protocol messages; scripted scenarios ("A throws molotov on wet ground next to B") run for N ticks, asserting both clients converge on identical outcomes
- **Determinism tests:** same seed ⇒ byte-identical `DungeonMap`, run in CI on Linux + local on Windows to catch platform drift
- **Manual/playtest:** Phaser layer, feel, latency tuning — every release playtested as a duo minimum

## Conventions

- Strict TS, no `any` in `engine`
- `engine` imports nothing from other packages or `phaser`/`ws` (enforced by lint rule)
- All server-received messages are zod-validated before touching the sim — the client is untrusted input
- Content JSON is kebab-case ids (`vodka-bottle`), referenced by id everywhere
- Every new primitive, interaction rule, or protocol message lands with tests in the same PR
