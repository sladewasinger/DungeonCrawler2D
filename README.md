# Dungeon Crawler 2D

A mobile-first, server-authoritative 2D action-RPG & light-survival overworld built on **PixiJS v8 (WebGL2)** with a **Lush HD-Pixel Atmosphere**, deterministic infinite `32×32` terrain chunks, synced Day/Night clock, true 36-slot inventory & bottom hotbar, crafting, and multiplayer WebSocket co-op.

The long-term signature architecture keeps a flexible, composable effects system in `@dc2d/engine` so AI-crafted items, status interactions, and custom abilities can be invented and validated safely at runtime (see [docs/ROADMAP.md](docs/ROADMAP.md)).

**Current version**: **v0.11.10** (Mobile WebGL2 VRAM Optimization & Compact 2-Row Touch Controls, Frontier 5-Biome Overworld, 20 POIs & Shrines, Proximity Chat, and Stage 1/2 Verification & Contract Guardrails — shipped on `develop` -> `main`, deployed at <https://dungeoncrawl2d.austinwasinger.com>). Legacy pre-rewrite code is preserved on branch `archive/v1`.

## Austin's F-Bomb Counter

**80**

<!-- f-bomb-count: 80 -->

Estimated from the project conversation history and incremented whenever Austin
uses “fuck” or a clear derivative.

## Documentation

Repo guides and the 5 workspace entry points live here (each package `README.md` indexes every colocated `src/**/README.md` inside that package):

| Location | Covers |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Master phased roadmap (`overworld`, Phases 0–13), DCC floor loop & AI-crafting vision |
| [docs/VERIFICATION-GATE.md](docs/VERIFICATION-GATE.md) | Deterministic 4-layer Verification, Completeness (`REQ-*`), `ai:loop`, `SimScenario`, `verify:docs` & Quality Gate |
| [docs/LESSONS.md](docs/LESSONS.md) | Durable engineering pitfalls and repository constraints |
| [docs/FLY-DEPLOYMENT.md](docs/FLY-DEPLOYMENT.md) | Fly.io `dfw` game server setup, `fly` CLI, custom WSS DNS/TLS, `FLY_API_TOKEN`, and ops runbook |
| [infra/README.md](infra/README.md) | Terraform AWS S3 + CloudFront + ACM + GitHub OIDC static frontend stack & legacy EC2 notes |
| [tools/sprite-studio/README.md](tools/sprite-studio/README.md) | Blender EEVEE -> lossless WebP creature & player sprite pipeline CLI |
| [packages/contracts/README.md](packages/contracts/README.md) | Tier-1 zero-dependency pure domain contracts, const-tuples (`GroundKind`/`PropKind`), and unions |
| [packages/content/README.md](packages/content/README.md) | Tier-2 declarative catalogs: `76` items, `18` prefixes, recipes, biomes, and `PROP_SPECS` |
| [packages/engine/README.md](packages/engine/README.md) | Tier-3 platform-free simulation rules, chunks, sliding collision, combat, inventory, Day/Night, Zod protocol |
| [packages/game-server/README.md](packages/game-server/README.md) | Tier-4 authoritative 20 Hz simulation loop, hardened WebSocket `/health` + game server, `SimScenario` |
| [packages/client/README.md](packages/client/README.md) | Tier-4 PixiJS v8 WebGL2 client, prediction, input, shaders, Sound Studio, Sandbox, and HUD |

## Getting started

Requires **Node.js `>= 22`**.

```bash
npm install
npm run dev               # Starts @dc2d/game-server (watch on 127.0.0.1:4000) + Vite client (127.0.0.1:5173)
npm run dev:lan           # Opt-in 0.0.0.0 LAN binding for phone testing on local Wi-Fi
npm run typecheck         # Strict TypeScript check across all 5 workspaces + tests/ & e2e/ (tsconfig.qa.json)
npm run lint:working-tree # Fast ESLint + folder-size check for changed/untracked files
npm run lint              # Full-repository ESLint + folder-size & colocated-README gate
npm test                  # Headless Vitest unit, sim, integration, and fast-check property suites
npm run build             # Production build: packages/game-server/dist/main.cjs + packages/client/dist/
npm run preview-prod      # Serve frozen built client (:4173) + built server (:4174) with zero watchers
npm run ai:loop           # <4s incremental AI verification loop -> .verify-reports/ai-feedback.json
npm run verify:content    # Live TS catalog, icon painter, held gear, PropSpec mount, and public asset audit
npm run verify:docs       # Zero-dep Markdown link, path reference, README index, and script-doc parity check
npm run verify:e2e        # Playwright Desktop (1280x720) & Mobile (390x844) E2E + WebGL entropy & HUD overlap
npm run verify:spec       # Layer-1 REQ-P<N>-<NN> traceability check against JSON test reports
npm run verify:phase      # Full 4-layer release gate across all checks
npm run ai:gate           # Alias for verify:phase emitting .verify-reports/ai-feedback.json
npm run sprite:bake       # Re-bake Blender creature sheets -> lossless WebP & sprite-manifest.json
npm run player:bake       # Re-bake Blender 3D Hero layers, sockets, and bow overlay -> player-rig.json
node tools/smoke-production.mjs http://localhost:5173 # Smoke-test HTML + /ws protocol against a running server
```

### Local network (LAN) & phone testing

`npm run dev:lan` exposes Vite and the game server on all network interfaces (`0.0.0.0`, default port `5173`, auto-incrementing if busy) and proxies `/ws` to `http://127.0.0.1:4000` so browsers and phones only need one HTTP URL (`npm run dev` binds to `127.0.0.1` by default):

1. Check the `Network: http://<your-LAN-IP>:<port>/` line printed by Vite when `npm run dev:lan` starts.
2. Open that URL on your phone **including the explicit `http://` prefix and colon before the port** (for example `http://192.168.50.60:5173/`).
3. If your phone times out on Windows, ensure your Wi-Fi/Ethernet network is set to **Private** (or allow inbound TCP on Vite's dev port in Windows Defender Firewall).
4. If the backend WebSocket server is unavailable, the client seamlessly runs a deterministic local offline preview (`Local` status pill).

### Controls

- **Movement, Stealth & Jump**:
  - **Desktop**: `W A S D` or Arrow keys walk (`Shift` held to sprint/run); `C` toggles or holds crouch sneak (configurable in Settings); `Space` jumps and lets you leap off raised cliffs; scroll wheel or Settings `−`/`+` zoom buttons scale camera zoom (`1.5×–6.0×`).
  - **Touch / Mobile**: Touch outside HUD panels for the floating analog thumbstick (inner drag walks, rim runs), tap `JUMP` to leap, and tap `SNEAK` to toggle crouch.
- **Combat, Distractions, Shield & Healing**:
  - **Desktop**: Left-click swings melee combos or consumes food/salves/potions; hold-and-release Left-click draws & looses bows; hold Right-click with an off-hand shield to block (`220ms` timed **Parry** -> `1.75×` riposte); `Ctrl` dodge-rolls; `E` interacts (chests, shrines, waystones, braziers, loot); `X` tosses a distraction pebble/stone.
  - **Touch / Mobile**: Tap `ATK` for melee/heal or hold-and-drag `ATK` for 360° bow aim; tap `ROLL` to dodge; hold `BLOCK` with a shield equipped.
- **Inventory, Chat, Character & Hotbar**:
  - **`1`–`9` or tap/click bottom hotbar**: Select active item slot (`0..8`), plus **`M`** Overworld Map overlay, **`F`** Lantern toggle, and **`Enter`** Proximity Chat input (`16`-tile normal / `34`-tile `[Shout]`). Press `Q` (`Delete`/`Backspace`) or drag outside HUD panels to drop items.
  - **`Tab` or `Bag` button**: Open minimalist Inventory (`27`-slot Backpack + `5` Armor/Shield slots + live Stats + **`Craft`** header button).
  - **`H` or `Hero` button**: Open Hero Appearance creator (name, `Male`/`Female`, skin, eyes, hair style, `18` hair colors/gradients).
  - **`Esc`**: Close open panels.
- **Audio, Telemetry & Debug**:
  - **Settings gear (`Esc` / top-right)**: `Music`/`SFX` sliders & mute, `Show FPS`, `Show Ping`, camera zoom, `Quality`, `Gore`, `Auto-Aim`, and `Crouch Mode` (`Toggle`/`Hold`).
  - **`?debug=1` / `?admin=1`**: Reveals localhost debug toolbar pills, `Atmosphere ▾`, and hitbox overlay toggles (server admin requires `ADMIN_TOKEN` in production).

## Configuration reference

| Environment variable | Default and meaning |
| --- | --- |
| `GAME_PORT` | `4000` (fallback `PORT`, then `4000`); WebSocket/HTTP server port (`fly.toml` production uses `8080`). |
| `GAME_HOST` | `0.0.0.0`; bind host for `@dc2d/game-server`. |
| `WORLD_SEED` | `1337`; numeric world seed parsed on server startup. |
| `WORLD_SAVE_PATH` | `data/world-save.json` (`none` disables persistence); Fly.io mounts `/data/world-save.json` on `world_data`. |
| `ADMIN_TOKEN` | Shared secret enabling authenticated `/admin` & slash commands in production (Fly secret / AWS SSM). |
| `DEBUG_COMMANDS` | Set to `0` to disable dev debug commands explicitly. |
| `ALLOW_OPEN_DEV_ADMIN` | Unset (fail-closed); set `1` only locally in non-production when testing without `ADMIN_TOKEN`. |
| `VITE_GAME_WS_URL` | Unset (uses same-origin `/ws` proxy); explicit WebSocket URL override for Vite client builds (`wss://ws.dungeoncrawl2d.austinwasinger.com/ws` in CI). |
| `PREVIEW_PORT` | `4173`; static Vite preview HTTP port used by `npm run preview-prod`. |
| `PREVIEW_GAME_PORT` | `4174`; frozen built game-server port spawned by `npm run preview-prod`. |

## Branch & release workflow

- `main` is a protected branch and only accepts Pull Requests opened from `develop` (no direct pushes or feature-branch PRs targeting `main`).
- Active work happens on short-lived feature or fix branches cut from `develop`, which are verified (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and the Verification Gate in [docs/VERIFICATION-GATE.md](docs/VERIFICATION-GATE.md)) and merged back into `develop`.
- When `develop` is ready to ship, open a Pull Request from `develop` into `main` with a proper release title (`release(vX.Y.Z): <Release Title>`).
- Completing/merging that release PR into `main` triggers [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml) to build, publish the static client to S3/CloudFront, deploy `@dc2d/game-server` to Fly.io `dfw` (when `FLY_API_TOKEN` is configured; see [docs/FLY-DEPLOYMENT.md](docs/FLY-DEPLOYMENT.md)), and smoke-test `https://dungeoncrawl2d.austinwasinger.com`.
