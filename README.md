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

The current release is **v0.8.0** ([release notes](docs/releases/v0.8.0.md)).
It makes combat clearer, gives companions more personality, adds a live-watch
mode, and expands the tools used to operate and debug the dungeon.

## Austin's F-Bomb Counter

**57**

<!-- f-bomb-count: 57 -->

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
spawns within 2 tiles of each other (friend-testing default; `SPAWN_RADIUS=0`
restores the vast-world scatter).

Local development also exposes two test destinations on the title screen. The
Sandbox is the existing enemy-free traversal course. The Combat Sandbox is a
flat, enclosed arena containing the content catalog, elemental fixtures, and
training targets; players in either local sandbox receive in-game admin tools
automatically.

Each browser tab keeps its own multiplayer identity and resume token. Name and
character defaults remain shared preferences, so opening a second tab does not
take over the first crawler.

### Browser startup modes and URL flags

Query parameters combine with `&`, for example
`http://localhost:5173/?touch=1&server=ws://localhost:8787`.

| Route or flag | Effect |
| --- | --- |
| `/` | Phaser game: title screen, then the live multiplayer dungeon. |
| `/admin` or `/?admin=1` | Admin portal. This route takes precedence over renderer and scene flags. |
| `/spectate` or `/?spectate=1` | Read-only live spectator using the full game renderer. The HUD is visible by default. |
| `/spectate?mode=track` | Start by following the selected player. The default spectator mode is an untethered free camera. |
| `/spectate?target=<player-id>` | Start the spectator on a specific connected player when that server-issued player ID is known. |
| `/spectate?hud=0` | Hide the read-only spectator HUD. The admin portal uses this by default and provides its own HUD switch. |
| `/spectate?embed=admin` | Internal same-origin admin embed layout. Use the admin portal instead of setting this by hand. |
| `?renderer=three` | Experimental Three.js first-person client; Phaser is the default. |
| `?scene=editor` | Phaser map editor. Ignored when `renderer=three` selects the Three.js client first. |
| `?testbench=character_vfx` | Character-effects testbench. It takes precedence over `scene=editor`. |
| `?server=ws://host:port` | Override the WebSocket endpoint. Without it, local pages use port 8787 and deployed pages use same-host `/ws`. |
| `?touch=1` | Force touch controls on desktop. |
| `?lighting=classic` or `?lighting=toon` | Override the saved lighting choice for this page load. |
| `?vo=<degrees>` | Set the initial Phaser view orientation. Use a multiple of 90; values wrap to 0–359. |
| `?terrain4Debug=1` | Load and display the compatibility terrain-debug atlas. |
| `?debug=1` | Development builds only: expose `window.__game` and, in the game, `window.__dc2d`. It does not enable movement tracing. |
| `?seed=<number>` | Three.js mode only: generated-world seed; default 228182761. |
| `?floor=<number>` | Three.js mode only: generated-world floor; default 1. |
| `?viewDistance=18`, `26`, or `34` | Three.js mode only: terrain view radius; default 18. Invalid values use 18. |

The fake-HUD screenshot harness also reads `?hud=1` (normal), `?hud=death`, and
the optional `?inventory=1`, `?craft=1`, `?stash=1`, and `?boss=1` panel aids.
They only affect a preview `HudScene`; they do not replace live player state.
Static asset URLs receive an internal `?build=<git-sha>` cache key automatically;
`build` is generated by the client and should not be set by hand.

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

## Configuration reference

Server settings are startup-only and require a restart. Values shown here are local
defaults unless noted otherwise. Idle timeout and event retention accept only positive
values and otherwise use their defaults; `VOID_TERRAIN` rejects unrecognized values.

<!-- config-environment:start -->
| Environment variable | Default and meaning |
| --- | --- |
| `GAME_PORT` | 8787; WebSocket listen port. `preview-prod` forces 4002 and production systemd uses 8081. |
| `GAME_HOST` | `0.0.0.0`; WebSocket listen address. |
| `WORLD_SEED` | `dev-world-1`; any string, deterministically hashed into the shared world seed. |
| `FLOOR` | 1; numeric sandbox floor. Dungeon floors remain lazy multi-floor worlds. |
| `STORE_FILE` | `<repo>/data/players.json`; player-persistence path. Use `none` to disable file persistence. |
| `SPAWN_RADIUS` | 2 tiles; shared-spawn neighborhood. Use `0` or `off` for classic vast scatter. |
| `FREEZE_ENEMIES` | Off; exact value `1` freezes enemy AI for diagnostics. |
| `VOID_TERRAIN` | Off; `1`/`true`/`on` enables explicit VOID terrain, while `0`/`false`/`off` selects finite terrain. |
| `GAMEPLAY_IDLE_TIMEOUT_MS` | 180000 (3 minutes); positive inactivity timeout for joined players. |
| `DEBUG_COMMANDS` | Enabled outside production unless exact value `0`; controls development commands such as `/god` and `/tp`. |
| `NODE_ENV` | Unset locally; exact value `production` hard-disables debug commands regardless of `DEBUG_COMMANDS`. |
| `CLUSTER_SPAWNS` | Off; exact value `1` uses deterministic grid-style diagnostic spawns. |
| `ADMIN_TOKEN` | Unset; token for the separate admin portal. With no token, portal authentication is disabled. |
| `TRUST_PROXY` | Off; exact value `1` trusts the rightmost proxy-appended viewer address. Enable only behind the configured CloudFront path. |
| `OPERATIONAL_EVENT_TABLE` | Unset; DynamoDB table for sanitized connection/admin history. Unset uses a no-op event sink. |
| `OPERATIONAL_EVENT_RETENTION_SECONDS` | 31536000 (365 days) when a table is configured; positive per-event TTL. Every new event receives a fresh expiration. |
| `OPERATIONAL_EVENT_PEPPER` | Required when an event table is configured; secret used for one-way peer fingerprints. Never commit it. |
| `AWS_REGION` | AWS SDK default resolution; optional DynamoDB region override. |
| `CUSTOM_MAP` | Retired compatibility setting. `none` is quiet; every other nonempty value is logged and ignored. |
| `VITE_ENABLE_MOVEMENT_TRACE` | Off; exact value `1` adds a movement-trace record/save button in Vite development only. It records input, snapshots, prediction, and render positions and auto-saves after 30 seconds. Production builds ignore it. |
<!-- config-environment:end -->

