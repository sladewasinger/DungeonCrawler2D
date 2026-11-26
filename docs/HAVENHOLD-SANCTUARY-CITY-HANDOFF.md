# Havenhold Fortified Sanctuary City — Exhaustive Pass 2 Spec & Desktop Handoff

> **Status**: Ready for autonomous implementation (`Milestones 9B -> 9C -> 9D -> 9E`) on Austin's desktop PC.
> **Parent Spec**: [Phase 9 Specification](phases/phase-9-fog-of-war-and-safe-room-hubs.md) (`REQ-P9-01`..`REQ-P9-36`)
> **Project Roadmap**: [ROADMAP.md](ROADMAP.md) | **Verification Gate**: [VERIFICATION-GATE.md](VERIFICATION-GATE.md) | **Pitfalls Ledger**: [LESSONS.md](LESSONS.md) | **Repo Rules**: [AGENTS.md](../AGENTS.md)

---

## 1. Mission Context, Git State & Desktop Transfer Checklist

### 1.1 Exact Repository State at Handoff
- **Active Branch**: `feat/phase-9-fog-hubs-economy`
- **Verified Code Baseline Commit**: `d69cf481` (`feat(phase-9): Fog-of-War map, Sanctuary Hubs, Gold economy, Blacksmith, Bounties & Stash`)
  - Stacked chain from base: `feat/audit-stage-2` (`0c21d415`) -> `feat/audit-stage-3` (`474b7682`) -> `feat/phase-8-pass-2` (`2194811f`) -> `feat/phase-9-fog-hubs-economy` (`d69cf481` + this handoff docs commit).
