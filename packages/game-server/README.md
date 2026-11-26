# `@dc2d/game-server`

Tier-4 authoritative 20 Hz Node + `ws` multiplayer game server built over `@dc2d/contracts`, `@dc2d/content`, and `@dc2d/engine`:

## Architecture & Directories
| Directory | Covers |
| --- | --- |
| [`src/net/`](./src/net/README.md) | WebSocket `/health` & game server, 20 Hz coalesced broadcasts, rate/origin limits, session/admin auth, AOI redaction |
| [`src/sim/`](./src/sim/README.md) | `WorldSim` loop, combat, inventory, proximity chat, training dummies |
| [`src/sim/frontier/`](./src/sim/frontier/README.md) | Shrines, waystones, brazier puzzles, biome/POI discovery tracking, and admin slash commands |
| [`src/sim/wildlife/`](./src/sim/wildlife/README.md) | Living wildlife/POI ecology, scent trails, wolf packs, swept projectiles, and seeded loot |
| `src/sim/survival/`, `src/sim/webs/` | Node depletion, camp building, JSON persistence flushes, and dynamic cloth spider webs (see [`src/sim/README.md`](./src/sim/README.md)) |
| [`src/testing/`](./src/testing/README.md) | Headless deterministic `SimScenario` harness for multi-tick & persistence-reboot tests |

Production builds bundle to `dist/main.cjs` for Fly.io `dfw` deployment (see [`docs/FLY-DEPLOYMENT.md`](../../docs/FLY-DEPLOYMENT.md)).
