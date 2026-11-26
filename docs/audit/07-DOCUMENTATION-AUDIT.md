# 07 — Documentation Audit: Dead Docs, Drift, Coverage Gaps & Consolidation Plan

> **Audit Scope**: Every Markdown file (`61` `.md` files outside `node_modules/` and `docs/audit/`) cross-checked against `package.json`, `.github/workflows/*`, `fly.toml`, `infra/*`, `scripts/verify/*`, `tools/*`, `packages/{engine,content,game-server,client}/**`, and `packages/client/public/assets/**`.

---

## 1. Executive Summary

Across **61** repository Markdown files, documentation quality is sharply bifurcated: newer subsystem `README.md`s (`render/character/`, `audio/`, `game-server/`) and future Phase 9–13 specs (`REQ-P9..P13`) are detailed and accurate, while legacy pre-rewrite (`v1`/`v2`) artifacts, un-retired intermediate specs (`docs/frontier/*`, `docs/phases/phase-6..7`), and unmaintained root/package indexes have accumulated **22 distinct documentation defects**:

| Status | File Count | Share | Summary |
| :--- | :---: | :---: | :--- |
| **Healthy** | `23` | `37.7%` | Accurate against live code, contracts, and file layout (Phase 9–13 specs, 17 colocated/package `README.md`s, `tools/sprite-studio/README.md`). |
| **Stale (Doc-to-Code Drift)** | `25` | `41.0%` | Active docs with false keybindings, deleted file references, wrong dimensions/formats, legacy AWS/EC2 claims, silent seed gotchas, or 5-line package stubs (`README.md`, `LESSONS.md`, `VERIFICATION-GATE.md`, `ROADMAP.md`, `FLY-DEPLOYMENT.md`, `phase-8`, `infra/README.md`, `assets/LICENSES.md`, `AGENTS.md`, 16 colocated/package `README.md`s). |
| **Overlapping / Disparate** | `3` | `4.9%` | Accurate or partially accurate docs duplicating another active doc or un-graduated from `docs/frontier/` (`tools/sprite-studio/PLAYER_EDITING_TUTORIAL.md`, `docs/frontier/01-*`, `docs/frontier/07-*`). |
| **Dead (Obsolete / Superseded)** | `10` | `16.4%` | Pre-rewrite Phaser/`0x72` docs (`assets/INVENTORY.md`), completed QA scratchpads (`docs/frontier/BUG-FIX-LOG.md`), and shipped design specs (`docs/frontier/MASTER-PLAN.md`, `02..06`, `docs/phases/phase-6..7`) whose implementation diverged after shipping. |
| **Total** | **`61`** | **`100%`** | **22 numbered issues (`2` Critical, `8` High, `9` Medium, `3` Low)** |

### Issue Severity Breakdown

| Severity | Count | Issue IDs |
| :--- | :---: | :--- |
| **Critical** | `2` | `DOC-01`, `DOC-02` |
| **High** | `8` | `DOC-03`, `DOC-04`, `DOC-05`, `DOC-06`, `DOC-07`, `DOC-08`, `DOC-09`, `DOC-10` |
| **Medium** | `9` | `DOC-11`, `DOC-12`, `DOC-13`, `DOC-14`, `DOC-15`, `DOC-16`, `DOC-17`, `DOC-18`, `DOC-19` |
| **Low** | `3` | `DOC-20`, `DOC-21`, `DOC-22` |

---

## 2. Complete Inventory of All 61 Markdown Files

