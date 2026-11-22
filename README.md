# Dungeon Crawler 2D

A mobile-first, server-authoritative 2D action-RPG & light-survival overworld built on **PixiJS v8 (WebGL2)** with a **Lush HD-Pixel Atmosphere**, deterministic infinite `32×32` terrain chunks, synced Day/Night clock, true 36-slot inventory & bottom hotbar, crafting, and multiplayer WebSocket co-op.

The long-term signature architecture keeps a flexible, composable effects system in `@dc2d/engine` so AI-crafted items, status interactions, and custom abilities can be invented and validated safely at runtime (see [docs/ROADMAP.md](docs/ROADMAP.md)).

**Current version**: **v0.10.0** (Phase 2 shipped on `overworld` -> `main`, deployed at <https://dungeoncrawl2d.austinwasinger.com>). Legacy pre-rewrite code is preserved on branch `archive/v1`.

## Austin's F-Bomb Counter

**79**

<!-- f-bomb-count: 79 -->

Estimated from the project conversation history and incremented whenever Austin
uses “fuck” or a clear derivative.

## Documentation

Documentation lives next to the code it describes:

| Location | Covers |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Master phased roadmap (`overworld`, Phases 0–6) and AI-crafting effects vision |
| [docs/LESSONS.md](docs/LESSONS.md) | Durable engineering pitfalls and repository constraints |
| [packages/engine/README.md](packages/engine/README.md) | Platform-free simulation core, noise, collision, Day/Night, Zod wire protocol |
| [packages/engine/src/world/README.md](packages/engine/src/world/README.md) | Deterministic `32×32` chunk generator, elevation, and spatial collision |
| [packages/engine/src/inventory/README.md](packages/engine/src/inventory/README.md) | True 36-slot inventory rules, `maxStack=1` gear, armor stats, crafting validation |
| [packages/content/README.md](packages/content/README.md) | Authoritative item catalog, recipes, light palettes, quality presets |
| [packages/game-server/README.md](packages/game-server/README.md) | Authoritative 20 Hz simulation loop and WebSocket `/health` + game server |
| [packages/client/README.md](packages/client/README.md) | PixiJS v8 WebGL2 client, prediction, input, and HUD |
| [packages/client/src/render/README.md](packages/client/src/render/README.md) | Terrain/prop texture builders, world layers, and shader atmosphere pipeline |
| [packages/client/src/ui/hud/README.md](packages/client/src/ui/hud/README.md) | Larger bottom hotbar, minimalist inventory modal, crafting panel, pointer drag/drop |
| [infra/README.md](infra/README.md) | Terraform AWS deployment, CloudFront, SSM, and EC2 server setup |

## Getting started

Requires **Node.js `>= 22`**.

```bash
npm install
npm run dev               # Starts @dc2d/game-server (watch on :4000) + Vite client (--host 0.0.0.0)
npm run typecheck         # Strict TypeScript check across all 4 workspaces
npm run lint:working-tree # Fast ESLint + folder-size check for changed/untracked files
npm run lint              # Full-repository ESLint + folder-size standards gate
npm test                  # Vitest suite across @dc2d/engine, @dc2d/game-server, and @dc2d/client
npm run build             # Production build: packages/game-server/dist/main.cjs + packages/client/dist/
node tools/smoke-production.mjs http://localhost:5173 # Smoke-test HTML + /ws protocol against a running server
```

### Local network (LAN) & phone testing

`npm run dev` exposes Vite on all network interfaces (`--host 0.0.0.0`, default port `5173`, auto-incrementing if busy) and proxies `/ws` to `http://127.0.0.1:4000` so browsers and phones only need one HTTP URL:

1. Check the `Network: http://<your-LAN-IP>:<port>/` line printed by Vite when `npm run dev` starts.
2. Open that URL on your phone **including the explicit `http://` prefix and colon before the port** (for example `http://192.168.50.60:5173/`). Omitting `http://` can trigger mobile auto-HTTPS (`ERR_SSL_PROTOCOL_ERROR`).
3. If your phone times out on Windows, ensure your Wi-Fi/Ethernet network is set to **Private** (or allow inbound TCP on Vite's dev port in Windows Defender Firewall).
4. If the backend WebSocket server is unavailable, the client seamlessly runs a deterministic local offline preview (`Local` status pill).

### Controls

- **Movement**:
  - **Desktop**: `W A S D` or Arrow keys move; scroll wheel zooms camera.
  - **Touch / Mobile**: Touch anywhere outside HUD panels to summon the floating analog thumbstick (mouse clicks do not trigger the mobile joystick).
- **Inventory & Hotbar**:
  - **`1`–`9` or tap/click bottom hotbar**: Select active item slot (`0..8`, rendered in the Knight's hand).
  - **`Tab` or `Bag` button**: Open minimalist Inventory (`27`-slot Backpack + `4` Armor slots + Stats). Drag items directly (or tap source -> tap target) between Backpack, Armor, and the always-visible bottom hotbar.
  - **`C` or `Craft` button**: Open Crafting panel (craftable recipes only by default, with optional `Show Locked` toggle).
  - **`Esc`**: Close open panels.
- **Atmosphere & Fullscreen**:
  - **`F` or `Torch` button**: Toggle player torch.
  - **`FX` button**: Cycle quality presets (`High`, `Balanced`, `Performance`).
  - **`FS` button**: Manual fullscreen toggle (touch devices also auto-request fullscreen on first touch gesture).
  - **`Atmosphere ▾`**: Preview `Dawn`, `Day`, `Golden Hour`, `Dusk`, and `Night` lighting or scrub the Day/Night clock.

## Configuration reference

| Environment variable | Default and meaning |
| --- | --- |
| `GAME_PORT` | `4000` (fallback `PORT`, then `4000`); WebSocket/HTTP server port (`infra/` production systemd uses `8081`). |
| `GAME_HOST` | `0.0.0.0`; bind host for `@dc2d/game-server`. |
| `WORLD_SEED` | `1337`; numeric world seed parsed on server startup. |
| `VITE_GAME_WS_URL` | Unset (uses `ws(s)://<location.host>/ws` same-origin proxy); optional explicit WebSocket URL override for Vite client builds. |

## Branch & release workflow

- Active development happens on `overworld`.
- After completing a phase and verifying tests, linting, builds, and live browser checks, merge/promote the verified state through `develop` into `main` and push (`git push origin overworld develop main`).
- Pushing `main` triggers [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml) to build, publish to S3/EC2/CloudFront, and smoke-test `https://dungeoncrawl2d.austinwasinger.com`.
