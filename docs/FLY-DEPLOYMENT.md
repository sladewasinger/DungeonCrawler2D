# Fly.io Game Server Deployment

Production splits static asset delivery from the stateful 20 Hz multiplayer simulation:

| Layer | Host / Service | Public Endpoint | Notes |
| --- | --- | --- | --- |
| Static client (`packages/client/dist`) | AWS S3 + CloudFront (`infra/`) | `https://dungeoncrawl2d.austinwasinger.com` | Immutable hashed JS/CSS + revalidated HTML/assets |
| Game server (`packages/game-server/dist/main.cjs`) | **Fly.io (`dfw`, Dallas)** — `shared-cpu-2x`, `1gb` RAM + `1gb` persistent volume | `wss://ws.dungeoncrawl2d.austinwasinger.com/ws` | Direct WSS connection bypasses CloudFront proxy hops for lower Central US latency |

> **Why direct WebSocket instead of CloudFront `/ws`?** Proxying WebSockets through CloudFront adds an extra AWS edge hop and buffering before reaching Dallas. Setting `VITE_GAME_WS_URL` at build time makes the browser connect directly to Fly.io's `dfw` edge.

---

## Repository Files

- [`fly.toml`](../fly.toml): App name (`dungeoncrawler2d-server`), primary region (`dfw`), `shared-cpu-2x` / `1gb` VM, `1gb` persistent `world_data` volume mounted at `/data`, `auto_stop_machines = "off"`, `min_machines_running = 1`, `immediate` deploy strategy, and `/health` HTTP check on port `8080`.
- [`packages/game-server/Dockerfile`](../packages/game-server/Dockerfile): Multi-stage `node:22-alpine` build bundling `@dc2d/game-server` into `/app/main.cjs` and running as non-root `node` via `su-exec` so `SIGTERM`/`SIGINT` reach Node directly.
- [`.dockerignore`](../.dockerignore): Keeps remote Fly Docker build uploads minimal by excluding client assets, tests, `infra/`, and `node_modules`.
- [`packages/game-server/src/main.ts`](../packages/game-server/src/main.ts): Handles `SIGINT` / `SIGTERM` to flush world persistence (`server.close()` -> `sim.savePersistenceNow()`) before Fly stops a machine on redeploy.
- [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml): Automatically switches between Fly.io and the legacy AWS EC2 SSM server path based on whether `FLY_API_TOKEN` is present.
- [`tools/smoke-production.mjs`](../tools/smoke-production.mjs): Verifies both the CloudFront HTML page and the configured WebSocket (`GAME_WS_URL`) endpoint after deploy.

---

## 1. Installing the Local Fly CLI (`fly` / `flyctl`)

### Windows (PowerShell 5.1 — default Windows terminal)

Do **not** wrap with `pwsh -Command` unless PowerShell 7 is installed. Run directly inside your PowerShell window:

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Then either open a new PowerShell window, or add Fly to the current session's `PATH`:

```powershell
$env:Path += ";$env:USERPROFILE\.fly\bin"
fly version
```

*(Alternative via WinGet: `winget install Superfly.flyctl`.)*

### macOS / Linux

```bash
curl -L https://fly.io/install.sh | sh
fly version
```

### Authenticate locally

```powershell
fly auth login
```

This opens a browser window to sign in to your Fly.io account (billing method required for persistent volumes and always-on VMs). Verify who you are logged in as with `fly auth whoami`.

---

## 2. First-Time App, Volume & Secret Setup (Dallas `dfw`)

Run from the repository root (`C:\repos\DungeonCrawler2D`):

1. **Create the Fly app** *(global across all of Fly.io; if `dungeoncrawler2d-server` is taken, choose another name and update `app = "..."` in `fly.toml`)*:

   ```powershell
   fly apps create dungeoncrawler2d-server
   ```

2. **Create the 1 GB persistent world-save volume in `dfw`:**

   ```powershell
   fly volumes create world_data --region dfw --size 1
   ```

   > **Warning note:** Fly prints *"Warning! Every volume is pinned to a specific physical host. You should create two or more volumes..."* — answer **Yes**. Because this server holds an authoritative single-world simulation and in-memory state (`WORLD_SAVE_PATH=/data/world-save.json`), it deliberately runs **1** machine and **1** volume so players are never split across two worlds. Fly automatically retains 5 daily snapshots of `world_data`.