| # | File Path | Bytes | Status | Primary Finding / Recommended Disposition |
| :---: | :--- | ---: | :---: | :--- |
| 1 | `AGENTS.md` | 2,782 | **Stale** | Missing `verify:content` / `verify:phase` gate rules & phase-spec graduation rule (`DOC-20`). Update in place. |
| 2 | `README.md` | 11,893 | **Stale** | Wrong desktop/mobile controls (`DOC-03`), stale Phase-3 character description & 18 missing colocated `README.md` links (`DOC-11`), missing `verify:*`/`bake` scripts (`DOC-20`). Update in place. |
| 3 | `assets/INVENTORY.md` | 15,785 | **Dead** | 100% legacy v2 Phaser + `0x72` inventory citing 9 non-existent docs/JSONs & non-existent `assets/dungeon/*` (`DOC-01`). Delete or replace with generated asset manifest doc. |
| 4 | `assets/LICENSES.md` | 6,944 | **Stale** | Cites non-existent `assets/dungeon/*`, `assets/fonts/*`, `assets/packs/pet_dino/*` while omitting `~40.1 MiB` of third-party packs in `packages/client/public/assets/packs/*` and current `.webp` bakes (`DOC-01`). Rewrite after pruning unused `public/assets/`. |
| 5 | `docs/FLY-DEPLOYMENT.md` | 8,237 | **Stale** | Operational runbook is accurate except `WORLD_SEED="austin-dungeon-prod-1"` recommendation (`L85`), which silently evaluates to `NaN -> 1337` in `wsServer.ts:206` (`DOC-05`). Fix seed note; make canonical deploy doc. |
| 6 | `docs/LESSONS.md` | 5,987 | **Stale** | `L8-23` retain 7 obsolete `archive/v1` finite-dungeon rules (`terrainMaterialRoles.ts`, `finiteFloor.ts`, maze unions); `L24` has hardcoded `file:///d:/repos/...` broken link (`DOC-06`). Prune v1 entries & fix link. |
| 7 | `docs/ROADMAP.md` | 27,564 | **Stale** | Completed phase bullets contradict live code on crouch/pebble keys (`L96`), mobile swipe-to-roll (`L91`), and map size/zoom (`L82`) (`DOC-03`, `DOC-12`), while duplicating `docs/frontier/*` & `docs/phases/*`. |
| 8 | `docs/VERIFICATION-GATE.md` | 9,629 | **Stale** | Header (`L3`) says `✅ Tooling & CI Active`, while Section 4 (`L106-124`) still frames `verify:*` and `quality.yml` in future tense (`"Planned CLI"`, `"When implemented..."`) (`DOC-10`). Update Section 4 to reflect live scripts & baseline E2E gap. |
| 9 | `docs/frontier/MASTER-PLAN.md` | 6,567 | **Dead** | Shipped milestone plan (`cdb79366..cb94d6db`); self-contradicts `5` vs `4` Danger Tiers, `20` vs `19` POIs, and `r < 28` vs `r < 220` (`DOC-07`, `DOC-08`). Graduate & delete/archive. |
| 10 | `docs/frontier/BUG-FIX-LOG.md` | 13,768 | **Dead** | Point-in-time QA bug log (`BUG-01..05`, `GAP-01..06` all `VERIFIED LIVE`); lessons already captured in `docs/LESSONS.md:34-39` (`DOC-08`). Delete. |
| 11 | `docs/frontier/01-item-stats-rarity-and-prefixes.md` | 8,470 | **Overlapping** | Shipped spec duplicating `packages/content/README.md` & `engine/src/inventory/README.md`; omits `copper-pickaxe`/`copper-axe` (`L33`) and lists uncraftable `shadowsteel-legguards`/`boots` (`DOC-08`, `DOC-14`). Merge into `packages/content/README.md` & delete. |
| 12 | `docs/frontier/02-item-card-and-inspection-ui.md` | 3,621 | **Dead** | Shipped spec whose core hotbar click-to-inspect rule (`L11, L43`) was reverted as `BUG-02` (`DOC-07`, `DOC-08`). Superseded by `ui/hud/README.md`; delete. |
| 13 | `docs/frontier/03-dynamic-loot-tables-and-frontier-scaling.md` | 4,387 | **Dead** | Claims `DangerTier 1..4` at `r = 48/112/192` with biome clamping (`L12-26`) and Workbench frontier crafting (`L67-68`), contradicting `macroBiome.ts:9-39` (`1..5` at `1000..6000`) and `frontierRecipes.ts` (`DOC-07`, `DOC-08`). Delete after updating `packages/content/README.md`. |
| 14 | `docs/frontier/04-five-biomes-overworld-generation.md` | 3,760 | **Dead** | Claims `r < 28` Spawn Glade and `r > 70` Cursed Ruinlands (`L13`) vs `r < 220` and `r >= 2000` in `macroBiome.ts` (`DOC-07`, `DOC-08`). Superseded by `engine/src/world/README.md`; delete. |
| 15 | `docs/frontier/05-diverse-pois-shrines-puzzles-and-lairs.md` | 5,306 | **Dead** | Title & `L12` say `17 New Diverse POIs (19 Total)` while listing `18` new POIs (`20` total in `poiCatalog.ts`) (`DOC-07`, `DOC-08`). Graduate into `engine/src/world/pois/README.md` & delete. |
| 16 | `docs/frontier/06-discovery-banners-map-pins-and-log.md` | 2,846 | **Dead** | `L44` claims `X / 19 Landmark Types` vs `20` in `poiCatalog.ts:54` & `ui/map/README.md:4` (`DOC-07`, `DOC-08`). Graduate into `ui/discovery/README.md` & delete. |
| 17 | `docs/frontier/07-proximity-chat-and-speech-bubbles.md` | 3,422 | **Overlapping** | Accurate shipped spec left in `docs/frontier/` while `sim/chat/`, `ui/chat/`, and `render/world/chat/` lack colocated `README.md`s (`DOC-08`, `DOC-18`). Graduate into colocated `README.md`s & delete. |
| 18 | `docs/phases/phase-6-stealth-and-ecological-ai.md` | 26,685 | **Dead** | Completed spec (`✅`) retaining obsolete Pass-1 gap table (`L25-36`), wrong dodge/pebble keys (`Space`/`Q` vs `Ctrl`/`X`, `L48, L81`), and pre-v0.11.9 scent rules (`DOC-03`, `DOC-09`). Already graduated to `combat/` & `wildlife/` `README.md`s; archive/delete. |
| 19 | `docs/phases/phase-7-weapon-movesets-and-combat-feel.md` | 21,982 | **Dead** | Completed spec (`✅`) retaining obsolete Pass-1 gap table (`L26-38`), raw stream-of-consciousness notes (`L120-123`), and stale `weapon-bow.png` (`L73`) (`DOC-09`, `DOC-15`). Already graduated; archive/delete. |
| 20 | `docs/phases/phase-8-gathering-survival-and-camp-building.md` | 19,562 | **Stale** | Active Pass-2 spec cites non-existent `src/ui/panels/craftingPanel.ts` (`L9`; actual: `src/ui/hud/craftingPanel.ts`) and omits `shadowsteel-legguards`/`boots` from Workbench migration (`L35`) (`DOC-14`). Fix touchpoint & recipe list. |
| 21 | `docs/phases/phase-9-fog-of-war-and-safe-room-hubs.md` | 14,980 | **Healthy** | Clean future spec (`REQ-P9-01..16`), valid folder-size guardrails and target test paths. Keep as active phase spec. |
| 22 | `docs/phases/phase-10-progression-floor-bosses-and-dcc-countdown.md` | 15,067 | **Healthy** | Clean future spec (`REQ-P10-01..16`). Keep as active phase spec. |
| 23 | `docs/phases/phase-11-dynamic-weather-and-pitch-black-dungeons.md` | 14,394 | **Healthy** | Clean future spec (`REQ-P11-01..16`). Keep as active phase spec. |
| 24 | `docs/phases/phase-12-coop-polish-adaptive-music-and-qa-benchmarks.md` | 13,429 | **Healthy** | Clean future spec (`REQ-P12-01..14`) tracking Phase 6/7 deferred 3D animations. Keep as active phase spec. |
| 25 | `docs/phases/phase-13-composable-effects-and-system-ai.md` | 13,815 | **Healthy** | Clean future spec (`REQ-P13-01..12`). Keep as active phase spec. |
| 26 | `infra/README.md` | 11,010 | **Stale** | Documents legacy EC2/SSM server as primary, claims nonexistent `players.json`, DynamoDB `operational_history`, `operational-events.env`, `TRUST_PROXY=1`, `ServerErrors` metrics, and links missing `docs/ADMIN-OPERATIONS.md` (`DOC-02`, `DOC-05`). Trim to S3/CloudFront/OIDC + legacy EC2 retirement notice. |
| 27 | `packages/client/README.md` | 832 | **Stale** | 7-line stub omitting `audio/`, `soundStudio/`, `sandbox/`, `admin/`, `render/character/`, `render/combat/`, `ui/chat/`, `ui/discovery/` (`DOC-17`). Expand into package map. |
| 28 | `packages/client/src/admin/README.md` | 1,864 | **Stale** | Cites AWS SSM-only `ADMIN_TOKEN` (`L6`, ignoring Fly.io secrets) and omits all chat slash commands (`/god`, `/give`, `/fillbag`, `/clearbag`, `/tp`, `/biome`, `/poi`) (`DOC-16`); missing from root `README.md`. |
| 29 | `packages/client/src/audio/README.md` | 3,126 | **Healthy** | Comprehensive, accurate module map of all `audio/` and `audio/weapons/` files. |
| 30 | `packages/client/src/audio/creatures/README.md` | 1,435 | **Healthy** | Accurate breakdown of `vocalSynth.ts` and all 9 species voice specs (unlisted in root `README.md`). |
| 31 | `packages/client/src/render/README.md` | 1,358 | **Stale** | Omits `render/character/`, `render/survival/`, `render/poseTuning/`, `textures/biomes/`, `textures/pois/`, and `world/chat/` (`DOC-17`). |
| 32 | `packages/client/src/render/character/README.md` | 3,462 | **Healthy** | Up-to-date v0.11.10 2-tier `<= 2048×2048` packed atlas, 12 clips, `frontierHeldGear.ts`, `armorLayerRecolor.ts`, and 32-entry LRU cache. |
| 33 | `packages/client/src/render/combat/README.md` | 3,535 | **Stale** | `L8` claims POI chests load `64×64` `.png` files from `/assets/pois/` (actual files are `.webp`); omits sealed vault arcane rings & Elite auras (`DOC-15`). |
| 34 | `packages/client/src/render/combat/gore/README.md` | 1,841 | **Healthy** | Accurate documentation of `GoreStyle × GoreSubstance` and all 8 files in `gore/` (unlisted in root `README.md`). |
| 35 | `packages/client/src/render/combat/webs/README.md` | 309 | **Healthy** | Concise, accurate summary of `webRenderer.ts` (unlisted in root `README.md`). |
| 36 | `packages/client/src/render/poseTuning/README.md` | 795 | **Stale** | `L7` cites deleted `playerArmIk.ts` and claims `playerPoseHelpers.ts` consumes `poseTuningHelpers.ts`; omits that `FreeArmDirTune` & `BowAimDirTune` are dead no-ops on the 3D rig (`DOC-04`). |
| 37 | `packages/client/src/render/shaders/README.md` | 886 | **Stale** | Omits `tilemapMesh.ts` + `glsl/tilemapGlsl.ts` (17-row GPU terrain shader), `shaderDiag.ts`, and Frontier biome particle modes (`DOC-16`); unlisted in root `README.md`. |
| 38 | `packages/client/src/render/survival/README.md` | 603 | **Healthy** | Accurate summary of `campPropTextures.ts` and `harvestFxLayer.ts` (unlisted in root `README.md`). |
| 39 | `packages/client/src/render/world/README.md` | 1,764 | **Stale** | `L6` cites non-existent `weapon-bow.png` (actual: `weapon-bow.webp`) and omits `chat/playerSpeechBubble.ts` (`DOC-15`); unlisted in root `README.md`. |
| 40 | `packages/client/src/sandbox/README.md` | 2,553 | **Stale** | `L11` claims `0.50×` `18`-color `.png` enemies & `80×80` golem (actual: `0.3333×` `48 px/m` `.webp`, `96×96..192×192`); `L16` claims `Space` dodges & `9` shows live minimap (`Space` jumps, `Ctrl` dodges, map unwired in `sandboxMode.ts:216`) (`DOC-03`, `DOC-15`). |
| 41 | `packages/client/src/sandbox/poseTuner/README.md` | 841 | **Stale** | `L6` documents Empty Left/Right arm IK & Two-Handed Bow sliders as live features despite `computeTunedFreeArm` and `getTunedBowConfig` having zero runtime callers (`DOC-04`). |
| 42 | `packages/client/src/soundStudio/README.md` | 2,001 | **Healthy** | Accurate documentation of `soundStudio/`, `timeline/`, and `io/`. |
| 43 | `packages/client/src/ui/hud/README.md` | 2,752 | **Stale** | `L5` misplaces `../atmosphereToolbar.ts`, `../fpsCounter.ts`, and `../settings/` inside `ui/hud/`; `L6` omits the permanent `Overworld Map (M)` hotbar button (`bottomHotbar.ts:44-51`); omits `craftingPanel.ts`, `characterPanel.ts`, `debugSpawnPopover.ts` (`DOC-13`). |
| 44 | `packages/client/src/ui/loading/README.md` | 945 | **Healthy** | Accurate summary of `#ow-boot-loading`, `loadingScreen.ts`, and `bootPreloader.ts` (unlisted in root `README.md`). |
| 45 | `packages/client/src/ui/map/README.md` | 759 | **Healthy** | Accurate summary of `compassBadge.ts`, `mapPinRenderer.ts`, and `480×480` `minimapOverlay.ts` (`2×/3×/4×`, `X / 20 Landmarks`) (unlisted in root `README.md`). |
| 46 | `packages/client/src/ui/title/README.md` | 786 | **Healthy** | Accurate summary of `titleScreen.ts` and `titleStyles.ts`. |
| 47 | `packages/content/README.md` | 683 | **Stale** | 5-line stub omitting `src/biomes/biomeCatalog.ts`, `src/items/lootTables.ts`, and `src/world/` (`palettes.ts`, `outlineConfig.ts`, `qualityPresets.ts`) (`DOC-17`). |
| 48 | `packages/engine/README.md` | 475 | **Stale** | 8-line stub completely omitting `src/combat/` and `src/survival/` (`DOC-17`). |
| 49 | `packages/engine/src/character/README.md` | 705 | **Stale** | `L10` lists only 6 `Hair Color` values (`brown..teal`), whereas `appearance.ts:8-12` defines **18** `HAIR_COLORS` including 6 two-tone gradients (`DOC-16`). |
| 50 | `packages/engine/src/combat/README.md` | 3,292 | **Stale** | `L8` omits `"stone"` from `GoreSubstance`; `L13` still mentions `"web-slow"` in `weaponMovesets.ts` (replaced by `WorldWebNetwork` stickiness/cocoon) (`DOC-16`). |
| 51 | `packages/engine/src/combat/hitboxes/README.md` | 1,252 | **Healthy** | Accurate summary of `combatShapes.ts`, `creatureHitboxSpecs.ts`, and `hitboxOverlap.ts` (unlisted in root `README.md`). |
| 52 | `packages/engine/src/inventory/README.md` | 1,226 | **Healthy** | Accurate summary of 36-slot model, `armorOps.ts`, `gearStats.ts`, `crafting.ts`, and `chestOps.ts`. |
| 53 | `packages/engine/src/survival/README.md` | 1,214 | **Stale** | `L5` lists only 8 harvestable props in `harvestRules.ts`, omitting all 6 Frontier nodes (`BirchTree`, `MapleTree`, `DeadTree`, `GiantMushroom`, `BogReed`, `CursedCrystal`) and `litBraziers`/`unlockedVaults` in `worldDeltas.ts` (`DOC-16`). |
| 54 | `packages/engine/src/world/README.md` | 2,301 | **Healthy** | Up-to-date with 5 biomes, `r < 220` starter valley, `1000..6000` `TIER_DISTANCES`, `GroundKind 0..16`, POIs, collision, and jump physics. |
| 55 | `packages/game-server/README.md` | 2,011 | **Healthy** | Up-to-date 20 Hz server, Frontier systems, admin auth/slash commands, AOI culling, persistence, and Fly.io containerization. |
| 56 | `packages/game-server/src/sim/survival/README.md` | 1,210 | **Healthy** | Accurate summary of server harvesting, structures, survival regen, and `persistenceStore.ts` (unlisted in root `README.md`). |
| 57 | `packages/game-server/src/sim/webs/README.md` | 835 | **Healthy** | Accurate summary of `webGeometry.ts`, `webNetwork.ts`, and `webCocoon.ts` (unlisted in root `README.md`). |
| 58 | `packages/game-server/src/sim/wildlife/README.md` | 3,976 | **Stale** | `L8` still claims `"spider horizontal parabolic pounce + 1.8s Web-Slow"` (replaced by cloth webs + venom poison) and omits `wildlife/loot/` (`eliteScaling.ts`, `lootTypes.ts`) (`DOC-16`); unlisted in root `README.md`. |
| 59 | `packages/game-server/src/sim/wildlife/tracking/README.md` | 851 | **Healthy** | Accurate summary of `searchTracking.ts` and `pursuitLoss.ts` (unlisted in root `README.md`). |
| 60 | `tools/sprite-studio/README.md` | 13,756 | **Healthy** | Comprehensive Blender-to-WebP pipeline reference; minor port nit (`localhost:5174` on `L21` vs `5173`, `DOC-21`) and `L23-87` overlap with `PLAYER_EDITING_TUTORIAL.md` (`DOC-19`). |
| 61 | `tools/sprite-studio/PLAYER_EDITING_TUTORIAL.md` | 14,103 | **Overlapping** | Accurate sculpting & weight-transfer guide, but ~65 lines of CLI commands and collection rules duplicate `tools/sprite-studio/README.md:23-87` (`DOC-19`); unlisted in root `README.md`. |

