# Dungeon Crawler 2D

A browser-based, top-down 2D **real-time PvPvE multiplayer** dungeon crawler with a
full height axis, tonally inspired by the Dungeon Crawler Carl series. Players spawn
apart in a vast shared floor-world, fight monsters — and each other, or fistbump
instead — racing for the one-way stairway down. Safety exists only in safe rooms.
The signature system: a fully data-driven effects engine whose closed vocabulary of
primitives, tags, and interaction rules lets an **AI crafting system** invent
brand-new items at runtime, validated like any other content.

The game has its own server-authoritative architecture, visual direction, and
engineering standards; the current codebase is the sole implementation.

The current release is **v0.5.2** ([release notes](docs/releases/v0.5.2.md)). It
includes collectible companion pets, shared terrain-aware pathfinding, HUD layout
persistence, and the playability fixes listed in the release notes.

## Austin's F-Bomb Counter

**48**

<!-- f-bomb-count: 48 -->

Estimated from the project conversation history and incremented whenever Austin
uses “fuck” or a clear derivative.

## Documents

| Doc | Purpose |
| --- | --- |
| [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) | **The constitution.** Hard limits, structure rules, definition of done |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Developer-facing terrain, room, lighting, announcement, and content tuning |
| [docs/VISUAL_DIRECTION.md](docs/VISUAL_DIRECTION.md) | **The beauty bar.** Palette, lighting, motion, UI language, acceptance criteria |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | World & floor lifecycle, verticality, PvPvE rules, safe/stretch rooms, social systems |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, package layout, networking model, simulation |
| [docs/EFFECTS.md](docs/EFFECTS.md) | The generic effect model: primitives, statuses, areas, interactions |
| [docs/AI_CRAFTING.md](docs/AI_CRAFTING.md) | AI crafting pipeline: prompt → proposal → validation → shared registry |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS serverless architecture, Terraform layout, cost model |
| [docs/RELEASING.md](docs/RELEASING.md) | Versioning, release notes, validation, tagging, publication, and verification |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Epics and release sequencing |
| [docs/MANUAL_TEST_CHECKLIST.md](docs/MANUAL_TEST_CHECKLIST.md) | Risk-ordered browser and device checks for release candidates |
| [assets/LICENSES.md](assets/LICENSES.md) | Source, license, and attribution records for committed art |

## Getting started

```bash
npm install
npm run dev        # Vite client (LAN-exposed) + local game server together
npm run test       # headless engine + protocol + client tests (vitest)
npm run typecheck  # strict TS across all packages
npm run lint:working-tree # fast lint + folder-size check for changed source
npm run lint       # full-repository standards gate, normally before commit/release
npm run build      # production artifacts: client dist/ + server main.cjs
```

### Branch workflow

Day-to-day work happens on `develop`. Push each commit to `origin/develop` so it
can be reviewed or tested there. `main` is reserved for releases: prepare and
validate a release on `develop`, merge it fast-forward into `main`, then push
`main` and return to `develop`. See [docs/RELEASING.md](docs/RELEASING.md) for
the release/tag/deployment sequence.

**The game is playable**: `npm run dev`, open <http://localhost:5173>, enter a name,
walk into the dungeon. Multiplayer works out of the box — friends on your network
join via `http://<your-LAN-IP>:5173` (if their page loads but nothing else, allow
`node.exe` through the Windows firewall for ports 5173/8787). Everyone currently
spawns within ~50 tiles of each other (friend-testing default; `SPAWN_RADIUS=0`
restores the vast-world scatter).

Each browser tab keeps its own multiplayer identity and resume token. Name and
character defaults remain shared preferences, so opening a second tab does not
take over the first crawler.

### URLs & modes

| URL | What it is |
| --- | --- |
| `http://localhost:5173` | The game (title screen → live multiplayer dungeon) |
| `…/?scene=editor` | **Map editor**: paint finite floor heights `z-1…z8`, void, and doors on a 20×20 grid; right panel renders through the real game pipeline; `import`/`export` round-trip JSON; `collision` overlay; hover inspector |
| `…/?scene=gallery&camera=<name>` | Render showcases: `rooms`, `door`, `corridor`, `chasm`, `sanctuary`, `entities`, `effects`, `combat`, `pillar`, `platform`, `solidmass` (+ `&hud=1`, `&debugTerrain=1`) |
| `…/?touch=1` | Force mobile touch controls on desktop (joystick + action buttons) |
| `…/?server=ws://host:port` | Point the client at a specific game server |
| `…/?debug=1` | Dev-only: exposes the Phaser game for perf probes |

### Controls

WASD/arrows move · Space jumps · mouse aims, click attacks · `R` picks up ·
number keys `1–9` use hotbar · `E` performs the contextual action (including
adopting a pet or holding to revive) · `Enter` chats. In development,
`/god` toggles full heal, no damage/knockback, 4× outgoing damage, and unlimited
stamina; `/tp x y` teleports. Touch devices get a floating joystick plus
attack/jump/use buttons automatically. Inventory is available with `I` or `Tab`;
on mobile, opening it does not focus the filter or summon the keyboard. See
[docs/HUD_OS.md](docs/HUD_OS.md) for layout editing and persistence.

The first nearby crawler to press `E` on an unclaimed pet adopts it; each crawler
can have only one pet. Several pets are seeded around floor 1, with one about 20
tiles from the shared spawn area. Pets follow,
drift while their owner idles, use bounded terrain-aware pathfinding to handle
ledges and stairs, and teleport back after a long separation. Pet nameplates show
the pet name and a smaller owner line.

### Server environment

`GAME_PORT` (8787 dev / 8081 prod) · `WORLD_SEED` (any string) · `SPAWN_RADIUS`
(tiles; `0`/`off` = vast scatter; default 50 for playtests) · `DEBUG_COMMANDS=0`
disables `/god`+`/tp` (always off under `NODE_ENV=production`) · `STORE_FILE`
(player persistence path, `none` to disable) · `CLUSTER_SPAWNS=1` (test-grid spawns) ·
`VOID_TERRAIN=1` (default) enables explicit VOID generation, infinite collision,
and its flat backdrop/boundary rendering. `VOID_TERRAIN=0` restores the complete
finite-terrain mode: raised showcase platforms, finite chasm and room exteriors,
ordinary wall faces/occlusion, and no VOID geometry. This startup-only,
server-authoritative mode requires a server restart and is sent to every client;
there is intentionally no client URL override that could disagree with collision.
Players whose crawler name contains `josiah` or `ellie` (case-insensitive) receive
the temporary playtest handicap: 0.3× incoming damage and 3× outgoing damage.
The grant is isolated behind the same interface planned for future admin grants.

Useful `camera` values include `door`, `occlusion`, `pillar`, `solidmass`,
`landmark`, `chasm`, and `sanctuary`.

The gallery HUD reports the tile under the mouse, its logical surface type and height,
and any projected wall facade with its source tile and vertical span. Use this readout
when reporting terrain/rendering issues so visual cells can be distinguished from the
raised surface that owns them.

## Status

**v0.5.2 is playable:** worldgen, multiplayer, movement/combat, effects, items,
safe rooms, parties/chat, Three.js parity foundations, companion pets, shared
navigation, and editable HUD layouts are shipped. AI crafting, complete mobile
HUD ergonomics, moderation, and final art/content polish remain on the roadmap.
