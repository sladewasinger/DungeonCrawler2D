# v2 Port & Rebuild Plan — the shared brief for every build agent

How the core slice gets built. `reference/` holds the proven v1 implementation:
**engine, content, and game-server are ported** (same logic, tightened to
[ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md), tests carried over and kept
green); **the client is rebuilt from scratch** to [VISUAL_DIRECTION.md](VISUAL_DIRECTION.md).
Never import `reference/`; copy logic in, then improve it.

## Decisions binding on all agents

- **Content schemas live in `engine`** (as v1's `effects/types.ts` did): the engine
  exports the zod schemas + `buildContentRegistry`. `@dc2d/content` holds **JSON and a
  thin raw-export index only** — no logic, no engine import. Server/client build the
  registry by feeding content JSON to the engine validator.
- **Protocol, constants, entity model, physics port as-is** unless a standards rule
  forces a split. v1's netcode invariants (intents up / events down, prediction only
  for self, AOI, zod on every inbound message, determinism) are correctness, not style.
- **Dropped from the core slice:** Tile Studio, `custommap.ts` (no editor in v2 yet),
  the Craftpix/Cainos art pipeline (`tools/generate-art.mjs`), old client wholesale.
- **Kept as-is:** `docs/` design corpus, `infra/` Terraform, dev-harness debug intents
  (`/god`, `/tp`, gated `debugCommands`), the proving-ground idea (rebuilt only if the
  port surfaces it cheaply; not required for the slice).
- **Sprite ids in content JSON change** to the v2 atlas names (see
  `assets/INVENTORY.md` once written). Content values otherwise port unchanged.

## Engine port modules (parallelizable, one agent each)

| Module | Source (reference/engine/) | Notes |
| --- | --- | --- |
| core | constants, rng, noise | small; keep values identical (physics feel is tuned) |
| world | types, terrain, generate, pockets, stairs, level, world | keep flat-first + deliberate-height; determinism tests are the contract |
| world/features | fixed, platforms, rooms, terraces | drop custommap |
| entities | entity, movement, projectile | movement.ts is near the cap — split body-step vs jump/coyote helpers if lint says so |
| effects | types (schemas), system | schemas are the AI-crafting contract — port faithfully |
| areas | system | height-aware spread; sanctuary boundary |
| combat | melee, ai | targeting aid (hostile-preferred arc) is a design invariant |
| net | messages | protocol may renumber to v2.1 but keep message shapes |

Each module ports **with its tests** (`*.test.ts` siblings in reference) rewritten
against the new layout. A port is done when its tests pass and lint/typecheck are green.

## Content port

All six JSON files (statuses, rules, areas, items, enemies, recipes) port with values
intact; `sprite` fields remapped to the v2 atlas. Enemy roster may swap skins (0x72
monsters) but keeps ids/stats/tags/immunities so every engine test still means something.

## Game-server port modules

state, players, actions, inventory, enemies, projectiles, statuses, deaths, spawn,
snapshots, social, helpers → `sim/` facade with tick order in `index.ts` `step()`;
plus server.ts (ws transport), store.ts, main.ts. `actions.ts` (290 lines) splits
(likely melee vs item-use vs interact seams). Sim tests port and stay green.

## Deploy contract (existing Terraform stays untouched)

The live stack at `dungeoncrawl2d.austinwasinger.com` (infra/) is kept as-is; v2 is a
clean artifact swap. Code must honor:

- **Server bundle:** `packages/game-server/dist/main.cjs` (CJS, node22) — systemd runs
  `node main.cjs`; build script already emits this.
- **Server env (systemd unit):** `GAME_PORT` (8081 prod, default 8787 dev),
  `WORLD_SEED`, `STORE_FILE`, `DEBUG_COMMANDS=0`, `NODE_ENV=production`. `CUSTOM_MAP`
  may be set — ignore it gracefully (feature dropped).
- **Client:** builds to `packages/client/dist`; connects same-origin `wss://<host>/ws`
  in prod (CloudFront `/ws*` behavior proxies to EC2 :8081) and `ws://localhost:8787`
  in dev.
- **Smoke script:** `tools/smoke-production.mjs <siteUrl>` must exist and join the
  deployed server via the public endpoint (the deploy workflow calls it) — restore
  against the v2 protocol in the server wave.
- Deploys fire only on push to `main`; the rebuild branch never auto-deploys.

## Client rebuild (new code, the beauty investment)

```
client/src/
├── boot/          # preload: atlas, animations registry, bitmap font, palette
├── scenes/        # DungeonScene = frame-loop orchestration ONLY; TitleScene
├── render/        # terrain (0x72 autotiles, walls/cliffs/stairs, height shading),
│   │              #   entities (animation state machines, shadows, palette swaps)
│   └── lighting/  # darkness overlay + additive light pool, flicker, personal light,
│                  #   camera postFX (vignette, subtle bloom)
├── vfx/           # particles (fire/poison/steam/dust), damage numbers, hit flash,
│                  #   screen shake budget, landing squash
├── net/           # port v1 connection/prediction/apply/interpolate/identity
├── input/         # port v1 controller
└── ui/            # widget registry (id+anchor+offset+scale+visibility, JSON layout),
                   #   HUD widgets: health, hotbar, buffs, chat, nameplates — bitmap
                   #   font + panel language from VISUAL_DIRECTION.md
```

Netcode/input port from v1 (proven); everything visual is new. Every scene/render
file obeys the 200-line cap from birth — the v1 client's 639-line `entities.ts` is
the anti-example.

## Redesign after baseline (2026-07-18 — user directive)

The port is a **baseline, not the destination**. Four v1 weaknesses are slated for
deliberate redesign immediately after the engine baseline lands (behavior changes are
*expected* here; the port-fidelity rule above stops applying once these waves start):

1. **Jump/physics feel** (`core/constants`, `entities/movement`): v1's jump is
   floaty/unsatisfying. Rework for snappy ascent, variable jump height (jump-cut on
   release), stronger descent gravity, brief apex hang. Tuned against measurable
   targets in a headless arc-simulation harness (time-to-apex, +2 clearance margin,
   full-hop vs short-hop delta); chained-platform traversal must stay reliable.
2. **World generation** (`world/`): v1 layouts read as noise-mush, not places. New
   generator producing readable rooms/corridors/caverns and purposeful height
   features, judged from rendered PNG proofs of real chunks. Invariants that stay:
   byte-determinism from (seed, floor, chunk), cross-chunk connectivity, lazy
   chunk-locality, flat-first with deliberate height.
3. **Elevation model correctness** (`entities/movement`, `world/stairs`): targeted
   audit + tests of step-up, stair ramps (`groundAt`), landing tolerance, ledge
   clearance — the "elevation feels broken" bug class.
4. **Height rendering** (client, new code): cliff faces at every rise, wall occlusion
   correct from both approaches, feet-anchored depth sorting, shadows glued to
   ground, elevation readable via light. Verified by screenshot against
   VISUAL_DIRECTION.md before the wave closes.

## Sequencing

1. Scaffold + art acquisition (parallel) → commit
2. Engine + content port (fan-out per module) → Opus audit → commit
3. Game-server port (fan-out) + client boot/render foundations (parallel) → audit → commit
4. Client: lighting, entities, VFX, UI waves — each verified with real screenshots
   against the VISUAL_DIRECTION acceptance bar → commit per wave
5. Integration: full stack up, live-browser e2e, determinism CI, final audit sweep