`VITE_ENABLE_MOVEMENT_TRACE` is read when Vite starts, so restart the client after
changing it. Vite's `DEV` and `PROD` values are built-ins derived from the command;
they are not custom environment variables. Client builds also derive
`__APP_VERSION__` from the root `package.json` and `__BUILD_SHA__` from the current
short Git commit (falling back to `dev` outside a Git checkout).

### Copy-paste local examples

PowerShell:

```powershell
$env:WORLD_SEED = "local-party"
$env:SPAWN_RADIUS = "8"
$env:ADMIN_TOKEN = "replace-this-local-token"
$env:VITE_ENABLE_MOVEMENT_TRACE = "1"
npm run dev

# Remove the overrides later:
Remove-Item Env:WORLD_SEED, Env:SPAWN_RADIUS, Env:ADMIN_TOKEN, Env:VITE_ENABLE_MOVEMENT_TRACE
```

WSL/Bash:

```bash
WORLD_SEED=local-party \
SPAWN_RADIUS=8 \
ADMIN_TOKEN=replace-this-local-token \
VITE_ENABLE_MOVEMENT_TRACE=1 \
npm run dev
```

Finite and VOID terrain examples:

```powershell
$env:VOID_TERRAIN = "true"; npm run dev
```

```bash
VOID_TERRAIN=true npm run dev
```

### NPM and developer-tool startup modes

| Command or arguments | Meaning |
| --- | --- |
| `npm run dev` | LAN-exposed Vite (`--host 0.0.0.0`) on 5173 plus the source game server on 8787. |
| `npm run build` | Production client `dist/` plus bundled server `main.cjs`. |
| `npm run preview-prod` | Preview built client on 4001 plus built server on 4002. Run `npm run build` first. |
| `npm run lint:working-tree` | Changed-source lint, configuration-doc coverage, and changed-folder size checks. |
| `npm run lint` | Full ESLint, configuration-doc coverage, and repository folder-size checks. |
| `node packages/client/scripts/screenshot.mjs --port <port> --path <url-path> --out <png> [--wait-ms <ms>] [--width <px>] [--height <px>]` | Start a temporary Vite server and capture a page. Defaults: 5180, `/`, `screenshot.png`, 1500 ms, 1280×720. |
| `npx tsx tools/worldgen/render-map.ts <seed> <floor> <chunksNxN> <outPng>` | Render a deterministic world-generator region. |
| `node tools/smoke-production.mjs <site-url>` | Join Dungeon and Sandbox through a deployed site's WebSocket path. |

### Production systemd profile

Terraform renders the EC2 service with `NODE_ENV=production`, `DEBUG_COMMANDS=0`,
`VOID_TERRAIN=false`, `GAME_PORT=8081`, `TRUST_PROXY=1`, and
`GAMEPLAY_IDLE_TIMEOUT_MS=180000`. It injects `WORLD_SEED`, the DynamoDB table and
TTL from Terraform; uses `/var/lib/dungeoncrawler2d/players.json` for `STORE_FILE`;
sets `CUSTOM_MAP=none`; and reads the generated `OPERATIONAL_EVENT_PEPPER` from a
root-owned, mode-0600 environment file.

### Terraform inputs

Set these in `infra/terraform.tfvars` or with Terraform's `-var` options.

| Variable | Default and constraint |
| --- | --- |
| `aws_region` | `us-east-1`; currently required so the CloudFront ACM certificate is valid. |
| `aws_profile` | `poweraccess-terraform`; local AWS CLI profile used by Terraform and deployment commands. |
| `domain_name` | `dungeoncrawl2d.austinwasinger.com`; public hostname. |
| `instance_type` | `t4g.nano`; ARM game-server instance. |
| `world_seed` | `austin-dungeon-prod-1`; letters, numbers, periods, underscores, and hyphens only. Treat a production change as a gameplay migration. |
| `enable_distribution` | `true`; set false during certificate-validation phase one. |
| `operational_event_retention_days` | 365; per-event DynamoDB history retention, 7–365. New activity creates newly dated events; it does not extend older events. |
| `server_log_retention_days` | 14; CloudWatch retention: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, or 365. |

The production deploy workflow keeps `AWS_REGION`, `AWS_ROLE_ARN`,
`ARTIFACT_BUCKET`, `FRONTEND_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, and `SITE_URL`
as repository workflow constants in `.github/workflows/deploy-production.yml`.
`INSTANCE_ID` and GitHub's `GITHUB_OUTPUT` are generated during the job rather than
local configuration inputs. See [infra/README.md](infra/README.md) for the two-phase
Terraform and deployment procedure.

## Status

**v0.8.0 is playable:** district-scale world generation, multiplayer
movement/combat, effects, items, dedicated room and encounter spaces,
terrain-aware enemies, elemental reactions, companion pets, assisted controls,
parties/chat, editable HUD layouts, spectator/admin tools, and local combat
testing areas are shipped. AI crafting and final art/content polish remain on
the roadmap.