---

## 3. Detailed Numbered Findings (`DOC-01` – `DOC-22`)

### Critical Severity

#### `DOC-01` (Critical — Dead Docs & Asset/License Drift): `assets/INVENTORY.md` and `assets/LICENSES.md` Document a Deleted Pre-Rewrite Asset Tree While Omitting `~41.6 MB` of Live Public Assets
- **Locations**:
  - `assets/INVENTORY.md:1-271`
  - `assets/LICENSES.md:1-68`
  - Cross-checked against `assets/` (contains **zero** non-Markdown files) and `packages/client/public/assets/**` (`43,053 KB` across `113` files).
- **Evidence**:
  1. Every asset path cited in `assets/INVENTORY.md` and `assets/LICENSES.md` is missing on disk: `assets/dungeon/0x72_DungeonTilesetII_v1.7.png`, `assets/dungeon/tile_list_v1.7.txt`, `assets/dungeon/atlas_*.png`, `assets/fonts/monogram.ttf`, `assets/packs/pet_dino/DinoSprites - *.png`, and `assets/packs/0x72_DungeonTilesetII_v1.7/Enchanted Forest Characters with animations.png` (`INVENTORY.md:11-36, 126-131`; `LICENSES.md:23, 37, 47, 54`).
  2. `INVENTORY.md` instructs engineers to *"Load it as a Phaser texture atlas"* (`L19`) and cross-references **9 deleted v1/v2 files**: `docs/TILESET.md` (`L10`), `docs/ARCHITECTURE.md` (`L62, 99, 204, 213`), `docs/VISUAL_DIRECTION.md` (`L172, 177, 190, 269` & `LICENSES.md:7, 60`), `docs/GAME_DESIGN.md` (`L260`), `packages/content/src/data/enemies.json` (`L120, 243`), `packages/content/src/data/items.json` (`L162, 225, 236`), `packages/content/src/data/areas.json` (`L189`), and `packages/client/src/boot/petAssetManifest.ts` (`L130`).
  3. Meanwhile, `packages/client/public/assets/packs/` ships **7 third-party dungeon/RPG Maker packs** (`coc`, `dragon-cave`, `dwarf-volcano-underground-fortress`, `goblin-cave`, `goblin-mechanical-workshop`, `haunted-amusement-park`, `medieval-sewer` — `48` files totaling **`41,019.8 KB` / `~40.1 MiB`**) plus legacy `atlas.png`/`atlas.json` (`261 KB`), `contact-sheet.png`, `pets/dino-*.png` (`CC BY 4.0` per `LICENSES.md:47`, yet `0` runtime references), `props/*.pxo`, and `terrain/shared-atlas*` (`104 KB`) — **none** of which are referenced anywhere in `packages/`, `scripts/`, or `tools/`, yet all are synced to production S3 on every deploy (`.github/workflows/deploy-production.yml:104`). Conversely, the **actual** runtime assets (`public/assets/{creatures,gear,player,pois}/*.webp` + `sprite-manifest.json` + `player-rig.json`) have **zero** mention in `assets/INVENTORY.md` or `assets/LICENSES.md`.
- **Proposed Fix**:
  1. Delete `assets/INVENTORY.md` (and remove the empty top-level `assets/` folder once `LICENSES.md` moves or updates).
  2. Remove all unreferenced legacy files from `packages/client/public/assets/` (`packs/`, `pets/`, `particles/`, `props/`, `terrain/`, `atlas.*`, `animations.json`, `contact-sheet.png`, `debug-tileset.png`, `fonts/monogram.ttf`).
  3. Rewrite `ASSETS-AND-LICENSES.md` (at `docs/` or `packages/client/public/assets/README.md`) documenting only shipped runtime assets: in-house Blender-baked `.webp` sheets (`creatures/`, `gear/`, `player/`, `pois/`) and procedural runtime textures.

#### `DOC-02` (Critical — Production Ops & Server Architecture Drift): `infra/README.md` Documents Non-Existent Server Persistence, DynamoDB Telemetry, CloudWatch Metrics & a Missing Runbook
- **Locations**:
  - `infra/README.md:5-16, 47-80, 109-111, 170-194`
  - Cross-checked against `packages/game-server/src/**`, `infra/main.tf`, `.github/workflows/deploy-production.yml`, and `docs/FLY-DEPLOYMENT.md`.
- **Evidence**:
  1. **Broken Runbook Link (`L110`)**: Directs operators to `[docs/ADMIN-OPERATIONS.md](../docs/ADMIN-OPERATIONS.md)` for production admin token setup and rotation — that file **does not exist** anywhere in the repository.
  2. **False Persistence Path & Format (`L53-54, 68, 190`)**: Claims production player state lives at `/var/lib/dungeoncrawler2d/players.json`. The `@dc2d/game-server` rewrite stores unified world + player state at `WORLD_SAVE_PATH` (`data/world-save.json` locally, `/data/world-save.json` on Fly.io `world_data` volume; `packages/game-server/src/main.ts:4-6`, `fly.toml:18`).
  3. **Non-Existent DynamoDB, HMAC Secret & Startup Abort (`L12, 182-194`)**: Asserts that the game server writes connection/admin audit records to DynamoDB using `/var/lib/dungeoncrawler2d/operational-events.env`, *"refuses to start"* without that secret (`L186`), emits structured JSON `eventType: server_error` logs driving `DungeonCrawler2D/Server` `ServerErrors` (`L13, 192`), and reads `TRUST_PROXY=1` (`L194`). Grepping `packages/game-server/` confirms **zero** DynamoDB SDK imports, **zero** `operational-events.env` checks, **zero** structured JSON logger, and **zero** `TRUST_PROXY` handling — these belonged to `archive/v1` while `infra/main.tf:199, 384` still provisions idle DynamoDB/CloudWatch resources.
  4. **Stale Smoke-Test Claim (`L178`)**: Claims CI step 5 *"join[s] both Dungeon and Sandbox against the public WebSocket endpoint"* (and `deploy-production.yml:155` still names the step `Smoke-test both game modes`), whereas `tools/smoke-production.mjs` tests the single Overworld HTML + `/ws` handshake.