- **What Is Already Complete & Verified (`d69cf481`)**:
  - **Stage 1–3 Audits**: `knip` dead-code gate (`npm run lint:deadcode`), `staticSvg` XSS/DOM hardening, shared kinematics, `ZoneManager`/`ZoneInstance` multi-zone engine, `SpatialHashGrid`, SQLite WAL persistence.
  - **CI & Node 24 Hotfix (PR #11)**: Fixed `dist-artifacts` (`client-dist`/`server-dist`) and upgraded CI/Dockerfile/engines to Node 24 (`actions/upload-artifact` v7, `download-artifact` v8, `node:24-alpine`); mirrored locally in `.github/workflows/`, `packages/game-server/Dockerfile`, and `package.json`.
  - **Tooling & Lint Rules**: Dedicated `tsconfig.eslint.json` replacing `projectService` limit; `sonarjs/cognitive-complexity` set to `10` per Austin's approval; `complexity: 8`, `max-lines: 250`, `max-lines-per-function: 35`, `max-depth: 3`, `max-params: 3`, `max-statements-per-line: 4`, `sonarjs/no-duplicate-string` (threshold `3`), and `scripts/check-folder-size.mjs` (`<= 12` non-test `.ts` files per folder).
  - **Phase 8 Pass 2 (`18/18` REQs)** & **Phase 9 Pass 1 (`16/16` REQs)**: Verified `9/9` on `npm run verify:phase -- phase-9`, `npm test` (`79/79` files, `273/273` tests), `npm run verify:spec -- all-completed` (`34` REQs).
  - **Working Tree Hygiene**: Zero uncommitted Slice 10A files; `feat/phase-10-progression-bosses-dcc` was deleted cleanly so Phase 9 Pass 2 ships BEFORE Phase 10 begins.

### 1.2 Desktop Environment & Workflow Setup
1. **Sync on Desktop**: Pull `feat/phase-9-fog-hubs-economy` (ensure `feat/phase-8-pass-2` is also fetched/pushed if reviewing stacked diffs).
2. **Dependencies & Tools**:
   - **Node**: `>= 24.x` (`node -v`). Run `npm ci` + `npx playwright install chromium`.
   - **Blender 5.3**: Already supported by `tools/sprite-studio/runBake.mjs` (`BLENDER_BIN` or `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe`). On another Windows PC, `locateBlenderExecutable()` auto-discovers newest Blender under `Program Files\Blender Foundation\*` or via `BLENDER_BIN`.
3. **Mandatory Shell & Code Quality Rules ([AGENTS.md](../AGENTS.md))**:
   - **Windows PowerShell**: Never use `&&` in `run_command`; chain dependent commands with `; if ($?) { ... }`.
   - **Austin's F-Bomb Counter**: Count new occurrences of `"fuck"` and derivatives in every new Austin message and increment both the visible count and `<!-- f-bomb-count: N -->` in [README.md](../README.md) (currently `82`).
   - **Strict ESLint & Folder Limits**: Keep every file `<= 250` lines (non-blank/comment check — aim under `235` raw lines), every function `<= 35` lines, max nesting depth `3`, max params `3`, `complexity <= 8`, `cognitive-complexity <= 10`, zero `eslint-disable`/`@ts-ignore`/`innerHTML`, and strictly `<= 12` non-test `.ts` files in any directory.
   - **Iteration Validation**: During implementation use `npm run lint:working-tree` and `npm run ai:loop`; reserve full `npm run verify:phase -- phase-9` and `npm test` for verification checkpoints.
   - **Pacing Directive**: Austin explicitly chose **Continuous End-to-End Autonomous Build (`9B -> 9E`)** — execute `9B`, `9C`, `9D`, and `9E` straight through without pausing between sub-milestones, then graduate docs, commit cleanly on `feat/phase-9-fog-hubs-economy`, and present the completed Sanctuary City + visual QA screenshots before moving to Phase 10.

---

## 2. Locked `/grill-me` Design Decisions

All architectural ambiguities were resolved via interactive `/grill-me` before handoff:

1. **Scale, Walls & Gates**: **`256 × 256` Fortified Citadel City** (`8 × 8` chunks, `x, y ∈ [-128, 128]`), continuous `2`-tile-thick battlemented stone perimeter walls (`|x| = 128, |y| = 128`) with corner & interval watchtowers, and strictly **`4` Guarded Cardinal Gates** (`North`, `South`, `East`, `West`, `6` tiles wide). Everything outside exits seamlessly into the frontier wilderness.
2. **Building Architecture (Hybrid)**:
   - **Enterable Pocket Interior Zones** via `ZoneManager` + smooth fade transition (`~220ms`) for all major buildings:
     1. *The Rusty Flagon* Saloon (`interior:tavern`)
     2. *The Iron Anvil* Blacksmith Forge (`interior:blacksmith`)
     3. *The Gilded Scale* Merchant Emporium (`interior:merchant`)
     4. *The Artisan's Workshop* (`interior:artisan`)
     5. *Havenhold Guild Hall & Vault* (`interior:guild`)
     6. *Player's Buyable City Cottage* (`interior:player-cottage`)
   - **Seamless Roof-Cutaway Structures** directly on the city street grid for outer-block pocket cottages, residential houses, and street stalls (`CottageRoof` fades to `alpha = 0.12` when entered).
3. **Art Pipeline**: **Full Blender 3D Pipeline + Custom Surface/Pixel Detail** (`tools/sprite-studio/`, modeling multi-part architectural geometry — beveled ashlar stones, timber beams, shingled pitched roofs, glowing paned windows, arched doorways, hanging signs, bars, kegs, bellows/forges, fountains, wrought-iron streetlamps, wells, furniture — plus procedural/image texture detail + `pixelPost.mjs` depth creases & sel-out -> `.webp` in `packages/client/public/assets/city/` + `sprite-manifest.json`), PLUS **real animated 3D layered humanoid NPCs** rendered with `PlayerSprite` (`player-rig.json`).
4. **Dialogue & Voice UX**: **Full Cinematic Dialogue Mode** — smooth camera zoom (`~1.45×`) & ease-center between player and NPC, subtle top/bottom letterbox bars, speaker turns to face player, animated live portrait with talking mouth/expression bounce, character-by-character typewriter text, **Animal-Crossing-style WebAudio voice blips** (`voiceSynth.ts`) tuned per NPC, punctuation pauses, skip-to-end on click/`Space`, branching dialogue choices + seamless handoff to Shop/Forge/Tavern/Crafting/Bounty/Stash/Minigame/Housing UIs, PLUS ambient overheard street speech bubbles.
5. **Interactive City Content Scope**: All **5 content pillars** included:
   - `5` Multi-Step City Questlines & Mysteries
   - `>= 20` Living Animated NPCs with daytime/dusk/night schedules & overheard street chatter
   - Playable Saloon Tavern Dice + Garrison Archery & Sparring Arena minigames
   - NPC Affinity (`0..100`, gifting + discounts + secrets) & `12` hidden Havenhold Lore Tomes/Curios
   - Buyable & Furnishable Player City Cottage (`interior:player-cottage`)
6. **Theme & Atmosphere**: **Warm Medieval-Frontier Bastion ("Havenhold")** — high-contrast dressed limestone walls, half-timbered plaster houses, terracotta & slate shingled roofs, brass streetlamps, cozy wood-and-amber *Rusty Flagon* Saloon, vibrant striped market awnings, lush herb gardens, matching the sunlit Cainos-style overworld palette.

---

## 3. Spatial Master Map of Havenhold (`256 × 256` Tiles)

### 3.1 Perimeter Walls, Bastion Towers & Cardinal Gates
- **Half-Extent Constant**: `SANCTUARY_CITY_HALF_SIZE = 128` (`x ∈ [-128, 128]`, `y ∈ [-128, 128]`, `isInSanctuary(x, y)` returns `Math.abs(x) <= 128 && Math.abs(y) <= 128`).
- **Perimeter Ring**:
  - `CityWall` occupies the two outer rings along all 4 edges: `|wx| ∈ {127, 128}` (for `|wy| <= 128`) and `|wy| ∈ {127, 128}` (for `|wx| <= 128`), EXCEPT at the 4 Cardinal Gate apertures!
  - **Cardinal Gate Apertures** (`CITY_GATE_HALF_WIDTH = 3`, opening `6` tiles wide so mounts/crowds pass smoothly):
    - **North Gate** (*Highland Road Gate*): `wy ∈ {-127, -128}`, `wx ∈ [-3, 2]` — road pavers `CityCobble`, twin `CityGateTower`s at `(-4.5, -127.5)` & `(3.5, -127.5)`, twin `NpcGuard`s at `(-2.5, -124.5)` & `(2.5, -124.5)`.
    - **South Gate** (*Southern Timber Gate*): `wy ∈ {127, 128}`, `wx ∈ [-3, 2]` — twin `CityGateTower`s at `(-4.5, 127.5)` & `(3.5, 127.5)`, twin `NpcGuard`s at `(-2.5, 124.5)` & `(2.5, 124.5)`.
    - **East Gate** (*Frontier Trail Gate*): `wx ∈ {127, 128}`, `wy ∈ [-3, 2]` — twin `CityGateTower`s at `(127.5, -4.5)` & `(127.5, 3.5)`, twin `NpcGuard`s at `(124.5, -2.5)` & `(124.5, 2.5)`.
    - **West Gate** (*Sunken Causeway Gate*): `wx ∈ {-127, -128}`, `wy ∈ [-3, 2]` — twin `CityGateTower`s at `(-127.5, -4.5)` & `(-127.5, 3.5)`, twin `NpcGuard`s at `(-124.5, -2.5)` & `(-124.5, 2.5)`.
  - **`CityWallTower` Bastions**: Placed at all `4` city corners (`±127.5, ±127.5`) and every `16` tiles along each wall segment (`±16, ±32, ±48, ±64, ±80, ±96, ±112`), topped with warm perimeter torches (`PointLightSpec` capped cleanly per chunk).
  - **Gate Exit Apron (`128 < max(|wx|, |wy|) <= 136`)**: Force dry flat `GroundKind.DirtPath` outside each gate (`<= 140` along cardinal axes) and suppress rivers/cliffs in the `129..136` moat apron in `biomeSampler.ts` so players never walk out a gate directly into `DeepWater` or an uncrossable cliff!

### 3.2 Cobblestone Street Grid & Legacy Invariant Preservation
- **Road Grid**:
  - **Grand Cardinal Boulevards** (`6` tiles wide): `|wx| <= 2` (`x ∈ [-3, 2]`) and `|wy| <= 2` (`y ∈ [-3, 2]`), paved in `GroundKind.CityCobble` with bordered `CityPlazaStone` curbs at `±3`.
  - **District Avenues** (`4` tiles wide): Placed every `32` tiles (`c ∈ {-96, -64, -32, 32, 64, 96}` where `local ∈ [-2, 1]`) paved in `GroundKind.CityCobble`, dividing Havenhold into **`64` city blocks** (`30×30` buildable yards inside intersections).
  - **Ring Alley**: Inner perimeter patrol lane (`123 <= max(|wx|, |wy|) <= 126`) paved in `GroundKind.CityCobble` so guards and players can patrol inside the entire wall circuit!
- **Central Fountain Plaza (`wx ∈ [-16, 16], wy ∈ [-16, 16]`)**:
  - Paved in geometric `GroundKind.CityPlazaStone` (dry, `elevation: 0` except the preserved NW Dais below).
  - **Strict Legacy Test Preservations**:
    1. **`(0.5, 0.5)` Spawn Point**: Must remain `elevation: 0`, dry walkable `CityPlazaStone`, with **zero blocking props within `r < 2.0` tiles** of `(0, 0)` (required by `chunkGenerator.test.ts` and `worldgenReachability.property.test.ts`).
    2. **Sanctuary Hearth Campfire**: Keep a lit `PropKind.Campfire` near `(2.5, -1.5)` (or central plaza brazier-hearth within chunk `(0,0)`) so `chunkGenerator.test.ts` passes (`originChunk.props.find(Campfire)` & `lights.some("campfire")`). Note: Update `chunkGenerator.test.ts:19` if `originChunk.ground[worldTileIndex(0,0)]` changes from `DirtPath` to `CityPlazaStone`.
    3. **Elevated Plaza Dais (`wx ∈ [-13, -7], wy ∈ [-13, -7]`)**: Preserve `elevation: 1` (`CityPlazaStone` instead of `MossStone`) with climbable `stairs: true` at `wx ∈ [-10, -9], wy === -7` (`nwChunk` in `collision.test.ts:59-100` and `chunkGenerator.test.ts:30-34`!).
    4. **East Garrison Sparring Yard (`wx ∈ [6, 14], wy ∈ [-2, 5]`)**: Clear flat `CityPlazaStone` path from `(0.5, 0.5)` straight East so `combatSim.test.ts` (`dummy-straw`, `dummy-slime`, `dummy-spar`) works identically.
    5. **Central Botanical Herb Garden (`wx ∈ [-14, -4], wy ∈ [5, 13]`)**: `GroundKind.CityGardenGrass` bordered courtyard containing `4` `PropKind.Wildflower` and `3` `PropKind.Bush` forageables reachable unobstructed in `< 12` tiles from spawn (required by `e2e/phase-8.spec.ts` `[REQ-P8-06]`), plus `PropKind.CityFountain` at `(0.5, -6.5)` and `PlanterBox` / `CityBench` seating!

### 3.3 The 8 Named Districts & Hero Shop Entrance Coordinates
Export `CITY_DISTRICTS` and `CITY_HERO_DOORS` from `packages/engine/src/world/city/cityLayout.ts`:

| District ID | Display Name | Tile Bounds (`[x0..x1, y0..y1]`) | Signature Buildings, POIs & Flavor |
| :--- | :--- | :--- | :--- |
| `grand-plaza` | **Havenhold Grand Plaza** | `[-32..32, -32..32]` center core | Fountain Circle, Sanctuary Hearth, Elevated Proclamation Dais, Garrison Sparring Targets, Herb Garden |
| `tavern-row` | **Saloon & Entertainment Row** | `[4..62, -62..-4]` (NE Core) | **The Rusty Flagon** Saloon (`FacadeSaloon` door `(18.5, -14.5)` -> `interior:tavern`), stage performers, outdoor ale tables |
| `forge-quarter` | **Anvil & Artisan Quarter** | `[-62..-4, -62..-4]` (NW Core) | **The Iron Anvil** Blacksmith (`FacadeBlacksmith` door `(-18.5, -14.5)` -> `interior:blacksmith`), **The Artisan's Workshop** (`FacadeArtisan` door `(-46.5, -14.5)` -> `interior:artisan`), open-air smelting yards |
| `market-square` | **Grand Market Square** | `[4..62, 4..62]` (SE Core) | **The Gilded Scale** Emporium (`FacadeMerchant` door `(18.5, 16.5)` -> `interior:merchant`), `12+` colorful striped `MarketStall`s, caravan wagons, supply crates |
| `guild-precinct` | **Guild & Vault Precinct** | `[-62..-4, 4..62]` (SW Core) | **Havenhold Guild Hall & Vault** (`FacadeGuild` door `(-18.5, 16.5)` -> `interior:guild`), outdoor `BountyBoard` Annex `(-10.5, 14.5)`, public notice pillars |
| `residential-west` | **Sunlit Cottages & Housing** | `[-124..-66, -94..94]` (West Outer) | **Buyable Player City Cottage** (`FacadeCottage` door `(-78.5, 16.5)` -> `interior:player-cottage` + `CottageForSaleSign`), plus `14` walkable roof-cutaway cottages, wells & flower boxes |
| `botanical-gardens` | **Botanical Commons & Gardens** | `[-62..62, -124..-66]` & `[66..124, 66..124]` | Terraced `CityGardenGrass` parks, central `CityFountain`, `TownWell`s, `Wildflower`/`Bush` herb plots, secluded reading alcoves (`LorePedestal`s) |
| `garrison-ward` | **East Garrison & Gate Ward** | `[66..124, -62..62]` & Gate Quarters | Training Yard (`ArcheryTarget` range at `(84, -18)`..`(92, -18)`), guard barracks cutaway halls, Twin Guard Gatehouses at all 4 Cardinal Gates |

> **Compatibility Check**: Keep ONE outdoor `BountyBoard` at `(-10.5, 14.5)` (`>= 4` tiles from Botanical Garden forageables) and ALSO place a `BountyBoard` + `StashChest` + `NpcGuide` inside `interior:guild`, AND keep a `Workbench` inside `interior:artisan` (so Pass 1 tests/helpers work both near plaza and inside the dedicated shop interiors!).

### 3.4 Exact 6 Enterable Pocket Interior Floorplans (`interiorLayouts.ts`)
Each interior lives in an isolated `ZoneInstance` (`WORLD_CHUNK` `(0, 0)` within `[0..W-1, 0..H-1]`), enclosed on all edges by solid `BuildingWall`, exited via `PropKind.InteriorDoor` at `(exitX, exitY)` returning player cleanly to `{ zoneId: "overworld", x: returnX, y: returnY }`:

1. **`interior:tavern` (*The Rusty Flagon*, `24 × 18`, `CityWoodPlank` floor)**:
   - Spawn-in: `(12.5, 15.0)`, Exit `InteriorDoor`: `(12.5, 16.2)` -> returns `(18.5, -13.2)`.
   - Bar Counter (`BarCounter` x `4`) across `x = 8..16, y = 5.5`; **Barkeep Barnaby** behind bar `(12.5, 4.0)`; stone fireplace `Campfire` + `ForgeHearth` warmth `(20.5, 4.5)`; `6` `TavernTable` clusters (`(5.5, 9.5)`, `(5.5, 13.5)`, `(18.5, 9.5)`, `(18.5, 13.5)`, `(11.5, 10.5)`); `AleBarrel` cellar row (`(3.0, 3.5..6.5)`); hidden `LorePedestal` cellar riddle (`(3.5, 15.5)`); Dice Table area (`(18.5, 9.5)`).
2. **`interior:blacksmith` (*The Iron Anvil*, `20 × 16`, `CityPlazaStone` floor)**:
   - Spawn-in: `(10.5, 13.0)`, Exit `InteriorDoor`: `(10.5, 14.2)` -> returns `(-18.5, -13.2)`.
   - Twin roaring `ForgeHearth` furnaces (`(6.5, 3.5)`, `(14.5, 3.5)`), central Anvil / **Master Smith Bramwell** `(10.5, 5.5)`, `WeaponRack`s along West/East walls, `CrateStack` ore piles, glowing lanterns.
3. **`interior:merchant` (*The Gilded Scale*, `22 × 16`, `CityWoodPlank` + `CottageRug` floor)**:
   - Spawn-in: `(11.5, 13.0)`, Exit `InteriorDoor`: `(11.5, 14.2)` -> returns `(18.5, 17.8)`.
   - Display `MarketStall` counters (`(5.5, 6.5)`, `(17.5, 6.5)`, `(11.5, 6.5)`), **Quartermaster Valeria** `(11.5, 4.5)`, `CottageBookshelf` ledger wall, `CrateStack` exotic goods, `StashChest` VIP courier lockbox.
4. **`interior:artisan` (*The Artisan's Workshop*, `20 × 16`, `CityWoodPlank` floor)**:
   - Spawn-in: `(10.5, 13.0)`, Exit `InteriorDoor`: `(10.5, 14.2)` -> returns `(-46.5, -13.2)`.
   - Central twin `Workbench`es `(8.5, 7.5)` & `(12.5, 7.5)`, `CraftRack` blueprint walls, **Master Artisan Clara** `(10.5, 5.0)`, timber/leather `CrateStack`s, cozy hearth.
5. **`interior:guild` (*Havenhold Guild Hall & Vault*, `24 × 18`, `CityPlazaStone` + `CottageRug` floor)**:
   - Spawn-in: `(12.5, 15.0)`, Exit `InteriorDoor`: `(12.5, 16.2)` -> returns `(-18.5, 17.8)`.
   - Grand Wing: **Guildmaster Thorne (Guide)** `(12.5, 4.5)`, `BountyBoard` `(6.5, 5.5)`, **Sanctuary Vault Wing** with `3` gleaming `StashChest`s `(18.5, 6.5)` + `LorePedestal` city archive + `CottageBookshelf`s.
6. **`interior:player-cottage` (*Your Havenhold Cottage*, `18 × 14`, `CityWoodPlank` floor)**:
   - Spawn-in: `(9.5, 11.2)`, Exit `InteriorDoor`: `(9.5, 12.2)` -> returns `(-78.5, 17.8)`.
   - Customizable grid bounds `x ∈ [2..15], y ∈ [2..10]`: starts cozy with a base hearth/table once deed is bought (`150g`), and renders all player-placed furniture (`HousingManager`) dynamically as interactive zone props (`Campfire`, `Bed` granting `Rested`, `StashChest` linked to player vault, `TrophyRack`, `CottageBookshelf`, `CottageRug`, `TavernTable`, `PlanterBox`, `CityLantern`)!

---

## 4. Terrain Atlas & Blender 5.3 3D Pixel-Art Asset Pipeline Spec

### 4.1 Four New City Terrain Tiles (Rows `17..20` in `terrainTextures.ts`)
Raise `TERRAIN_ATLAS_ROWS = 21` and add `GroundKind`s `17..20`:
- **`CityCobble` (`17`)**: Base `#737882`, mid `#606570`, dark `#3d424c`, highlight `#989fa9`, mortar `#2a2e38`. Paint staggered 2-row running-bond rounded cobblestones (`8×8` stones) with top-left warm catchlights, mortar crevices, and occasional warm mossy tint across variants `0..3`. Minimap RGB: `[115, 120, 130]`.
- **`CityPlazaStone` (`18`)**: Base `#cfc3aa`, mid `#bbae94`, dark `#8a7d68`, highlight `#ebe0c9`, accent `#d4af37` (subtle inlaid plaza trim on variant `0`). Paint beveled 16×16 dressed limestone plaza flagstones with clean chamfer highlights. Minimap RGB: `[207, 195, 170]`.
- **`CityWoodPlank` (`19`)**: Base `#8f5f39`, mid `#7a4f2d`, dark `#523219`, highlight `#b27d4e`. Paint 4 horizontal oak floorboards per 32px tile with staggered end-joints, dark seam lines, wood grain streaks, and tiny iron nail heads. Minimap RGB: `[143, 95, 57]`.
- **`CityGardenGrass` (`20`)**: Base `#4d9444`, mid `#408239`, dark `#2e632b`, highlight `#6fb556`, accent `#f472b6` (tiny manicured clover/blossoms). Minimap RGB: `[77, 148, 68]`.

### 4.2 Blender 5.3 3D Architectural Pipeline (`tools/sprite-studio/`)
- **Rule from Austin**: *Do NOT use crude primitives alone — model multi-part architectural geometry cleanly in Blender 5.3 with procedural/image texture detail baked onto materials (`bsdf` / stepped toon shader in `studio_core.py`), orthographic `64 px/tile` or `48 px/tile` renders + depth pass -> `pixelPost.mjs` (`binarizeAndClean`, `applyInternalDepthCreases`, `applySelOutOutline`) -> crisp `.webp` in `packages/client/public/assets/city/` registered in `sprite-manifest.json`.*
- **`tools/sprite-studio/blender/city/build_city_architecture.py`**:
  1. `city-wall` (`64×80 px`, `1×1` footprint overlap `scale: 0.35`): Courser dressed ashlar blocks (staggered 3D bricks), beveled stone capstones, notched crenellation merlons/embrasures, arrow slit + mossy base trim.
  2. `city-wall-tower` (`96×128 px`): Octagonal/cylindrical stone bastion with tiered stone bands, wooden cantilevered hoarding gallery, conical slate spire roof with individual dormer/shingle courses, fluttering Havenhold banner.
  3. `city-gate-tower` (`128×144 px`): Twin-buttress medieval gatehouse arch with stone voussoirs, raised iron portcullis spikes, wall-mounted flaming iron sconces, heraldic crest shield, conical guard turret roof.
  4. `building-wall` (`64×72 px`): Timber-and-plaster facade module (stone plinth base + whitewash cream stucco + dark oak stud beams + multi-pane leaded window glow).
  5. `cottage-roof` (`192×144 px`, scales cleanly over `4×3` cutaway cottages): Pitched wooden shingle roof with ridgebeam tiles, brick chimney stack, moss patches, dormer gable, overhanging eaves.
  6. **6 Hero Building Facades** (`224×208 px` to `256×224 px`, rich 3D multi-story facades stamped behind each enterable doorway):
     - `facade-saloon` (*The Rusty Flagon*): 2-story timber/stone inn, jutting upper bay windows with warm amber hearth light, hanging wooden mug-and-barrel tavern sign over scalloped porch awning, batwing swinging double doors, stone chimney with smoke cap.
     - `facade-blacksmith` (*The Iron Anvil*): Heavy stone forge hall, slanted slate roof, oversized brick furnace stack with glowing ember vent, overhanging open-front work porch with anvil/grinding wheel silhouettes & hanging crossed-hammer sign.
     - `facade-merchant` (*The Gilded Scale*): Colorful crimson-and-gold striped canvas awnings, bow display windows stocked with potion/sword silhouettes, second-story merchant balcony, hanging golden balance-scale sign.
     - `facade-artisan` (*The Artisan's Workshop*): Sawtooth Skylight timber guildhall, stacked lumber rack overhang, stone waterwheel/lathe side detail, carved compass-and-chisel hanging sign.
     - `facade-guild` (*Guild Hall & Vault*): Limestone civic hall with twin fluted columns, vaulted blue slate gable roof, reinforced iron-studded vault annex wing, emerald-gold Havenhold crest banner.
     - `facade-cottage` (*Havenhold Timber Cottage*): Inviting half-timber cottage with terracotta roof shingles, stone doorstep, window flower box, lantern hook, chimney.
- **`tools/sprite-studio/blender/city/build_city_props.py`** (`64×64 px` to `128×96 px`, multi-part detailed 3D meshes):
  - `bar-counter`: Carved mahogany counter with brass footrail, oak keg tap, glass tankards, spill cloth.
  - `tavern-table`: Heavy trestle table with wooden benches, plates, candle stub, foaming mugs.
  - `ale-barrel`: Bound oak cask on timber chocks with riveted iron hoops & brass spigot.
  - `forge-hearth`: Domed stone smelter with glowing orange coals, bellows leather/frame, tongs, quenching trough.
  - `weapon-rack`: Timber A-frame stocked with blades, spear shafts, and bucklers.
  - `market-stall`: Carved timber booth + scalloped red/amber fabric canopy + baskets of produce/wares.
  - `craft-rack`: Pegboard tool wall with saws, hammers, hide rolls, calipers.
  - `crate-stack`: Staggered nailed wooden crates, rope coils, ceramic amphora.
  - `city-fountain`: Two-tier octagonal carved limestone basin with bronze gargoyle spouts & crystal water pools.
  - `city-lantern`: Fluted wrought-iron lamp post with four-pane warm amber glass housing & finial.
  - `city-bench`: Cast-iron scroll armrests with curved oak slats.
  - `planter-box`: Stone/timber planter rim brimming with soil, sculpted shrubs & colorful blossoms.
  - `town-well`: Circular fieldstone curb, twin timber posts, pitched shingle pulley roof, rope & oak bucket.
  - `cottage-bookshelf`, `cottage-rug` (woven geometric tapestry), `trophy-rack`, `lore-pedestal` (carved lectern with glowing bound tome), `archery-target` (straw-bale tripod with concentric bullseye rings), `interior-door` (arched oak threshold with warm floor rug mat), `cottage-for-sale` (timber estate post with wax-sealed parchment deed sign).
- **Baker (`tools/sprite-studio/bake/bakeCityAssets.mjs` + `"city:bake"` npm script)**:
  - Runs Blender `build_city_architecture.py` & `build_city_props.py` (exporting base color + normalized depth PNG per asset).
  - Applies `pixelPost.mjs` (`binarizeAndClean`, `applyInternalDepthCreases`, `applySelOutOutline`) + sharp `.webp` lossless/near-lossless output into `packages/client/public/assets/city/<id>.webp`.
  - Updates `packages/client/public/assets/sprite-manifest.json` cleanly via `manifestSync.mjs` helpers so `tests/integration/contentIntegrity.test.ts` sees zero orphaned or missing files!

---

## 5. Living Animated 3D NPC Roster (`22` Named Citizens, Shopkeepers & Guards)

Rendered in world-space with the real 3D layered `PlayerSprite` (`player-rig.json`, directional 8-way clips `idle`/`walk`, unique `CharacterAppearance` + cosmetic armor/outfit accents) and inside Dialogue UI via animated `dialoguePortrait.ts`.

| ID | Name & Title | Role | Home Zone | Schedule (`day` -> `dusk/night`) | Voice Profile (`waveform / baseHz / cadenceMs`) | Favorite Gifts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `guide-thorne` | **Elder Thorne** *(Guildmaster)* | `guide` | `interior:guild` | Desk (`interior:guild`) -> Fireplace seat (`interior:guild`) | `triangle / 175 Hz / 58ms` *(Warm Sage)* | `herb-tea`, `amber-resin` |
| `smith-bramwell` | **Bramwell** *(Master Smith)* | `blacksmith` | `interior:blacksmith` | Forge Anvil -> Saloon corner (`interior:tavern`) at night | `sawtooth / 132 Hz / 64ms` *(Deep Gruff)* | `iron-ingot`, `sunstone` |
| `merchant-valeria` | **Valeria** *(Emporium Factor)* | `merchant` | `interior:merchant` | Counter -> Plaza stroll -> Emporium | `sine / 315 Hz / 44ms` *(Brisk Crisp)* | `amber-resin`, `phoenix-salve` |
| `barkeep-barnaby` | **Barnaby** *(Saloonkeeper)* | `barkeep` | `interior:tavern` | Behind Mahogany Bar (always on duty!) | `triangle / 158 Hz / 52ms` *(Jovial Baritone)* | `bog-spore`, `cooked-meat` |
| `artisan-clara` | **Clara** *(Master Artisan)* | `artisan` | `interior:artisan` | Workbench -> Botanical Garden | `sine / 345 Hz / 46ms` *(Bright Nimble)* | `wood`, `amber-resin` |
| `guard-n` | **Watchman Kael** *(North Gate)* | `guard` | `overworld` | North Gate `(0.5, -124.5)` patrol | `square / 145 Hz / 55ms` *(Crisp Military)* | `cooked-meat`, `bandage` |
| `guard-s` | **Watchwoman Mira** *(South Gate)* | `guard` | `overworld` | South Gate `(0.5, 124.5)` patrol | `triangle / 265 Hz / 50ms` *(Steady Alto)* | `herb-tea`, `healing-salve` |
| `guard-e` | **Captain Garrick** *(East Gate)* | `guard` | `overworld` | East Gate `(124.5, 0.5)` patrol -> Garrison | `sawtooth / 138 Hz / 58ms` *(Commanding)* | `iron-ingot`, `ironbark-tonic` |
| `guard-w` | **Sentinel Orin** *(West Gate)* | `guard` | `overworld` | West Gate `(-124.5, 0.5)` patrol | `square / 155 Hz / 56ms` *(Gruff Sentinel)* | `cooked-meat`, `torch` |
| `npc-captain-aldric` | **Commander Aldric** *(Garrison)* | `guard` | `overworld` | East Sparring Yard `(10, 3)` <-> Garrison Barracks | `sawtooth / 142 Hz / 54ms` | `sunstone`, `cooked-meat` |
| `npc-lyric` | **Lyric** *(Saloon Bard)* | `townsfolk` | `interior:tavern` | Fountain Plaza by day -> *The Rusty Flagon* stage at dusk/night | `sine / 365 Hz / 42ms` *(Melodic Chime)* | `wildflower` / `amber-resin` |
| `npc-finn` | **Old Finn** *(Retired Delver)* | `townsfolk` | `interior:tavern` | Saloon Table -> Herb Garden bench | `triangle / 162 Hz / 68ms` *(Raspy Old)* | `berry`, `swiftness-draught` |
| `npc-elara` | **Elara** *(Botanical Herbalist)* | `townsfolk` | `overworld` | Botanical Herb Garden `(-8, 8)` <-> Market Stalls | `sine / 335 Hz / 48ms` | `herb`, `bog-spore` |
| `npc-marcus` | **Marcus** *(Mason Overseer)* | `townsfolk` | `overworld` | NW Quarter Wall patrol <-> Fountain Plaza | `triangle / 168 Hz / 54ms` | `stone`, `copper-ingot` |
| `npc-pip` | **Pip** *(Errand Runner)* | `townsfolk` | `overworld` | Plaza <-> Market Square <-> Guild Hall (fast walk!) | `sine / 410 Hz / 36ms` *(Sprightly)* | `berry`, `arrow` |
| `npc-sera` | **Sera** *(Market Baker)* | `townsfolk` | `overworld` | Market Square `(28, 22)` <-> Saloon evening | `triangle / 295 Hz / 46ms` | `raw-meat`, `berry` |
| `npc-vesper` | **Vesper** *(Cloakroom Scholar)* | `townsfolk` | `interior:guild` | Guild Bookshelves -> Fountain at night | `sine / 285 Hz / 52ms` | `shadow-shard`, `herb-tea` |
| `npc-rowan` | **Rowan** *(Archery Trainer)* | `townsfolk` | `overworld` | East Garrison Range `(82, -16)` | `triangle / 220 Hz / 49ms` | `arrow`, `flint` |
| `npc-greta` | **Greta** *(Estate Broker)* | `townsfolk` | `overworld` | West Cottage Row `(-76, 18)` (sells Cottage Deed!) | `sine / 305 Hz / 48ms` | `sunstone`, `amber-resin` |
| `npc-tomas` | **Tomas** *(Caravan Teamster)* | `townsfolk` | `overworld` | East Gate Wagon Yard <-> *The Rusty Flagon* | `sawtooth / 150 Hz / 60ms` | `cooked-meat`, `wood` |
| `npc-helena` | **Helena** *(Lantern Lighter)* | `townsfolk` | `overworld` | Walks City Boulevards checking streetlamps | `triangle / 278 Hz / 47ms` | `torch`, `amber-resin` |
| `npc-doran` | **Corporal Doran** *(Gate Watch)* | `guard` | `overworld` | South/West Ward patrol -> Saloon at midnight | `square / 165 Hz / 54ms` | `bandage`, `cooked-meat` |

---

## 6. Full Cinematic Dialogue Mode & Animalese Voice Synth Engineering Spec

### 6.1 Camera Zoom & Framing (`sceneCamera.ts`, `worldScene.ts`)
- Expose `scene.setDialogueFocus(target: { x: number; y: number; elevation: number } | null)`:
  - Target camera world point = midpoint `((player.x + target.x) * 0.5, (player.y + target.y) * 0.5 - 0.35)`.
  - Temporarily override effective zoom toward `Math.min(6.0, baseZoom * 1.45)` smoothly via exponential ease (`1 - Math.exp(-8 * dt)`).
  - When dialogue closes (`target = null`), ease smoothly back to the player's configured `zoom`.
  - When dialogue begins, client sends/sets facing vector so local speaker portrait & NPC `CityNpcSnapshot` look toward one another.

### 6.2 Animalese Procedural WebAudio Voice Engine (`packages/client/src/audio/voiceSynth.ts`)
- **Zero external MP3s**: Pure synthesized formant syllables using WebAudio (`AudioContext`, `OscillatorNode`, `BiquadFilterNode` bandpass formant, `GainNode` ADSR envelope `6ms` attack / `28ms` decay -> immediate auto-stop & `disconnect()` in `onended` to guarantee `0` leaked `AudioNode`s).
- **Per-Character Pitch & Expressiveness**:
  - Ignores whitespace & punctuation visually, triggers punctuation pauses (`"," -> +95ms`, `"." / "!" -> +180ms`, `"?" -> +180ms`).
  - Trailing `?` applies a subtle upward pitch sweep (`+18%` over `35ms`); `!` boosts amplitude slightly (`1.2×`).
  - Letter-indexed vowel/consonant pitch perturbation (`±9%` around `profile.baseHz`) gives genuine Animal-Crossing-esque expressive speech cadence!
  - Respects master SFX volume & global mute from `AudioEngine`.
  - Include `voiceSynth.test.ts` (`[REQ-P9-27]`) verifying deterministic schedule planning (`planSpeechCadence(text, profile)` pure helper tested in Vitest + audio node cleanup verification).

### 6.3 Cinematic Dialogue UI (`packages/client/src/ui/dialogue/`)
- `dialogueStyles.ts` + `dialogueModal.ts` + `dialoguePortrait.ts`:
  - **Letterbox Bars**: Subtle top & bottom matte gradient strips (`height: clamp(28px, 6vh, 48px)`) animating in during dialogue.
  - **Dialog Box (`class="ow-dialogue-box"`)**: Anchored bottom-center (`width: min(760px, calc(100vw - 24px))`), leather/parchment medieval border:
    - Left column: **Animated Live 3D Portrait Canvas (`88×88` / `72×72` mobile)** rendered from the NPC's `CharacterAppearance`, gently bobbing/blinking and cycling mouth pose synced to typewriter speech active state!
    - Right column: NPC Name + Role Badge + **Affinity Heart/Trust Meter (`0..100`, e.g. `Trusted · 62/100`)**, typewriter body text box (`2–4` lines, click or `Space`/`Enter` skips remaining characters instantly), and **Choice Buttons** (`1..4` keyboard shortcuts + full-width touch buttons on `390×844` mobile) + contextual **`Give Gift`** action!
  - **Handoff Actions**: Picking a shop/service choice (`openMerchant`, `openBlacksmith`, `openTavern`, `openArtisanCraft`, `openStash`, `openBounties`, `openGuide`, `startDiceGame`, `startArcheryChallenge`, `startSparringDuel`, `openHousing`) closes dialogue smoothly and opens that panel cleanly via `ModalRouter`!

---

## 7. Deep Content Specs: Mysteries, Affinity, Collectibles, Minigames & Cottage

### 7.1 The 5 Multi-Step Havenhold City Mysteries (`cityMysteries.ts`)
1. **`mystery-smugglers-cellar` (*Shadows Beneath the Flagon*)** — Starts at **Barnaby** (`interior:tavern`):
   - Stage 1: Barnaby suspects someone is watering his ale barrels and slipping through the cellar -> Inspect hidden `LorePedestal` cellar ledger in Saloon (`interior:tavern`).
   - Stage 2: Confront **Tomas** (`Caravan Teamster`) in Market Square about the stamped barrel manifest.
   - Stage 3: Check **Valeria**'s (`interior:merchant`) customs log and confront the East Gate fence -> Claim `120` Gold + `"Shadow-Veil Vial"` + `+20` Barnaby & Valeria Affinity.
2. **`mystery-stolen-ingot` (*The Missing Sun-Alloy*)** — Starts at **Bramwell** (`interior:blacksmith`):
   - Stage 1: Bramwell lost a glowing `sunstone` alloy bar -> Ask **Clara** (`interior:artisan`) who saw sparks near the Market alleys.
   - Stage 2: Question **Pip** (`Errand Runner`) on the Plaza -> he tells you he chased a hooded scavenger toward the Botanical Commons.
   - Stage 3: Inspect the hidden cache pedestal in the Northern Botanical Garden and return the alloy -> Claim `150` Gold + `"Copper Sword"` (or `rare` prefixed weapon) + `+25` Bramwell Affinity (`10%` permanent Forge discount tier!).
3. **`mystery-missing-watchman` (*Silent Bell at West Gate*)** — Starts at **Sentinel Orin** (West Gate):
   - Stage 1: Relief watchman **Corporal Doran** never showed for the evening shift -> Interview **Commander Aldric** at Garrison Barracks.
   - Stage 2: Track Doran's cloak badge to the Old Well inside the West Residential Ward (`TownWell`).
   - Stage 3: Confront Doran in *The Rusty Flagon* (`interior:tavern`) where he's nursing a Sprained Ankle + Gambling Debt -> Settle his tavern tab or warn Aldric -> Claim `100` Gold + `"Ironbark Tonic"` + `+20` Guard Affinity.
4. **`mystery-fountain-vault` (*The Song of Old Havenhold*)** — Starts at **Lyric** (Plaza / Saloon Bard):
   - Stage 1: Lyric sings of `3` stone seal plaques hidden in the Plaza, Guild Hall, and East Garden honoring Havenhold's founders.
   - Stage 2: Inspect the `3` plaque pedestals across Havenhold (`LorePedestal` clues).
   - Stage 3: Report the complete founder's verse to **Elder Thorne** (`interior:guild`) -> Unlock ancient vault cache (`180` Gold + `"Phoenix Salve"` + `+20` Thorne Affinity).
5. **`mystery-cottage-deed` (*Keys to Hearthstone Row*)** — Starts at **Greta** (Estate Broker, West Cottage Row):
   - Stage 1: Greta will waive part of the city property tax if you survey West Cottage Row (`inspect` well + neighbor **Elara**).
   - Stage 2: Clear a stubborn crate shipment dispute with **Clara** (`interior:artisan`) for cottage repairs.
   - Stage 3: Return to Greta -> Discount/bonus starter `"Oak Table"` + `90` Gold rebate toward your Player City Cottage!

### 7.2 NPC Affinity & Gifting (`0..100`)
- **4 Trust Tiers**: `0–24` (*Stranger*), `25–49` (*Acquaintance*, `+1` rumor/tip), `50–79` (*Trusted*, **`10%` Gold discount** at Merchant/Blacksmith/Saloon + secret dialogue), `80–100` (*Honored*, **`20%` Gold discount** + bonus master gift/curio).
- **Gifting (`giftNpc`)**: Selecting an eligible item from inventory inside Dialogue gifts `1` item (`+6` affinity default, `+16` if item matches NPC's `favoriteGifts`).

### 7.3 The 12 Hidden Havenhold Lore Tomes & Alleyway Curios (`citySecrets.ts`)
Placed across Plaza alleys, North Gardens, East Barracks, West Cottage Row gardens, and all Hero Interiors (`LorePedestal` props):
1. *Charter of Havenhold Walls* (Grand Plaza Dais `(-10.5, -10.5)`) — `15g`
2. *Barnaby's Watered-Ale Ledger* (`interior:tavern` cellar alcove) — `25g`
3. *Bramwell's Tempering Treatise* (`interior:blacksmith` back rack) — `20g`
4. *Gilded Tariff Ledger* (`interior:merchant` corner desk) — `20g`
5. *Clara's Clockwork Sketch* (`interior:artisan` table) — `20g`
6. *First Dungeon Delver's Manifesto* (`interior:guild` archive) — `30g`
7. *Mason's Mark on North Tower* (North Wall inner alley `(18.5, -121.5)`) — `25g`
8. *Gardener's Midnight Seed Note* (Botanical Herb Garden `(-9.5, 9.5)`) — `15g`
9. *Watchman's West Gate Chalk Tally* (West Gate inside guardhouse `(-118.5, -8.5)`) — `25g`
10. *Forgotten Well Verse* (West Cottage Well `(-82.5, -42.5)`) — `25g`
11. *Garrison Archery Record Board* (East Garrison Range `(88.5, -18.5)`) — `25g`
12. *Hidden Rooftop Coin Cache* (South-East Alley Courtyard `(92.5, 88.5)`) — `35g`

### 7.4 Saloon Menu, Tavern Dice & Garrison Arena Minigames (`minigames.ts`)
- **The Rusty Flagon Bar (`tavernBuy` / `tavernRest`)**:
  - Drinks & Meals: `berry` (*Spiced Berry Cider*, `4g`), `cooked-meat` (*Seared Tavern Roast*, `12g`), `herb-tea` (*Minty Flagon Brew*, `15g`), `healing-salve` (*Barkeep's Tonic*, `22g`), `swiftness-draught` (*Ginger Quicksilver*, `30g`).
  - **Hearth Rest (`tavernRest`)**: Costs `5` Gold -> restores `HP = maxHp`, `Stamina = maxStamina`, sets `restedTimer = SURVIVAL_BUFF_TUNING.restedDurationSec`.
- **Saloon Tavern Dice (`tavernDiceModal.ts`)**:
  - Choose wager (`10`, `25`, or `50` Gold; atomic check `player.gold >= wager`).
  - Player & House each roll `3` six-sided dice (`3d6`); player may hold up to 3 dice and perform `1` **Reroll** (or **Double Down** if `gold >= wager * 2`). Highest total wins pot (`2×` wager); Ties refund wager; Rolling triples pays `3×` jackpot!
- **Garrison Arena Challenges (`arenaChallengeHud.ts`)**:
  - **Archery Target Challenge**: Talk to **Rowan** (`(82, -16)`) -> pay `10` Gold entry -> `30s` live timer to shoot `ArcheryTarget` props along `(84..94, -18)` with a bow; score `>= 3` hits to win `25` Gold (`5+` hits = `45` Gold + bonus arrows!).
  - **Garrison Sparring Bout**: Talk to **Commander Aldric** (`(10, 3)`) -> wager `15` Gold -> spawns an authoritative sparring dummy/duelist in East Yard; defeating it within `30s` pays `35` Gold!

### 7.5 Buyable & Furnishable Player City Cottage (`housingCatalog.ts`, `housingManager.ts`)
- Talk to **Greta** (or inspect `CottageForSaleSign` at `(-78.5, 16.5)`) -> `buyCottage` (`150` Gold deed, atomic deduction, persists `ownsCottage = true`).
- Once owned, walking through `(-78.5, 16.5)` enters private **`interior:player-cottage`** (`ZoneManager` serves per-account furniture overlay from `HousingManager`).
- `COTTAGE_FURNITURE_CATALOG` (`placeCottageDecor` / `removeCottageDecor` with full Gold refund!):
  - `furn-hearth` (`Campfire`, `20g`), `furn-bed` (`Bed`, `25g`, grants `Rested`), `furn-stash` (`StashChest`, `40g`, links personal 27-slot Stash), `furn-table` (`TavernTable`, `15g`), `furn-bookshelf` (`CottageBookshelf`, `30g`), `furn-rug` (`CottageRug`, `15g`), `furn-trophy` (`TrophyRack`, `35g`), `furn-lantern` (`CityLantern`, `12g`), `furn-planter` (`PlanterBox`, `10g`), `furn-barrel` (`AleBarrel`, `18g`).

---

## 8. File Map, Legacy Test Coordinates & Exact Continuation Plan

### 8.1 Planned Module Inventory (Respecting `<= 12` prod `.ts` files/folder & `<= 250` lines/file)
- **Blender Studio (`tools/sprite-studio/`)**: `blender/city/build_city_architecture.py`, `blender/city/build_city_props.py`, `bake/bakeCityAssets.mjs` -> writes `.webp`s under `packages/client/public/assets/city/` + updates `sprite-manifest.json`.
- **Contracts (`packages/contracts/src/`)**: `world.ts` (`4` GroundKinds, `31` City PropKinds, `ZoneKind`, `InteriorId`, extended `NpcKind`), `index.ts`.
- **Content (`packages/content/src/`)**: `props/propSpecsCity.ts`, `props/propSpecs.ts`, `city/{npcRoster.ts,dialogueTrees.ts,cityMysteries.ts,citySecrets.ts,housingCatalog.ts,tavernCatalog.ts,cityCatalog.test.ts,README.md}`, `index.ts`.
- **Engine (`packages/engine/src/`)**: `world/city/{cityLayout.ts,cityBuildings.ts,cityWallsAndGates.ts,cityGenerator.ts,interiorLayouts.ts,cityLayout.test.ts,interiorLayouts.test.ts,README.md}`, `city/{minigames.ts,minigames.test.ts,README.md}`, `net/{citySchemas.ts,protocol.ts}`, updates in `world/{biomeSampler.ts,chunkGenerator.ts,poiStamper.ts}`, `combat/combatRules.ts`, `index.ts`.
- **Game Server (`packages/game-server/src/`)**: `sim/city/{cityNpcSim.ts,interiorZoneBridge.ts,mysteryTracker.ts,minigameSim.ts,housingManager.ts,cityCoordinator.ts,citySim.test.ts,README.md}`, updates in `sim/{worldSim.ts,hubs/npcManager.ts,hubs/hubCoordinator.ts,survival/persistenceStore.ts,survival/worldPersistenceSync.ts,combat/adminActions.ts}` & `net/{wsSession.ts,hubSessionSync.ts,snapshotFilter.ts}`.
- **Client (`packages/client/src/`)**:
  - Textures/Sprites: `render/textures/{terrainTextures.ts,terrainTileDetails.ts,propTextures.ts}`, `render/textures/city/{citySpriteRegistry.ts,cityManifest.test.ts,README.md}`, `render/world/chunkProps.ts` (roof cutaway alpha), `render/world/npcs/{cityNpcRenderer.ts,hubNpcOverlay.ts}`, `render/world/{sceneCamera.ts,worldScene.ts}`, `ui/map/{minimapTileCache.ts,minimapOverlay.ts,mapPinRenderer.ts}`.
  - Audio & UI: `audio/{voiceSynth.ts,voiceSynth.test.ts,audioEngine.ts}`, `ui/dialogue/{dialogueModal.ts,dialoguePortrait.ts,dialogueStyles.ts,README.md}`, `ui/minigames/{tavernDiceModal.ts,arenaChallengeHud.ts,README.md}`, `ui/hubs/{tavernModal.ts,housingModal.ts,cityCodexModal.ts,hubModalController.ts}`, `ui/discovery/poiPromptHelper.ts`.
  - Net & Offline Parity: `net/{hubClientBridge.ts,worldClient.ts,worldClientHelpers.ts,offlinePersistence.ts}`, `net/socket/{worldClientView.ts,worldClientOps.ts}`, `net/offline/{offlineCity.ts,offlineHubs.ts,offlineWorldController.ts,offlineWorldSim.ts}`.

### 8.2 Existing Tests Requiring Wilderness Coordinate Updates (`|x| <= 128 -> x >= 136`)
When Sanctuary expands from `r = 14` to `|x|, |y| <= 128`, any existing test that spawns wildlife/structures outside Sanctuary at `x = 15..45` will now sit inside Havenhold walls. Update wilderness test coords to `>= 136` (just outside the East Gate) across these exact files:
1. `packages/engine/src/combat/combatRules.test.ts` (assert `(0.5, 0.5)` and `(120, 0)` true, `(135, 0)` false).
2. `packages/engine/src/world/chunkGenerator.test.ts` (`ground` at `(0,0)` -> `GroundKind.CityPlazaStone`; keep campfire & stairs checks).
3. `packages/engine/src/world/pois/safeRoomLayout.test.ts` (cover `OUTER_SAFE_ROOM_PROPS` + Havenhold `CITY_HERO_DOORS`).
4. `packages/engine/src/survival/survivalRules.test.ts` (lines ~104-106: shift outside-Sanctuary placement coords past `x = 136`).
5. `packages/game-server/src/sim/hubs/hubSim.test.ts` (wolf spawn at `x = 22` -> `x = 140`, player at `x = 134`).
6. `packages/game-server/src/sim/wildlife/worldEcology.test.ts`, `stealthEcology.test.ts`, `combat/stealthPolish.test.ts`, `combat/weaponFeatures.test.ts`, `wildlifeWindup.test.ts`, `wildlife/tracking/searchTracking.test.ts`, `survival/survivalSim.test.ts`, `survival/survivalPhase8.test.ts` (shift non-sanctuary `x, y` to `[140+, 0]` where `worldChunkCache` samples wild ground!).
7. `e2e/helpers/phase8Helpers.ts` (`findClearHalfPlaneSpots` scan `dist = 136..170`; `findNearestSeedProp` scan chunks around `origin` for tree/gather test) + verify `e2e/baseline-smoke.spec.ts` & `e2e/phase-8.spec.ts` stay 100% green!

### 8.3 Ordered Execution Checklist for the Desktop Agent
1. **Verify Baseline**: Run `npm run typecheck; if ($?) { npm test }` to confirm clean `d69cf481` green baseline before editing.
2. **Execute Milestone 9B**: Build & test Blender 5.3 pipeline (`tools/sprite-studio/` + `npm run city:bake`) -> inspect `.webp` dimensions & sprite manifest -> implement `@dc2d/contracts`, `@dc2d/content` (`city/` + `propSpecsCity.ts`), and `@dc2d/engine` (`world/city/` + `city/minigames.ts` + `citySchemas.ts` + worldgen integration) -> run `npm run lint:working-tree` & `npm run ai:loop`.
3. **Execute Milestone 9C**: Implement `@dc2d/game-server/src/sim/city/*`, `ZoneManager` interior transfers, `npcManager` discounts, persistence, and update the 13 coordinate-sensitive tests -> pass `npm test` + `npm run ai:loop`.
4. **Execute Milestone 9D**: Expand Terrain Atlas (`21` rows), mount Blender city assets + roof cutaways + Pocket Interior renderer + animated 3D NPCs, implement `voiceSynth.ts`, `sceneCamera.ts` dialogue zoom, Cinematic Dialogue UI, Tavern/Minigames/Housing/Codex UIs, and full `offlineCity.ts` offline parity -> pass `npm run verify:content`, `npm run lint`, and `npm run lint:deadcode`.
5. **Execute Milestone 9E (Full Sign-off)**: Update `e2e/helpers/phase8Helpers.ts`, `e2e/helpers/phase9Helpers.ts`, and `e2e/phase-9.spec.ts` covering `REQ-P9-02..36` with visual QA screenshots -> pass **`npm run verify:phase -- phase-9` (`9/9`, all `36` REQs verified)** -> graduate [Phase 9 Spec](phases/phase-9-fog-of-war-and-safe-room-hubs.md) & [ROADMAP.md](ROADMAP.md) to `✅ Complete` -> audit diff & run final `npm run verify:docs; if ($?) { npm run verify:spec -- all-completed; if ($?) { npm run lint; if ($?) { npm test } } }` -> commit on `feat/phase-9-fog-hubs-economy`.
6. **Continue Into Phase 10**: Only AFTER Phase 9 Pass 2 (`36/36` REQs) is committed cleanly, cut `feat/phase-10-progression-bosses-dcc` and execute [Phase 10 Spec](phases/phase-10-progression-floor-bosses-and-dcc-countdown.md).

### 8.4 Ready-to-Paste Desktop Resume Prompt
```text
Resume DungeonCrawler2D on branch feat/phase-9-fog-hubs-economy from docs/HAVENHOLD-SANCTUARY-CITY-HANDOFF.md and docs/phases/phase-9-fog-of-war-and-safe-room-hubs.md. Execute Phase 9 Pass 2 (Havenhold Fortified Sanctuary City, Milestones 9B -> 9C -> 9D -> 9E) autonomously end-to-end — starting with the Blender 5.3 3D city architectural & prop pipeline (npm run city:bake) — until npm run verify:phase -- phase-9 passes all 9/9 checks and all 36 requirements (REQ-P9-01..REQ-P9-36). Graduate Phase 9 docs, commit on feat/phase-9-fog-hubs-economy, present visual QA highlights, and then proceed to Phase 10.
```