3. **(Optional) Configure `/admin` authentication:**

   ```powershell
   fly secrets set ADMIN_TOKEN="your-admin-token"
   ```

   *(If `WORLD_SEED` should match the legacy production seed `austin-dungeon-prod-1`, also set `fly secrets set WORLD_SEED="austin-dungeon-prod-1"` or add it under `[env]` in `fly.toml`.)*

4. **Deploy the server manually & check health:**

   ```powershell
   fly deploy --remote-only
   (iwr https://dungeoncrawler2d-server.fly.dev/health).Content
   ```

   Expected response: `{"ok":true,"protocol":1}`. *(Fly's single-machine / non-HA notice on deploy is expected and safe to ignore.)*

---

## 3. Custom Subdomain (`ws.dungeoncrawl2d.austinwasinger.com`) & TLS

1. **Add the DNS CNAME at Namecheap** (Domain List -> `austinwasinger.com` -> **Advanced DNS**):
   - **Type:** `CNAME Record`
   - **Host:** `ws.dungeoncrawl2d`
   - **Value:** `dungeoncrawler2d-server.fly.dev`
   - **TTL:** Automatic

2. **Issue the free Let's Encrypt certificate on Fly:**

   ```powershell
   fly certs add ws.dungeoncrawl2d.austinwasinger.com
   fly certs show ws.dungeoncrawl2d.austinwasinger.com
   ```

3. **Verify HTTPS/WSS endpoint:**

   ```powershell
   (iwr https://ws.dungeoncrawl2d.austinwasinger.com/health).Content
   ```

---

## 4. GitHub Actions CI/CD & `FLY_API_TOKEN`

1. **Generate a scoped deploy token** from your local terminal:

   ```powershell
   fly tokens create deploy -a dungeoncrawler2d-server -x 2160h
   ```

2. **Add the GitHub Repository Secret:**
   Go to GitHub -> **Settings -> Secrets and variables -> Actions -> Secrets -> New repository secret**:
   - **Name:** `FLY_API_TOKEN`
   - **Value:** Paste the **entire** output from `fly tokens create deploy`, **including the `FlyV1 ` prefix**.

3. **How CI resolves the endpoint automatically:**
   - The `Resolve deploy target` step in [`.github/workflows/deploy-production.yml`](../.github/workflows/deploy-production.yml) checks `secrets.FLY_API_TOKEN != ''` via step `env:` (GitHub Actions disallows `secrets.*` directly inside `if:` expressions).
   - When `FLY_API_TOKEN` is set:
     - `VITE_GAME_WS_URL` (client build) and `GAME_WS_URL` (smoke test) automatically default to `wss://ws.dungeoncrawl2d.austinwasinger.com/ws`.
     - CI deploys `@dc2d/game-server` with `flyctl deploy --remote-only` and skips the legacy EC2 SSM server steps.
     - Optional: set **Repository variable** `VITE_GAME_WS_URL` in GitHub Actions to override the WebSocket URL without editing YAML.
   - When `FLY_API_TOKEN` is empty/unset: CI falls back to the legacy AWS EC2 bundle + SSM restart flow.

---

## 5. Day-to-Day Operations, Backups & Token Rotation

Run from `C:\repos\DungeonCrawler2D` (uses `fly.toml` automatically; or pass `-a dungeoncrawler2d-server` from any folder):

```powershell
fly status                                         # Check machine state, region, and health checks
fly logs                                           # Tail live server stdout/stderr logs
fly machine restart                                # Graceful restart (triggers SIGTERM world-save flush)
fly volumes list                                   # Inspect mounted dfw volume capacity
fly volumes snapshots list vol_vgnoddk60nwk5g04    # View automatic daily Fly snapshots
fly ssh console                                    # Open an Alpine shell inside the running server
fly sftp get /data/world-save.json ./world-save.json   # Download a local backup of world state
fly secrets list                                   # Check configured secret names
fly tokens list                                    # Inspect active deploy tokens (revoke via `fly tokens revoke <id>`)
```

### Running the production smoke test manually

```powershell
$env:GAME_WS_URL = "wss://ws.dungeoncrawl2d.austinwasinger.com/ws"
node tools/smoke-production.mjs https://dungeoncrawl2d.austinwasinger.com
```

### Retiring the legacy AWS EC2 instance (optional)

Once Fly.io has run cleanly and any desired state from `/var/lib/dungeoncrawler2d/players.json` is migrated, the EC2 instance / EIP / Backup resources in [`infra/main.tf`](../infra/main.tf) can be removed while keeping S3, CloudFront, ACM, and the GitHub OIDC role for the static frontend.