- **Proposed Fix**:
  - Consolidate production architecture into `docs/DEPLOYMENT.md` (or keep `docs/FLY-DEPLOYMENT.md` for Fly.io server + slim `infra/README.md` strictly to the active AWS S3 + CloudFront + ACM + GitHub OIDC frontend stack).
  - Mark the EC2/SSM/DynamoDB/CloudWatch resources in `infra/README.md` explicitly as **deprecated v1 infrastructure scheduled for Terraform removal**, delete the dead `docs/ADMIN-OPERATIONS.md` link (documenting `fly secrets set ADMIN_TOKEN=...` instead), and rename the workflow step in `deploy-production.yml:155`.

---

### High Severity

#### `DOC-03` (High — Contradictory Controls Across 5 Docs): Desktop Crouch (`C`), Crafting, Pebble Toss (`X`), Drop (`Q`), Dodge (`Ctrl`), and Mobile Gesture Docs Contradict `InputController`
- **Locations**:
  - `README.md:77-78, 83, 86`
  - `docs/ROADMAP.md:91, 96`
  - `docs/phases/phase-6-stealth-and-ecological-ai.md:47-48, 81`
  - `packages/client/src/sandbox/README.md:16`
  - Cross-checked against `packages/client/src/input/controller.ts:144-172, 261-265` and `packages/client/src/input/mobileCombatControls.ts:80-100, 117-127`.
- **Evidence**:
  - **Ground Truth in Code (`controller.ts:144-172`)**:
    - `Space` -> Jump (`L148`)
    - `ControlLeft` / `ControlRight` -> Dodge-roll (`L149-150`)
    - `KeyC` -> Crouch/Sneak toggle or hold (`L129, L162`) — **does NOT open Crafting**!
    - `KeyQ` / `Delete` / `Backspace` -> Drop item (`L163-165`) — **does NOT throw a pebble**!
    - `KeyX` -> Throw distraction pebble (`L166`)
    - `Enter` / `NumpadEnter` -> Open proximity chat (`L146-147`)
  - **Contradictions Across Docs**:
    1. `README.md:83` falsely tells players **`C` or `Bag -> Craft`: Open Crafting panel**, while completely omitting **`C` to Crouch/Sneak** and **`Enter` to Chat** from Desktop Controls (`L73-86`), and omitting mobile **`SNEAK`** and two-handed **`PARRY`** (`mobileCombatControls.ts:87, 125`) from Touch Controls (`L78`)!
    2. `docs/ROADMAP.md:96` claims Crouch is **`X` toggle + Settings `Hold (X)` option** and pebble distraction is **`Q`**, the exact opposite of `KeyC` (crouch), `KeyX` (pebble), and `KeyQ` (drop)!
    3. `docs/ROADMAP.md:91` claims mobile has **"left-side quick swipe-to-roll in any 360° vector"**, which was removed (`controller.ts:261-265` only fires `onWorldTap` on short taps; `packages/client/README.md:7` notes `(without swipe-to-roll)`).
    4. `docs/phases/phase-6-stealth-and-ecological-ai.md` claims `dodging (Space/Shift-roll)` (`L48`) and `Q (PC)` pebble toss (`L81`).
    5. `packages/client/src/sandbox/README.md:16` claims `dodge (Space)` and `9 shows live minimap`, whereas `sandboxMode.ts:216` mounts `InputController` (`Space` = jump, `Ctrl` = dodge, and `onToggleMap` is not even passed!).
- **Proposed Fix**:
  - Update `README.md:73-88`, `docs/ROADMAP.md:91, 96`, and `packages/client/src/sandbox/README.md:16` to match `controller.ts` and `mobileCombatControls.ts` verbatim (`C` crouch/sneak, `Bag -> Craft` only, `X` pebble toss, `Q` drop, `Ctrl` dodge, `Space` jump, `Enter` chat, mobile `SNEAK` + `BLOCK`/`PARRY`).

#### `DOC-04` (High — Ghost File & Dead Subsystem Docs): `poseTuning/README.md` & `sandbox/poseTuner/README.md` Document Deleted `playerArmIk.ts` and Disconnected Free-Arm / Bow Sliders
- **Locations**:
  - `packages/client/src/render/poseTuning/README.md:3-7`
  - `packages/client/src/sandbox/poseTuner/README.md:5-7`
  - Cross-checked against `packages/client/src/render/poseTuning/poseTuningHelpers.ts:49-81` and `packages/client/src/render/world/playerHeldLayout.ts:11`.
- **Evidence**:
  1. `poseTuning/README.md:7` states: *"Pure lookups consumed by `playerArmIk.ts` and `playerPoseHelpers.ts`."* **`playerArmIk.ts` does not exist** anywhere in the repository, and `playerPoseHelpers.ts` does not import `poseTuningHelpers.ts`.
  2. Only `getTunedSwordArm` and `getTunedLanternArm` are imported (`playerHeldLayout.ts:11`). `computeTunedFreeArm` (`poseTuningHelpers.ts:49`) and `getTunedBowConfig` (`poseTuningHelpers.ts:78`) have **zero callers** anywhere in the codebase because Phase 5A/7 replaced procedural 2D IK arms and 2D bow overlays with Blender-baked 3D arms and `weapon-bow.webp`.
  3. Despite this, `sandbox/poseTuner/README.md:6` and `poseTuning/README.md:3-4` still present `Empty Left/Right arms` and `Two-Handed Bow` 8-direction sliders as active live-game pose controls.
- **Proposed Fix**:
  - Either prune dead `freeLeft`/`freeRight`/`bow` fields + UI sections (`poseTunerSections.ts`) and update both `README.md`s to cover `Sword` & `Lantern` carry offsets only, or explicitly mark those sections deprecated in code + docs. Remove the dead `playerArmIk.ts` and `playerPoseHelpers.ts` references in `poseTuning/README.md:7`.

#### `DOC-05` (High — Silent Seed Failure in Prod Runbooks): `docs/FLY-DEPLOYMENT.md` & `infra/README.md` Recommend Non-Numeric `WORLD_SEED="austin-dungeon-prod-1"` Which Evaluates to `1337`
- **Locations**:
  - `docs/FLY-DEPLOYMENT.md:85`
  - `infra/README.md:47-49`
  - Cross-checked against `packages/game-server/src/net/wsServer.ts:206` and `README.md:96`.
- **Evidence**:
  - `docs/FLY-DEPLOYMENT.md:85` advises: *`set fly secrets set WORLD_SEED="austin-dungeon-prod-1" or add it under [env] in fly.toml`*, echoing `infra/README.md:47` (*"The production world seed is `austin-dungeon-prod-1`"*).
  - However, `wsServer.ts:206` parses `WORLD_SEED` via `Number(process.env.WORLD_SEED) || 1337`. `Number("austin-dungeon-prod-1")` is `NaN`, silently falling back to `1337`! (Additionally, `WORLD_SEED="0"` also falls back to `1337` due to `||`.)
- **Proposed Fix**:
  - Update `docs/FLY-DEPLOYMENT.md:85` (and `infra/README.md:47`) to specify an explicit integer `WORLD_SEED` (or add deterministic FNV-1a string hashing in `wsServer.ts` if string seeds are intended, and document both).

#### `DOC-06` (High — `archive/v1` Contamination & Hardcoded Drive Link in `docs/LESSONS.md`): 40% of `docs/LESSONS.md` Applies to Deleted `v1` Finite-Floor Code
- **Locations**:
  - `docs/LESSONS.md:8-24`
- **Evidence**:
  - `AGENTS.md:24-25` designates `docs/LESSONS.md` as high-signal guidance read by every coding agent. Yet `L8-23` contain **7 lessons from the retired `archive/v1` maze/room dungeon generator** referencing modules and concepts that do not exist in the `overworld` codebase:
    - `terrainMaterialRoles.ts` (`L8` — missing)
    - `finiteFloor.ts` / `sliceGeneratedFloorChunk` (`L9` — missing)
    - Room region ID reuse, room entrance candidate drops, disconnected maze crossings, room-isolation chunks (`L13-16`)
    - Floor load Web Workers & stationary generation preview hover stages (`L21-22`)
  - `L24` contains a machine-specific broken link pointing to a `D:` drive with mismatched repo casing: `[vite.config.ts](file:///d:/repos/dungeoncrawler2D/packages/client/vite.config.ts)`.
