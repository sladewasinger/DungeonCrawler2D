# Dungeon Crawler 2D

A mobile-first, server-authoritative 2D action-RPG & light-survival overworld built on **PixiJS v8 (WebGL2)** with a **Lush HD-Pixel Atmosphere**, deterministic infinite `32×32` terrain chunks, synced Day/Night clock, true 36-slot inventory & bottom hotbar, crafting, and multiplayer WebSocket co-op.

The long-term signature architecture keeps a flexible, composable effects system in `@dc2d/engine` so AI-crafted items, status interactions, and custom abilities can be invented and validated safely at runtime (see [docs/ROADMAP.md](docs/ROADMAP.md)).

**Current version**: **v0.11.3** (Phase 4 mini-release — 3D Hero Rig & Gait Sync, Bespoke HD-Pixel Gore & Corpse Sorting, Organic Vocal-Tract Creature Audio + Live Sound Studio, Default Starter Armor, & Initial Overhead AI Indicators — shipped on `overworld` -> `develop` -> `main`, deployed at <https://dungeoncrawl2d.austinwasinger.com>). Legacy pre-rewrite code is preserved on branch `archive/v1`.

## Austin's F-Bomb Counter

**79**

<!-- f-bomb-count: 79 -->

Estimated from the project conversation history and incremented whenever Austin
uses “fuck” or a clear derivative.

## Documentation

Documentation lives next to the code it describes:

| Location | Covers |
| --- | --- |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Master phased roadmap (`overworld`, Phases 0–13), DCC floor loop & AI-crafting vision |
| [docs/LESSONS.md](docs/LESSONS.md) | Durable engineering pitfalls and repository constraints |
| [packages/engine/README.md](packages/engine/README.md) | Platform-free simulation core, noise, collision, Day/Night, Zod wire protocol |
| [packages/engine/src/world/README.md](packages/engine/src/world/README.md) | Deterministic `32×32` chunk generator, elevation, and spatial collision |
| [packages/engine/src/combat/README.md](packages/engine/src/combat/README.md) | Pure combat math, `COMBAT_TUNING` levers, sanctuary rules, and `GoreStyle × GoreSubstance` |
| [packages/engine/src/inventory/README.md](packages/engine/src/inventory/README.md) | True 36-slot inventory rules, `maxStack=1` gear, `5` armor/shield stats, crafting validation |
| [packages/engine/src/character/README.md](packages/engine/src/character/README.md) | Modular character customization schemas and validation |
| [packages/content/README.md](packages/content/README.md) | Authoritative item catalog, recipes, light palettes, quality presets |
| [packages/game-server/README.md](packages/game-server/README.md) | Authoritative 20 Hz simulation loop and WebSocket `/health` + game server |
| [packages/client/README.md](packages/client/README.md) | PixiJS v8 WebGL2 client, prediction, input, and HUD |
| [packages/client/src/audio/README.md](packages/client/src/audio/README.md) | Mobile-unlocked Hybrid Web Audio mixer, `AUDIO_TUNING` levers, spatial campfire/river & footsteps |
| [packages/client/src/render/combat/README.md](packages/client/src/render/combat/README.md) | Actor-tracked progressive sword/torch smears, `combatVisualTuning`, 2.5D gore decals, wildlife & POI chests |
| [packages/client/src/ui/title/README.md](packages/client/src/ui/title/README.md) | Pre-game Title Screen with Name entry, live Hero Creator, and localhost-only Sound Studio link |
| [packages/client/src/soundStudio/README.md](packages/client/src/soundStudio/README.md) | Standalone local multi-track Web Audio synthesizer, live oscilloscope/FFT visualizer, and `.WAV` exporter |
| [packages/client/src/render/character/README.md](packages/client/src/render/character/README.md) | Layered `32×32` (`0.75×` world-scale) 4-directional paper-doll compositor, Hybrid Weapon Grip Socket arm rig, & LRU texture cache |
| [packages/client/src/render/README.md](packages/client/src/render/README.md) | Terrain/prop texture builders, world layers, and shader atmosphere pipeline |
| [packages/client/src/ui/hud/README.md](packages/client/src/ui/hud/README.md) | Clean public HUD (`?debug=1` admin gate), hotbar Lantern, Vitals bar, 5-slot Inventory/Craft swap |
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
npm run preview-prod      # Serve frozen built client (:4173) + built server (:4174) with zero watchers
node tools/smoke-production.mjs http://localhost:5173 # Smoke-test HTML + /ws protocol against a running server
```

### Local network (LAN) & phone testing

`npm run dev` exposes Vite on all network interfaces (`--host 0.0.0.0`, default port `5173`, auto-incrementing if busy) and proxies `/ws` to `http://127.0.0.1:4000` so browsers and phones only need one HTTP URL:

1. Check the `Network: http://<your-LAN-IP>:<port>/` line printed by Vite when `npm run dev` starts.
2. Open that URL on your phone **including the explicit `http://` prefix and colon before the port** (for example `http://192.168.50.60:5173/`). Omitting `http://` can trigger mobile auto-HTTPS (`ERR_SSL_PROTOCOL_ERROR`).
3. If your phone times out on Windows, ensure your Wi-Fi/Ethernet network is set to **Private** (or allow inbound TCP on Vite's dev port in Windows Defender Firewall).
4. If the backend WebSocket server is unavailable, the client seamlessly runs a deterministic local offline preview (`Local` status pill).

### Controls

- **Movement, Jump & Zoom**:
  - **Desktop**: `W A S D` or Arrow keys walk cleanly (`Shift` held to sprint/run); `Space` jumps and lets you leap off raised cliffs; scroll wheel or top-right `−`/`+` buttons adjust camera zoom.
  - **Touch / Mobile**: Touch anywhere outside HUD panels to summon the floating analog thumbstick (gentle inner drags walk slowly; pushing out to the rim runs at full speed), tap `JUMP` to leap across terrain or off cliffs, and use top-right `−`/`+` buttons to adjust camera zoom.
- **Combat, Shield & Healing**:
  - **Desktop**: Left-click to swing melee 3-hit combos (`Sword`, `Axe`, `Pickaxe`, `Torch`) or heal (`Bandage`, `Cooked Meat`); hold-and-release Left-click to draw & loose the `Hunter Bow`; hold Right-click with an off-hand shield equipped to block (time it within `220ms` of an attack to **Parry** and stagger attackers); `Ctrl` to dodge-roll; `E` to interact.
  - **Touch / Mobile**: Tap `ATK` for melee/heal or hold-and-drag `ATK` for 360° aimed bow shots; tap `ROLL` to dodge; hold `BLOCK` when wearing a shield.
- **Inventory, Character & Hotbar**:
  - **`1`–`9` or tap/click bottom hotbar**: Select active item slot (`0..8`, rendered in the hero's hand), plus the built-in glowing **Lantern** toggle icon (`F` shortcut) right beside slot 9 (auto-clips to waist with bow or shield).
  - **`Tab` or `Bag` button**: Open minimalist Inventory (`27`-slot Backpack + `5` Armor/Shield slots + live Stats + **`Craft`** header button). Equipped gear (`Leather Hood`, `Tunic`, `Leggings`, `Boots`, `Wooden Shield`) renders visibly on your character for all players; drag items or tap-to-swap between Backpack, Armor/Shield, and bottom hotbar.
  - **`H` or `Hero` button**: Open Hero Appearance creator (name, `Male`/`Female` body silhouette, skin tone, eye color, hair style, and hair pigment; auto-saved in `localStorage` and synced over WebSocket).
  - **`C` or `Bag -> Craft`**: Open Crafting panel (craftable recipes only by default, with optional `Show Locked` toggle and **`Bag`** header button back).
  - **`Esc`**: Close open panels.
- **Audio, Debug Toolbar & Fullscreen**:
  - **`Audio` button**: Adjust independent `Music` and `SFX` sliders or `Mute All`. Tuning levers live in `packages/client/src/audio/audioTuning.ts`, `packages/client/src/render/combat/combatVisualTuning.ts`, and `packages/engine/src/combat/combatRules.ts`.
  - **`FS` & `−`/`+` buttons**: Manual fullscreen toggle (touch devices also auto-request fullscreen on first touch gesture) and camera zoom.
  - **`?debug=1` / `?admin=1`**: Reveals the admin status pill (`Server · Day`), `FX` quality cycler, and `Atmosphere ▾` clock/preset drawer.

## Configuration reference

| Environment variable | Default and meaning |
| --- | --- |
| `GAME_PORT` | `4000` (fallback `PORT`, then `4000`); WebSocket/HTTP server port (`infra/` production systemd uses `8081`). |
| `GAME_HOST` | `0.0.0.0`; bind host for `@dc2d/game-server`. |
| `WORLD_SEED` | `1337`; numeric world seed parsed on server startup. |
| `VITE_GAME_WS_URL` | Unset (uses `ws(s)://<location.host>/ws` same-origin proxy); optional explicit WebSocket URL override for Vite client builds. |
| `PREVIEW_PORT` | `4173`; static Vite preview HTTP port used by `npm run preview-prod`. |
| `PREVIEW_GAME_PORT` | `4174`; frozen built game-server port spawned by `npm run preview-prod`. |

## Branch & release workflow

- Active development happens on `overworld` and is merged cleanly into `develop`.
- When a phase is verified (tests, lint, build, and live browser checks), open and merge a versioned release PR from `develop` into `main` with a clear release title (`release: vX.Y.Z — <Release Title>`).
- Merging into `main` triggers [`.github/workflows/deploy-production.yml`](.github/workflows/deploy-production.yml) to build, publish to S3/EC2/CloudFront, and smoke-test `https://dungeoncrawl2d.austinwasinger.com`.
