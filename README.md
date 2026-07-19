# Dungeon Crawler 2D — v2

A browser-based, top-down 2D **real-time PvPvE multiplayer** dungeon crawler with a
full height axis, tonally inspired by the Dungeon Crawler Carl series. Players spawn
apart in a vast shared floor-world, fight monsters — and each other, or fistbump
instead — racing for the one-way stairway down. Safety exists only in safe rooms.
The signature system: a fully data-driven effects engine whose closed vocabulary of
primitives, tags, and interaction rules lets an **AI crafting system** invent
brand-new items at runtime, validated like any other content.

This is the **v2 rebuild** of the original prototype (frozen in [reference/](reference/README.md)):
same design, same server-authoritative architecture, rebuilt to a real visual and
engineering bar.

## Documents

| Doc | Purpose |
| --- | --- |
| [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) | **The constitution.** Hard limits, structure rules, definition of done |
| [docs/VISUAL_DIRECTION.md](docs/VISUAL_DIRECTION.md) | **The beauty bar.** Palette, lighting, motion, UI language, acceptance criteria |
| [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) | World & floor lifecycle, verticality, PvPvE rules, safe/stretch rooms, social systems |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Tech stack, package layout, networking model, simulation |
| [docs/EFFECTS.md](docs/EFFECTS.md) | The generic effect model: primitives, statuses, areas, interactions |
| [docs/AI_CRAFTING.md](docs/AI_CRAFTING.md) | AI crafting pipeline: prompt → proposal → validation → shared registry |
| [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | AWS serverless architecture, Terraform layout, cost model |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Epics and release sequencing |

## Getting started

```bash
npm install
npm run dev        # Vite client (LAN-exposed) + local game server together
npm run test       # headless engine + protocol + client tests (vitest)
npm run typecheck  # strict TS across all packages
npm run lint       # standards enforcement (200-line cap, boundaries)
npm run build      # production artifacts: client dist/ + server main.cjs
```

**The game is playable**: `npm run dev`, open <http://localhost:5173>, enter a name,
walk into the dungeon. Multiplayer works out of the box — friends on your network
join via `http://<your-LAN-IP>:5173` (if their page loads but nothing else, allow
`node.exe` through the Windows firewall for ports 5173/8787). Everyone currently
spawns within ~50 tiles of each other (friend-testing default; `SPAWN_RADIUS=0`
restores the vast-world scatter).

### URLs & modes

| URL | What it is |
| --- | --- |
| `http://localhost:5173` | The game (title screen → live multiplayer dungeon) |
| `…/?scene=editor` | **Map editor**: paint heights `z-1…z8`, rock, doors on a 20×20 grid; right panel renders through the real game pipeline; `import`/`export` round-trip JSON; `collision` overlay; hover inspector |
| `…/?scene=gallery&camera=<name>` | Render showcases: `rooms`, `door`, `corridor`, `chasm`, `sanctuary`, `entities`, `effects`, `combat`, `pillar`, `platform`, `solidmass` (+ `&hud=1`, `&debugTerrain=1`) |
| `…/?touch=1` | Force mobile touch controls on desktop (joystick + action buttons) |
| `…/?server=ws://host:port` | Point the client at a specific game server |
| `…/?debug=1` | Dev-only: exposes the Phaser game for perf probes |

### Controls

WASD/arrows move · Space jumps · mouse aims, click attacks · `R` picks up ·
number keys `1–9` use hotbar · `Enter` chats (`/god`, `/tp x y` in dev builds only) ·
touch devices get a floating joystick + attack/jump/use buttons automatically.
Inventory window (`I`/`Tab`) is landing next — see [docs/HUD_OS.md](docs/HUD_OS.md).

### Server environment

`GAME_PORT` (8787 dev / 8081 prod) · `WORLD_SEED` (any string) · `SPAWN_RADIUS`
(tiles; `0`/`off` = vast scatter; default 50 for playtests) · `DEBUG_COMMANDS=0`
disables `/god`+`/tp` (always off under `NODE_ENV=production`) · `STORE_FILE`
(player persistence path, `none` to disable) · `CLUSTER_SPAWNS=1` (test-grid spawns).

Useful `camera` values include `door`, `occlusion`, `pillar`, `solidmass`,
`landmark`, `chasm`, and `sanctuary`.

The gallery HUD reports the tile under the mouse, its logical surface type and height,
and any projected wall facade with its source tile and vertical span. Use this readout
when reporting terrain/rendering issues so visual cells can be distinguished from the
raised surface that owns them.

## Status

**v2 core slice in progress:** worldgen, multiplayer, movement/combat, effects
engine, items, and safe rooms at the new visual bar. Parties/chat/AI crafting are
architected (see docs) and land next.