- **Proposed Fix**:
  - Delete the 7 `archive/v1` bullets (`L8-9`, `L13-16`, `L21-22`) so AI agents aren't misled about non-existent `finiteFloor.ts` or workers, and convert `L24` to a relative repo link `[packages/client/vite.config.ts](../packages/client/vite.config.ts)`.

#### `DOC-07` (High — Severe Spec-to-Code Drift in `docs/frontier/`): Frontier Specs (`MASTER-PLAN`, `02`, `03`, `04`, `05`, `06`) Contradict Actual Biome Radii, Danger Tiers, POI Counts, Recipes & Hotbar UX
- **Locations**:
  - `docs/frontier/MASTER-PLAN.md:4, 12, 22, 36-39, 50-51`
  - `docs/frontier/02-item-card-and-inspection-ui.md:11, 43`
  - `docs/frontier/03-dynamic-loot-tables-and-frontier-scaling.md:12-26, 67-68`
  - `docs/frontier/04-five-biomes-overworld-generation.md:13`
  - `docs/frontier/05-diverse-pois-shrines-puzzles-and-lairs.md:1, 12`
  - `docs/frontier/06-discovery-banners-map-pins-and-log.md:44`
- **Evidence**:
  1. **World Scale & DangerTier Formula (`03:12-26`, `04:13`, `MASTER-PLAN:12, 50`)**: Specs state Spawn Glade is `r < 28` tiles, Cursed Ruinlands starts at `r > 70`, and `DangerTier` is `1 | 2 | 3 | 4` at `r = 48 / 112 / 192` tiles using `max(distanceTier, biomeTier)`. In live `macroBiome.ts:5-39`, `SPAWN_SAFE_BIOME_RADIUS = 220`, `TIER_DISTANCES` are **`1000 / 2000 / 3500 / 6000` tiles** across **5** tiers (`1..5`), and `computeDangerTier(_biome, wx, wy)` ignores `_biome` completely!
  2. **POI Count Arithmetic (`MASTER-PLAN:4 vs 22, 38-39, 51`; `05:1, 12`; `06:44`)**: `MASTER-PLAN:4` says `18 New POIs (20 Total)`, then `L22, 38-39, 51`, `05:1, 12`, and `06:44` say `17 new POIs (19 total)` and `X / 19 Landmark Types`, even though `05` lists `4 + 6 + 4 + 2 + 2 = 18` new POIs and `poiCatalog.ts:30-54` has **`20`** POIs!
  3. **Reverted Hotbar Click UX (`02:11, 43`)**: Spec 02 mandates opening `ItemCardPopover` whenever clicking a hotbar slot during gameplay — which was reverted as `BUG-02` (`BUG-FIX-LOG.md:22-29`) in favor of hover preview + modal-only click pinning.
  4. **Unimplemented Workbench Gating (`03:67-68`)**: Spec 03 states Frontier weapons, armor sets, and shields are crafted at a **Workbench**, whereas `frontierRecipes.ts:16-48` defines **zero** `requiresWorkbench` flags (using hand-crafting or `requiresCampfire: true`; deferred to Phase 8 Pass 2).
- **Proposed Fix**:
  - Because root `README.md:26` links `docs/frontier/MASTER-PLAN.md` as active documentation, engineers/agents reading `docs/frontier/*` get false constants and contracts. Graduate the remaining unique details (`01` prefix table, `07` proximity chat rules) into colocated `README.md`s, remove `docs/frontier/MASTER-PLAN.md` from root `README.md`, and delete `docs/frontier/`.

#### `DOC-08` (High — Un-Retired Point-in-Time Overhaul Folder): `docs/frontier/` (`9` Files, `52.1 KB`) Violates Single-Source Colocated Documentation Rules
- **Locations**:
  - `docs/frontier/BUG-FIX-LOG.md` + `MASTER-PLAN.md` + `01-*.md`..`07-*.md`
  - Cross-checked against `AGENTS.md:21-25` (*"Architecture and subsystem documentation lives in concise `README.md` files next to the code they describe"*).
- **Evidence**:
  - All 9 files in `docs/frontier/` represent a completed milestone (`Phase 8A`, commits `cdb79366..cb94d6db`). Keeping `BUG-FIX-LOG.md` (13.8 KB of fixed QA notes) and 8 spec files alongside `docs/ROADMAP.md` and colocated `README.md`s creates a 3-way split of truth while leaving actual Frontier code folders (`sim/frontier/`, `sim/chat/`, `ui/chat/`, `ui/discovery/`, `world/biomes/`, `world/pois/`) with **zero** colocated `README.md`s!
- **Proposed Fix**:
  - Delete `docs/frontier/BUG-FIX-LOG.md` and `docs/frontier/MASTER-PLAN.md` + `01..07` after graduating concise living `README.md`s into the Frontier code folders (see Section 5 Consolidation Plan).

#### `DOC-09` (High — Un-Graduated Shipped Phase Specs): `docs/phases/phase-6-*.md` & `phase-7-*.md` (`48.7 KB`) Retain Pre-Fix Audit Tables & Stream-of-Consciousness Draft Notes
- **Locations**:
  - `docs/phases/phase-6-stealth-and-ecological-ai.md:1-191` (`26,685` bytes)
  - `docs/phases/phase-7-weapon-movesets-and-combat-feel.md:1-167` (`21,982` bytes)
- **Evidence**:
  - Both phases are marked `✅ Complete`, and their shipped architectures already live in `packages/engine/src/combat/README.md`, `packages/game-server/src/sim/wildlife/README.md`, `packages/game-server/README.md`, and `packages/client/src/render/combat/README.md` (with the two deferred polish items already tracked in `docs/phases/phase-12-coop-polish-adaptive-music-and-qa-benchmarks.md:4, 20, 59-65`).
  - Both files still carry `"## 2. Pass-1 Audit (What Exists vs What Is Half-Baked)"` tables (`phase-6:25-36`, `phase-7:26-38`) describing old bugs as current state, plus raw conversational brainstorming in `phase-7:120-123` (*"Wait: to ensure zero tap latency... NO—standard crisp Souls/Action pattern... Wait—remember Right-Click blocks..."*) and outdated mechanics (`phase-6:48, 81` keys; pre-v0.11.9 scent tracking).
- **Proposed Fix**:
  - Establish a strict **Phase Spec Graduation Lifecycle**: once a phase passes `verify:phase` and its architecture is merged into colocated `README.md`s + `docs/ROADMAP.md` summary bullets, delete the historical `docs/phases/phase-<N>-*.md` spec (or move to `docs/archive/` excluded from active agent context). Delete `phase-6` and `phase-7` now.

#### `DOC-10` (High — Self-Contradictory Gate Spec & Vacuous E2E/REQ Coverage): `docs/VERIFICATION-GATE.md` Mixes "Active" and "Planned" Claims While `verify:spec -- all-completed` Verifies `0` Requirements
- **Locations**:
  - `docs/VERIFICATION-GATE.md:3-4, 79-88, 106-124`
  - Cross-checked against `package.json:20-23`, `.github/workflows/quality.yml:28-43`, `scripts/verify/spec-coverage.mjs:53-76`, and `e2e/baseline-smoke.spec.ts`.
- **Evidence**:
  1. `VERIFICATION-GATE.md:3` states `> **Status**: ✅ Tooling & CI Active (enforced across all Phase 8–13 PRs and release PRs from develop into main)`, and `package.json:20-23` + `quality.yml:28-35` DO implement `verify:content`, `verify:e2e`, `verify:spec`, and `verify:phase`.
  2. Yet `VERIFICATION-GATE.md:106-124` is still titled **`## 4. Planned CLI & CI Enforcement`** with column **`Planned Command`** and **`When the Verification Gate tooling is implemented, .github/workflows/quality.yml will execute...`** — making readers think the scripts in `package.json` don't exist yet!
  3. Furthermore, `VERIFICATION-GATE.md:84` states Playwright runs with `ADMIN_TOKEN=e2e-test-token` and exercises interactive UI, HUD, and persistence flows (`L14`), whereas `e2e/` currently contains only `e2e/baseline-smoke.spec.ts` (no phase specs yet) and `verify:spec -- all-completed` in CI (`quality.yml:35`) matches **zero** completed Phase `>= 8` specs (`0 REQs verified`).
- **Proposed Fix**:
  - Rewrite Section 4 of `docs/VERIFICATION-GATE.md` from `"Planned"` to `"Active CLI & CI Commands"`, document `npm run verify:spec -- --check-specs` (default syntax mode in `spec-coverage.mjs:79`), clarify that `e2e/baseline-smoke.spec.ts` is the active pre-Phase-8 baseline harness until `e2e/phase-8.spec.ts` lands, and add the `verify:*` commands to root `README.md` (`L50-60`) and `AGENTS.md` (`L27-35`).

---

### Medium Severity

#### `DOC-11` (Medium — Root `README.md` Index Drift): Root `README.md` Omits 18 of 33 Package/Colocated `README.md`s + Sprite Studio Docs, and Describes a Legacy Phase-3 `32×32` 4-Dir Hero Rig
- **Locations**:
  - `README.md:22-44`
- **Evidence**:
  1. `README.md:40` describes `packages/client/src/render/character/README.md` as: *"Layered `32×32` (`0.75×` world-scale) 4-directional paper-doll compositor, Hybrid Weapon Grip Socket arm rig, & LRU texture cache"* — three major versions out of date! The hero compositor renders **8-directional `192×192` (`0.20×` world-scale) 3D Blender-baked layers** packed into 2-tier `<= 1536×1536` atlases (contradicting `README.md`'s own `v0.11.10` header on `L7`!).
  2. `README.md:42` describes `ui/hud/README.md` as *"5-slot Inventory/Craft swap"* (garbled phrasing for 5 armor/offhand slots + 27-slot backpack + Craft toggle).
  3. **18 existing colocated `README.md`s** (out of `33` under `packages/**`) + **2 `tools/sprite-studio/` docs** are completely absent from the `README.md:22-44` Documentation table:
     - Engine (`2` missing): `packages/engine/src/combat/hitboxes/README.md`, `packages/engine/src/survival/README.md`
     - Game Server (`4` missing): `packages/game-server/src/sim/survival/README.md`, `packages/game-server/src/sim/webs/README.md`, `packages/game-server/src/sim/wildlife/README.md`, `packages/game-server/src/sim/wildlife/tracking/README.md`
     - Client (`12` missing): `packages/client/src/admin/README.md`, `packages/client/src/audio/creatures/README.md`, `packages/client/src/render/combat/gore/README.md`, `packages/client/src/render/combat/webs/README.md`, `packages/client/src/render/poseTuning/README.md`, `packages/client/src/render/shaders/README.md`, `packages/client/src/render/survival/README.md`, `packages/client/src/render/world/README.md`, `packages/client/src/sandbox/README.md`, `packages/client/src/sandbox/poseTuner/README.md`, `packages/client/src/ui/loading/README.md`, `packages/client/src/ui/map/README.md`
     - Tools (`2` missing): `tools/sprite-studio/README.md`, `tools/sprite-studio/PLAYER_EDITING_TUTORIAL.md`
- **Proposed Fix**:
  - Instead of maintaining a brittle flat list of 40+ leaf `README.md`s in root `README.md`, list top-level docs + the **4 workspace `README.md`s** (`engine`, `content`, `game-server`, `client`) + `tools/sprite-studio/README.md` + `docs/FLY-DEPLOYMENT.md` in root `README.md`, and make each workspace `README.md` the complete, lint-verified index of its own `src/**/README.md` tree. Fix `L40` and `L42` descriptions immediately.

#### `DOC-12` (Medium — Stale Metrics in `docs/ROADMAP.md`): Completed Phase Summaries Cite Superseded Map Dimensions/Zoom and Controls
- **Locations**:
  - `docs/ROADMAP.md:82, 91, 96`
- **Evidence**:
  - `L82` states the Overworld Map is `360×360` with `1×/2×/3×` zoom, whereas `packages/client/src/ui/map/README.md:4` and `minimapOverlay.ts` upgraded it to **`480×480`** with **`2× / 3× / 4×`** zoom.
  - `L91` claims mobile swipe-to-roll (removed) and `L96` swaps `C` and `X`/`Q` keybindings (covered in `DOC-03`).
- **Proposed Fix**:
  - Update `docs/ROADMAP.md:82, 91, 96` (or annotate superseded Phase 5C/5D/6 bullets with `*(updated in later pass)*`) so readers scanning `ROADMAP.md` don't copy stale constants or controls.

#### `DOC-13` (Medium — Misplaced Files & Omitted Modules in `ui/hud/README.md`): `packages/client/src/ui/hud/README.md` Documents Sibling `ui/` Files as Local while Omitting Local `hud/` Files & the Map Hotbar Button
- **Locations**:
  - `packages/client/src/ui/hud/README.md:5-8`
  - Cross-checked against `packages/client/src/ui/` and `packages/client/src/ui/hud/bottomHotbar.ts:44-51, 87-89`.
- **Evidence**:
  1. `L5` lists `atmosphereToolbar.ts`, `settings/`, `FpsCounter`, and `PingCounter` under `ui/hud/`, when those files actually live one directory higher in `packages/client/src/ui/atmosphereToolbar.ts`, `packages/client/src/ui/fpsCounter.ts`, and `packages/client/src/ui/settings/` (which have no `ui/README.md`).
  2. `L6` states `BottomHotbar` renders *"Slots `0..8` plus the glowing/dimmed built-in **Lantern** toggle (`F`)"*, omitting the permanent **`Overworld Map` (`M`)** button mounted right beside Lantern in `bottomHotbar.ts:44-51, 87-89`.
  3. Meanwhile, 3 actual files inside `ui/hud/` (`craftingPanel.ts`, `characterPanel.ts`, `debugSpawnPopover.ts`) are never named in `ui/hud/README.md`.
- **Proposed Fix**:
  - Move toolbar/FPS/settings docs into a new `packages/client/src/ui/README.md` (or use explicit `../atmosphereToolbar.ts`, `../fpsCounter.ts`, `../settings/` paths), add the `M` Map button to `L6`, and document `craftingPanel.ts`, `characterPanel.ts`, and `debugSpawnPopover.ts`.

#### `DOC-14` (Medium — Active Phase 8 Spec Touchpoint & Catalog Gap): `docs/phases/phase-8-*.md` Cites Non-Existent `src/ui/panels/craftingPanel.ts` and Leaves Two `shadowsteel` Armor Items Without Recipes
- **Locations**:
  - `docs/phases/phase-8-gathering-survival-and-camp-building.md:9, 35`
  - Cross-checked against `packages/client/src/ui/hud/craftingPanel.ts`, `packages/content/src/items/frontierArmor.ts`, and `packages/content/src/recipes/frontierRecipes.ts:42-43`.
- **Evidence**:
  1. `L9` lists `@dc2d/client` touchpoint `src/ui/panels/craftingPanel.ts` — there is **no `src/ui/panels/` directory**; the file is `packages/client/src/ui/hud/craftingPanel.ts`.
  2. `L35` specifies migrating `craft-shadowsteel-*` recipes to `requiresWorkbench: true`, while `frontierRecipes.ts:42-43` only defines `craft-shadowsteel-cowl` and `craft-shadowsteel-coat` (omitting `shadowsteel-legguards` and `shadowsteel-boots`, which only drop from loot tables despite `docs/frontier/01-*:43` & `03-*:68` describing full 4-piece Workbench armor sets).
- **Proposed Fix**:
  - Fix `L9` in `docs/phases/phase-8-gathering-survival-and-camp-building.md` to `src/ui/hud/craftingPanel.ts`, and clarify in `L35` whether `shadowsteel-legguards`/`shadowsteel-boots` remain loot-exclusive or gain Workbench recipes in Phase 8 Pass 2.

#### `DOC-15` (Medium — Stale `.png` References After `.webp` Migration): 4 Docs Still Reference `.png` Assets Replaced by Lossless `.webp` Sheets
- **Locations**:
  - `packages/client/src/render/world/README.md:6` (`weapon-bow.png` -> actual: `packages/client/public/assets/player/weapon-bow.webp`)
  - `packages/client/src/render/combat/README.md:8` (`64×64 open/closed PNGs from /assets/pois/` -> actual: `chest-{wood,stone}-{open,closed}.webp`)
  - `packages/client/src/sandbox/README.md:11` (`All 9 unified 0.50× 18-color PNG enemies ... and 80×80 golem` -> actual: `0.3333×` `48 px/m` `.webp` sheets in `public/assets/creatures/`, `96×96` to `192×192`)
  - `docs/phases/phase-7-weapon-movesets-and-combat-feel.md:73` (`weapon-bow.png`)
- **Proposed Fix**:
  - Update `render/world/README.md:6`, `render/combat/README.md:8`, and `sandbox/README.md:11` to cite lossless `.webp` assets and current `48 px/m` (`0.3333×`) dimensions (and archive/delete `phase-7` per `DOC-09`).

#### `DOC-16` (Medium — Stale Subsystem `README.md` Claims Across Engine, Server & Client): 6 Colocated `README.md`s Omit Shipped Frontier/Phase-6/Phase-5C Additions or Cite Replaced Mechanics
- **Locations & Exact Drift**:
  1. `packages/engine/src/character/README.md:10`: Lists only `6` `Hair Color` keys (`brown | black | blonde | red | silver | teal`); `packages/engine/src/character/appearance.ts:8-12` defines **`18`** `HAIR_COLORS` (12 solid + 6 two-tone gradients).
  2. `packages/engine/src/survival/README.md:5, 8`: Lists only `8` harvestable props in `harvestRules.ts`, omitting all `6` Frontier nodes in `harvestRules.ts:30-41` (`BirchTree`, `MapleTree`, `DeadTree`, `GiantMushroom`, `BogReed`, `CursedCrystal`) plus `litBraziers` / `unlockedVaults` in `worldDeltas.ts`.
  3. `packages/engine/src/combat/README.md:8, 13`: Omits `"stone"` from `GoreSubstance` (`L8`) and still claims `"web-slow"` in `weaponMovesets.ts` (`L13`), which was replaced by `WorldWebNetwork` cloth stickiness & cocoons.
  4. `packages/game-server/src/sim/wildlife/README.md:8`: Still claims `"spider horizontal parabolic pounce + 1.8s Web-Slow"` (replaced by venom poison + cloth webs per `phase-6:152`) and omits `wildlife/loot/` (`eliteScaling.ts`, `lootTypes.ts`).
  5. `packages/client/src/render/shaders/README.md:3-8`: Omits `tilemapMesh.ts` + `glsl/tilemapGlsl.ts` (`17`-row GPU terrain tilemap shader), `shaderDiag.ts`, and Frontier biome particle modes (`spore`, `ash`, `wisp`, `smoke`).
  6. `packages/client/src/admin/README.md:6-17`: States `ADMIN_TOKEN` comes `(from AWS SSM in prod)` (ignoring Fly.io secrets) and omits all server-side chat slash commands (`/god`, `/give`, `/fillbag`, `/clearbag`, `/tp`, `/biome`, `/poi`) in `adminSlashCommands.ts`.
- **Proposed Fix**:
  - Update each of the 6 colocated `README.md` files in place to match current exports and mechanics.

#### `DOC-17` (Medium — 5-to-8 Line Package Root `README.md` Stubs): `@dc2d/engine`, `@dc2d/content`, `@dc2d/client`, and `client/src/render` Root `README.md`s Omit Half Their Subsystems
- **Locations**:
  - `packages/engine/README.md:1-8` (`475` bytes — omits `src/combat/` and `src/survival/`!)
  - `packages/content/README.md:1-5` (`683` bytes — omits `src/biomes/`, `src/items/lootTables.ts`, and `src/world/`!)
  - `packages/client/README.md:1-7` (`832` bytes — omits `src/audio/`, `src/soundStudio/`, `src/sandbox/`, `src/admin/`, `src/render/character/`, `src/render/combat/`, `src/ui/chat/`, `src/ui/discovery/`!)
  - `packages/client/src/render/README.md:1-7` (`1,358` bytes — omits `character/`, `survival/`, `poseTuning/`, `textures/biomes/`, `textures/pois/`, `world/chat/`)
- **Proposed Fix**:
  - Expand each package root `README.md` into a concise `15–30` line architectural entry point with a complete directory table linking every direct `src/<domain>/README.md` and public export boundary.

#### `DOC-18` (Medium — Missing Colocated `README.md`s in 16 Major Feature Folders): Core Networking, Input, Textures, Frontier, Combat Sim & UI Subsystems Have Zero Colocated Docs
- **Locations** (verified across all `68` `packages/*/src/**` directories; `29` have `README.md`, `39` do not — of which `23` are small leaf/helper folders covered by parent `README.md`s and **`16` are major undocumented subsystems**):
  - **`@dc2d/engine` (1 major gap)**:
    - `packages/engine/src/net/` (`6` files: `protocol.ts`, `chatSchemas.ts`, `discoverySchemas.ts`, `worldDeltaSchemas.ts`, `worldEventSchemas.ts`) — **the entire client/server wire protocol has no `README.md`!** *(Also `world/biomes/` [3 files] & `world/pois/` [6 files] are only summarized at 1 bullet each in `world/README.md`.)*
  - **`@dc2d/content` (3 gaps)**:
    - `packages/content/src/items/` (`9` files: catalog, rarities, prefixes, lootTables, statResolver, frontier gear)
    - `packages/content/src/recipes/` (`2` files) & `packages/content/src/biomes/` (`1` file) — can be documented cleanly in an expanded `packages/content/README.md` or `items/README.md`.
  - **`@dc2d/game-server` (5 major gaps)**:
    - `packages/game-server/src/net/` (`5` files: `wsServer.ts`, `adminAuth.ts`, `snapshotFilter.ts`)
    - `packages/game-server/src/sim/` + `packages/game-server/src/sim/combat/` (`19` files combined: `worldSim.ts`, `combatSim.ts`, `meleeTimeline.ts`, `playerCombatHits.ts`, `gearEffects.ts`, `statusEffects.ts`, `adminActions.ts`)
    - `packages/game-server/src/sim/frontier/` (`4` files: `adminSlashCommands.ts`, `discoveryTracker.ts`, `poiInteractions.ts`)
    - `packages/game-server/src/sim/chat/` (`2` files: `proximityChat.ts`)
  - **`@dc2d/client` (7 major gaps)**:
    - `packages/client/src/input/` (`7` files: `controller.ts`, `mobileCombatControls.ts`, `inputMode.ts`, `inputHelpers.ts`)
    - `packages/client/src/net/` + `socket/` (`13` files: `worldClient.ts`, `worldPrediction.ts`, `localSwingTracker.ts`, `clientInventory.ts`, `worldClientSocket.ts`)
    - `packages/client/src/render/textures/` (`13` files across `textures/`, `biomes/`, `pois/`)
    - `packages/client/src/ui/` (`4` files: `atmosphereToolbar.ts`, `fpsCounter.ts`, `fullscreen.ts`, `toolbarStyles.ts`)
    - `packages/client/src/ui/settings/` (`6` files: `settingsMenu.ts`, `cameraZoom.ts`, `settingsPrefs.ts`)
    - `packages/client/src/ui/icons/` (`5` files: `32×32` procedural icon painters)
    - `packages/client/src/ui/chat/` (`2` files) & `packages/client/src/ui/discovery/` (`3` files) & `packages/client/src/ui/overlays/` (`2` files)
- **Proposed Fix**:
  - Add concise (`10–25` line) colocated `README.md`s to the **12 highest-leverage subsystem roots** (`engine/src/net/`, `content/src/items/`, `game-server/src/net/`, `game-server/src/sim/`, `game-server/src/sim/frontier/`, `client/src/input/`, `client/src/net/`, `client/src/render/textures/`, `client/src/ui/`, `client/src/ui/settings/`, `client/src/ui/chat/`, `client/src/ui/discovery/`), absorbing the retired `docs/frontier/01..07` content directly next to the code.

#### `DOC-19` (Medium — Overlapping Sprite Studio Guides): `tools/sprite-studio/README.md` and `PLAYER_EDITING_TUTORIAL.md` Duplicate 65 Lines of CLI Commands & Rigging Rules
- **Locations**:
  - `tools/sprite-studio/README.md:23-87`
  - `tools/sprite-studio/PLAYER_EDITING_TUTORIAL.md:11-50, 105-147`
- **Evidence**:
  - Both files maintain nearly identical copies of the 16 player layer IDs, `npm run player:bake` CLI invocations, `Rest Position` vs `Pose Position` warnings, `ARMATURE_AUTO` weight-transfer instructions, and `Core_Rig` / `Hero_Skin` protected hook checklists (note subtle drift already starting: `README.md:38-57` uses `player_v2.blend` in examples while `PLAYER_EDITING_TUTORIAL.md:128-143` uses `player.blend`).
- **Proposed Fix**:
  - Keep `tools/sprite-studio/README.md` focused on **CLI usage, creature/gear bake pipeline, and module architecture** (replacing `L30-87` with a 10-line quick-bake summary linking to `PLAYER_EDITING_TUTORIAL.md`), and make `PLAYER_EDITING_TUTORIAL.md` the single canonical Blender sculpting & rigging guide.

---

### Low Severity

#### `DOC-20` (Low — Missing Scripts & Env Vars in `README.md` & `AGENTS.md`): Root Docs Omit `verify:*`, `sprite:bake`, `player:bake`, `ADMIN_TOKEN`, `DEBUG_COMMANDS`, and `PORT`
- **Locations**:
  - `README.md:50-60, 92-100`
  - `AGENTS.md:27-35`
  - Cross-checked against `package.json:20-25` and `packages/game-server/src/net/adminAuth.ts` / `wsServer.ts`.
- **Evidence**:
  - `README.md:50-60` (`Getting started`) documents 8 commands but omits `npm run verify:content`, `npm run verify:e2e`, `npm run verify:spec`, `npm run verify:phase`, `npm run sprite:bake`, and `npm run player:bake`.
  - `README.md:92-100` (`Configuration reference`) omits `ADMIN_TOKEN` (production admin auth secret) and `DEBUG_COMMANDS` (`0` disables dev auto-admin).
  - `AGENTS.md:27-35` (`Validation workflow`) omits running `npm run verify:content` (and `npm run verify:phase` on phase completion) despite `docs/VERIFICATION-GATE.md:110` requiring `verify:content` on every PR & pre-commit.
- **Proposed Fix**:
  - Add the `verify:*` and `*:bake` scripts + `ADMIN_TOKEN` / `DEBUG_COMMANDS` env vars to `README.md`, and add `npm run verify:content` to `AGENTS.md`'s validation checkpoint.

#### `DOC-21` (Low — Hardcoded Non-Default Port in `tools/sprite-studio/README.md`): Sandbox Preview URL Uses Port `5174` Instead of Default `5173`
- **Locations**:
  - `tools/sprite-studio/README.md:21`
- **Evidence**:
  - Step 3 tells artists: `Refresh http://localhost:5174/?sandbox=1 to preview live`, whereas Vite's configured default dev port is `5173` (`README.md:59, 64`).
- **Proposed Fix**:
  - Change to `http://localhost:5173/?sandbox=1` (noting Vite auto-increments if `5173` is busy).

#### `DOC-22` (Low — Duplicate Token in `AGENTS.md`): Minor Typo in F-Bomb Derivative List
- **Locations**:
  - `AGENTS.md:6-7`
- **Evidence**:
  - Lists `"fucking,"` twice with mismatched smart/straight quotes (`“fucking,” “fucker,” “fuckers,” "fucking,"`).
- **Proposed Fix**:
  - Remove the duplicate `"fucking,"` entry when updating `AGENTS.md` for `DOC-20`.

---

## 4. Source Directory Colocated `README.md` Coverage Matrix

Out of **68** non-test source directories under `packages/*/src/**`:
- **29 directories** have a colocated `README.md` (**11** linked in root `README.md`, **18** unlisted — plus `4` package-root `README.md`s all linked in root `README.md` = `33` total under `packages/`).
- **23 directories** are small leaf subfolders (`1–5` files, e.g., `audio/weapons/`, `render/character/atlas/`, `render/shaders/glsl/`, `soundStudio/timeline/`, `ui/hud/drag/`, `ui/hud/itemCard/`) already documented cleanly inside their immediate parent `README.md` — **do NOT create micro-READMEs here**.
- **16 directories** are substantive domain boundaries lacking colocated `README.md`s (`DOC-18`):

| Workspace | Undocumented Source Folders Requiring Coverage | Recommended Coverage Target |
| :--- | :--- | :--- |
| `@dc2d/engine` | `src/net/` (6 files), `src/math/` (2), `src/time/` (2), `src/world/biomes/` (3), `src/world/pois/` (6) | Create **`packages/engine/src/net/README.md`**; expand `packages/engine/README.md` (`math/`, `time/`) and `packages/engine/src/world/README.md` (`biomes/`, `pois/`). |
| `@dc2d/content` | `src/items/` (9 files), `src/recipes/` (2), `src/world/` (2), `src/biomes/` (1), `src/character/` (1) | Expand **`packages/content/README.md`** into a full catalog/recipe/biome/palette guide + create **`packages/content/src/items/README.md`** (absorbing `docs/frontier/01` & `03`). |
| `@dc2d/game-server` | `src/net/` (5 files), `src/sim/` (10), `src/sim/combat/` (9), `src/sim/frontier/` (4), `src/sim/chat/` (2) | Create **`src/net/README.md`**, **`src/sim/README.md`** (covering `combat/`, `frontier/`, `chat/`), absorbing `docs/frontier/05..07`. |
| `@dc2d/client` | `src/input/` (7 files), `src/net/` + `socket/` (13), `src/render/textures/` (13), `src/ui/` (4), `src/ui/settings/` (6), `src/ui/icons/` (5), `src/ui/chat/` (2), `src/ui/discovery/` (3), `src/ui/overlays/` (2) | Create **`src/input/README.md`**, **`src/net/README.md`**, **`src/render/textures/README.md`**, and **`src/ui/README.md`** (indexing `settings/`, `icons/`, `chat/`, `discovery/`, `overlays/`). |

---

## 5. Concrete Documentation Consolidation & Lifecycle Plan

### Phase A — Delete Dead & Shipped Spec Bloat (`-12` Markdown Files, `-132 KB`)
1. **Delete `assets/INVENTORY.md`** (`1` file, `DOC-01`) — 100% obsolete Phaser/`0x72` inventory.
2. **Delete `docs/frontier/BUG-FIX-LOG.md`** (`1` file, `DOC-08`) — completed QA scratchpad; durable lessons already live in `docs/LESSONS.md:34-39`.
3. **Graduate & Delete `docs/frontier/MASTER-PLAN.md` + `01-*.md`..`07-*.md`** (`8` files, `DOC-07`, `DOC-08`) — fold accurate live contracts (`18` prefixes, `5` biomes/`TIER_DISTANCES`, `20` POIs, proximity chat `16`/`34`-tile rules) into colocated `README.md`s (`content/src/items/`, `engine/src/world/`, `game-server/src/sim/`, `client/src/ui/`), then remove `docs/frontier/`.
4. **Delete `docs/phases/phase-6-*.md` & `docs/phases/phase-7-*.md`** (`2` files, `DOC-09`) — already shipped and documented in colocated `README.md`s + `docs/ROADMAP.md` (with deferred animations tracked in `phase-12`).

### Phase B — Consolidate Overlapping Operational & Tooling Docs
1. **Unify Deployment Docs (`docs/FLY-DEPLOYMENT.md` + `infra/README.md`)**:
   - Keep `docs/FLY-DEPLOYMENT.md` as the authoritative game-server operations runbook (fixing the numeric `WORLD_SEED` note per `DOC-05`).
   - Trim `infra/README.md` from `194` lines to `~60` lines covering **only** the active S3 + CloudFront + ACM + GitHub OIDC static client stack, with a short "Legacy EC2 Retirement" section (`DOC-02`).
2. **De-duplicate Sprite Studio Docs (`tools/sprite-studio/README.md` + `PLAYER_EDITING_TUTORIAL.md`)**:
   - Replace the 65-line duplicated sculpting checklist in `tools/sprite-studio/README.md:23-87` with a crisp CLI reference + pointer to `PLAYER_EDITING_TUTORIAL.md` (`DOC-19`).
3. **Two-Tier `README.md` Hierarchy**:
   - Root `README.md` links only **repo-level docs** (`ROADMAP.md`, `VERIFICATION-GATE.md`, `LESSONS.md`, `FLY-DEPLOYMENT.md`, `infra/README.md`, `tools/sprite-studio/README.md`) + the **4 workspace `README.md`s**.
   - Each workspace `README.md` (`engine`, `content`, `game-server`, `client`) links every colocated `src/**/README.md` inside its package (`DOC-11`, `DOC-17`).

### Phase C — Formal Phase-Spec Graduation Rule (Add to `AGENTS.md` & `VERIFICATION-GATE.md`)
To prevent `docs/phases/` from turning into a second graveyard of drifted specs as Phases 8–13 ship:
1. **`docs/phases/phase-<N>-*.md` is an active build & verification contract** while status is `📋` or `🚧`.
2. **At Phase Sign-Off (`npm run verify:phase -- phase-<N>`)**:
   - Update affected colocated `README.md`s with the final shipped module names, tuning locations, and boundaries.
   - Condense the phase summary in `docs/ROADMAP.md` to match shipped reality.
   - Keep `REQ-P<N>-*` traceability tables either in a compact `docs/SPEC-TRACEABILITY.md` ledger or retain `docs/phases/phase-8..13` **strictly stripped of pre-implementation "Pass-1 Audit" prose** so `verify:spec -- all-completed` continues validating every `[REQ-P<N>-<NN>]` test tag in CI without prose drift.

### Phase D — Deterministic Documentation Freshness Gate (`npm run verify:docs`)
Add a zero-dependency Node script `scripts/verify/doc-integrity.mjs` (`"verify:docs": "node scripts/verify/doc-integrity.mjs"`) wired into `npm run lint` and `.github/workflows/quality.yml` that enforces 5 deterministic checks in `< 200ms`:
1. **Markdown Link Resolution**: Every relative `[label](path#anchor)` and `file://` link across all `.md` files resolves to an existing repo file (banning `file:///c:/...` or `file:///d:/...` absolute machine paths — catches `DOC-01`, `DOC-02`, `DOC-06`, `DOC-14`).
2. **Backticked File Reference Existence**: Every backticked repo path or unambiguous module filename (`*.ts`, `*.mjs`, `*.py`, `*.json`, `*.png`, `*.webp`, `*.glsl`) in `README.md`, `docs/LESSONS.md`, `docs/VERIFICATION-GATE.md`, and `packages/**/README.md` resolves to an existing file on disk (catches `playerArmIk.ts`, `weapon-bow.png`, `terrainMaterialRoles.ts`, `finiteFloor.ts`, `src/ui/panels/craftingPanel.ts` — `DOC-04`, `DOC-06`, `DOC-14`, `DOC-15`).
3. **Colocated `README.md` Orphan Check**: Every `packages/<pkg>/src/**/README.md` must be linked from its owning `packages/<pkg>/README.md` (or parent `src/<domain>/README.md`), ensuring zero invisible docs (`DOC-11`).
4. **Script & Env-Var Parity**: Every script in root `package.json` (`scripts.*`) is mentioned in root `README.md` or `docs/VERIFICATION-GATE.md` (`DOC-20`).
5. **Public Asset Hygiene**: Every directory under `packages/client/public/assets/` is either referenced by runtime loader/manifest code or explicitly allowlisted, preventing `~40 MiB` of undocumented asset packs from silently shipping to production (`DOC-01`).
