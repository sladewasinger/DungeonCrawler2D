# Phase 9 — Fog-of-War Map, Havenhold Sanctuary City, NPC Economy & Bounties

> **Status**: 🚧 In Progress (Pass 1 Verified at `d69cf481`; Pass 2 — Havenhold Fortified Sanctuary City Spec Locked)
> **Dependencies**: Phase 8 Pass 2 ✅, Frontier Overhaul (`Phase 8A`) ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Pass 2 Exhaustive Implementation & Desktop Continuation Spec**: [Havenhold Sanctuary City Blueprint & Desktop Handoff](../HAVENHOLD-SANCTUARY-CITY-HANDOFF.md)
> **Shipped Pass 1 Modules**:
> `@dc2d/content` (`src/hubs/bounties.ts`, `src/hubs/quests.ts`, `src/hubs/merchantCatalog.ts`, `src/items/pricing.ts`),
> `@dc2d/engine` (`src/world/fog/fogOfWar.ts`, `src/world/pois/safeRoomLayout.ts`, `src/inventory/stashOps.ts`, `src/inventory/upgradeOps.ts`, `src/inventory/armorOps.ts`, `src/net/hubSchemas.ts`, `src/net/inventorySchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/hubs/hubCoordinator.ts`, `src/sim/hubs/npcManager.ts`, `src/sim/hubs/bountyTracker.ts`, `src/sim/hubs/stashManager.ts`, `src/net/hubSessionSync.ts`, `src/sim/survival/persistenceStore.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/ui/map/minimapOverlay.ts`, `src/ui/map/fogOverlay.ts`, `src/ui/hubs/`, `src/render/world/npcs/hubNpcOverlay.ts`, `src/render/textures/pois/safeRoomTextures.ts`, `src/net/hubClientBridge.ts`, `src/net/offline/offlineHubs.ts`, `src/net/offlinePersistence.ts`)
> **Planned Pass 2 Touchpoints**:
> `tools/sprite-studio/` (`blender/city/build_city_architecture.py`, `blender/city/build_city_props.py`, `bake/bakeCityAssets.mjs`),
> `@dc2d/content` (`src/props/propSpecsCity.ts`, `src/city/`),
> `@dc2d/engine` (`src/world/city/`, `src/city/minigames.ts`, `src/net/citySchemas.ts`),
> `@dc2d/game-server` (`src/sim/city/`, `src/sim/zones/`),
> `@dc2d/client` (`src/render/textures/city/`, `src/render/world/npcs/cityNpcRenderer.ts`, `src/audio/voiceSynth.ts`, `src/ui/dialogue/`, `src/ui/minigames/`, `src/ui/hubs/tavernModal.ts`, `src/ui/hubs/housingModal.ts`, `src/ui/hubs/cityCodexModal.ts`, `src/net/offline/offlineCity.ts`)
> **Folder-Size Guardrails**: Every source folder is capped at `<= 12` non-test `.ts` files (`<= 250` lines/file). Place Pass 2 modules strictly in dedicated subfolders (`content/src/city/`, `engine/src/world/city/`, `engine/src/city/`, `game-server/src/sim/city/`, `client/src/render/textures/city/`, `client/src/ui/dialogue/`, `client/src/ui/minigames/`) and extract helpers rather than exceeding `250` lines in existing facades.

*(Note: Pass 1 established Fog-of-War, Safe Rooms, Stash, Gold, Merchant, Blacksmith, Bounties, and Guide Quests and passed `verify:phase -- phase-9` on `d69cf481`. Per Austin's architectural expansion directive before Phase 10, Pass 2 upgrades the Floor 1 Sanctuary Hub into the fortified **`256 × 256` Walled City of Havenhold** with Blender 5.3 3D assets, hybrid enterable pocket interiors, animated 3D NPC schedules, Full Cinematic Dialogue Mode + Animalese voices, 5 multi-step city mysteries, minigames, NPC affinity, 12 collectibles, and buyable player housing.)*

---

## 1. Scope & Player Experience

Frontier Overhaul already delivered `20` POIs, color-coded `[M]` map pins, and Waystone `?` beacons. Phase 9 transforms exploration and downtime around Safe Rooms and the Floor 1 Sanctuary City of **Havenhold**:
- **Fog-of-War Explorer's Map (Pass 1 ✅)**: Unexplored tiles on `[M]` are shrouded in dark parchment fog; walking clears the shroud permanently per player while Waystone `?` beacons and Floor Stairwell hints gleam through unexplored fog, alongside placed Campfires, Home Bed pins, City District/Gate pins, and Safe-Room Hub badges.
- **Havenhold Fortified Sanctuary City (`256 × 256`, `x, y ∈ [-128, 128]`) (Pass 2 🚧)**: Replaces the tiny glade with a sprawling **Warm Medieval-Frontier Bastion** enclosed by continuous 2-tile-deep battlemented limestone walls (`|x| = 128, |y| = 128`), interval/corner bastions, and strictly **4 NPC-guarded Cardinal Gates** (`North`, `South`, `East`, `West`). Features `4` bespoke city terrain tiles (`CityCobble`, `CityPlazaStone`, `CityWoodPlank`, `CityGardenGrass`), `8` named districts, cobblestone boulevards, manicured herb gardens, fountains, wells, streetlamps, pocket cottages, and outdoor market stalls. Rare outer **Frontier Safe Rooms** (`safe-room` POI) still spawn outside in Tier II–IV biomes (`r >= 176`).
- **Blender 5.3 3D Architecture & Animated 3D Citizens (Pass 2 🚧)**: City walls, gatehouses, shop facades, tavern bars, forge hearths, market canopies, fountains, lamps, wells, and furnishings are modeled and baked in Blender 5.3 with bevels, timber beams, shingled roofs, and custom pixel surface detail (`tools/sprite-studio/` + `npm run city:bake`), paired with `>= 20` named animated 3D humanoid NPCs rendered via `PlayerSprite` (`player-rig.json`) following daytime/dusk/night cobblestone schedules and chattering in ambient street speech bubbles.
- **Hybrid Enterable Pocket Interiors & Seamless Roof Cutaways (Pass 2 🚧)**: Flagship venues (*The Rusty Flagon* Saloon, *The Iron Anvil* Blacksmith Forge, *The Gilded Scale* Merchant Emporium, *The Artisan's Workshop*, *Havenhold Guild Hall & Vault*, and *Player's Buyable City Cottage*) transition through their doorways into richly furnished dedicated Pocket Interior Zones (`ZoneManager`), while street-side pocket cottages fade their shingled roofs (`alpha -> 0.12`) cleanly when entered directly on the city grid.
- **Full Cinematic Dialogue Mode & Animalese Voice Synth (Pass 2 🚧)**: Talking to any NPC smoothly zooms & centers the camera (`~1.45×`), frames the conversation with subtle letterbox bars, turns the NPC to face the player, animates a talking 3D portrait, types out branching dialogue with per-NPC pitch/timbre **Animal-Crossing-style WebAudio voice blips** (`voiceSynth.ts`), and hands off seamlessly into Shop/Forge/Tavern/Crafting/Stash/Bounty/Minigame/Housing UIs.
- **Hours of Interactive Sanctuary City Gameplay (Pass 2 🚧)**: Authoritative Gold economy, Merchant, Blacksmith (`+1..+3` & prefix reforge), Guide quests, 3-Bounty Board, **The Rusty Flagon** Saloon meals + `5g` Hearth Rest + **Tavern Dice** wagering, **Garrison Arena** Archery Target Challenge & Sparring Bouts, **5 Multi-Step City Questlines & Mysteries**, **NPC Affinity & Gifting (`0..100`)**, **12 Hidden Havenhold Lore Tomes/Curios**, and a **Buyable & Furnishable Player City Cottage**.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` Pass 1 Contracts (`world/fog/fogOfWar.ts`, `inventory/slotModel.ts`, `net/hubSchemas.ts`, `net/protocol.ts`)
- **Fog-of-War Bitset**: Coarse `8×8`-tile cell resolution (`FOG_CELL_TILES = 8`, `16` cells per `32×32` chunk). `FogState` stores `Map<ChunkKey, number>` (`16`-bit mask per chunk), serialized compactly in snapshots and `PersistedPlayerRecord.fogMask`.
- **SlotItem Upgrade Field**: `SlotItemSchema` includes `upgradeLevel: z.number().int().min(1).max(3).optional()`, and `InventorySnapshotSchema` includes `armorUpgrades: ArmorUpgradesSchema.optional()`. Each `+1` adds `+15%` base weapon `damage` or `+1` base armor `defense` in `computePlayerGearStats`.
- **Economy & Hub Schemas**: `PlayerSnapshotSchema.gold`, `NpcKind`, `PoiKind` `"safe-room"`, `PropKind` Pass 1 stations (`StashChest`, `BountyBoard`, `NpcGuide`, `NpcMerchant`, `NpcBlacksmith`), and Pass 1 client/server hub messages.

### 2.2 Pass 1 Persistence (`persistenceStore.ts` & `offlinePersistence.ts`)
- `PersistedPlayerRecord`: persists `gold`, `stashSlots` (`27` slots), `fogMask`, `bounties`, `quests`.

### 2.3 Pass 2 Havenhold City, Pocket Interior, Dialogue & Content Contracts (🚧)
- **City Terrain & Props (`@dc2d/contracts`)**:
  - `GroundKind`: add `CityCobble = 17`, `CityPlazaStone = 18`, `CityWoodPlank = 19`, `CityGardenGrass = 20`.
  - `PropKind`: add `CityWall`, `CityWallTower`, `CityGateTower`, `BuildingWall`, `CottageRoof`, `FacadeSaloon`, `FacadeBlacksmith`, `FacadeMerchant`, `FacadeArtisan`, `FacadeGuild`, `FacadeCottage`, `BarCounter`, `TavernTable`, `AleBarrel`, `ForgeHearth`, `WeaponRack`, `MarketStall`, `CraftRack`, `CrateStack`, `CityFountain`, `CityLantern`, `CityBench`, `PlanterBox`, `TownWell`, `CottageBookshelf`, `CottageRug`, `TrophyRack`, `LorePedestal`, `ArcheryTarget`, `InteriorDoor`, `CottageForSaleSign`.
  - `ZoneKind = "overworld" | "interior"`, `InteriorId = "interior:tavern" | "interior:blacksmith" | "interior:merchant" | "interior:artisan" | "interior:guild" | "interior:player-cottage"`.
- **City Wire Schemas (`engine/src/net/citySchemas.ts`, `protocol.ts`)**:
  - `CityNpcSnapshotSchema`: `{ id, name, title, role, x, y, facingX, facingY, moving, zoneId, appearance, ambientLine?, voiceId, affinity? }`.
  - `CityProgressSnapshotSchema`: `{ affinities: Record<string, number>, mysteries: Record<string, { stage: number; completed: boolean }>, discoveredSecrets: string[], ownsCottage: boolean, cottageFurniture: PlacedFurnitureRecord[], activeMinigame?: MinigameStateSnapshot }`.
  - Client -> Server messages: `enterDoor` (`interiorId`), `exitInterior`, `dialogueAction` (`npcId, action, payload?`), `tavernBuy` (`offerId, count`), `tavernRest`, `giftNpc` (`npcId, slotIndex`), `claimSecret` (`secretId`), `minigameAction` (`game, op, wager?, value?`), `buyCottage`, `placeCottageDecor` (`decorId, x, y`), `removeCottageDecor` (`instanceId`).
  - Server -> Client `ServerSnapshotSchema` additions: `zoneId?: string`, `cityNpcs?: CityNpcSnapshot[]`, `selfCityProgress?: CityProgressSnapshot`.
- **Pass 2 Persistence**: Persist `cityProgress` (`affinities`, `mysteries`, `discoveredSecrets`, `ownsCottage`, `cottageFurniture`) in both `PersistedPlayerRecord` and `dc2d_offline_world_v1_<seed>`.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Fog-of-War Overworld Map (`fogOfWar.ts`, `minimapOverlay.ts`) ✅
- **Reveal Radius**: Automatically reveals `8×8`-tile cells within `18` tiles of player position (`22` tiles when standing on `elevation >= 1` during daytime).
- **Fog Mask Rendering**: Unexplored cells render opaque dark parchment ink while **still rendering** Waystone `?` beacons, Stairwell hints, City District/Gate pins, Sanctuary badge, and Home Bed pin, caching onto an offscreen canvas (`>= 45 FPS`, `<= 40%` drop).

### 3.2 Sanctuary City Grid, Outer Safe Rooms & Personal Stash
- **Havenhold City (`|x| <= 128, |y| <= 128`) (🚧)**: `256 × 256` fortified Sanctuary protected by `isInSanctuary(x, y)` (zero hostile aggro/damage/PvP inside walls). Enclosed by continuous 2-tile battlemented `CityWall` + corner/interval `CityWallTower`s with strictly `4` guarded `6`-tile Cardinal Gates (`N/S/E/W`). Preserves clear spawn plaza `(0.5, 0.5)`, Elevated Stone Dais (`[-13..-7, -13..-7]` + stairs), East Garrison Sparring Yard, and Botanical Herb Garden bushes/wildflowers within walking reach of spawn.
- **Outer Safe Rooms (`safe-room`) ✅**: Stamped in Tier II–IV wilderness biomes (`r >= 176`) with `inSanctuary: true`, Hearth, Workbench, `StashChest`, and a `Wayfarer Merchant`.
- **27-Slot Sanctuary Stash ✅**: Per-account private bank accessible inside Havenhold Guild Vault (`interior:guild`) and outer Safe Room `StashChest`s, strictly isolated per player.

### 3.3 Gold Economy, Merchant, Blacksmith & Floor Guide ✅
- Enemies/elites/chests/bounties/minigames award Gold (`computeItemValue` / `rollGoldDrop`). Merchant supports atomic `merchantBuy` & `merchantSell`; Blacksmith supports category-safe `blacksmithReforge` & `+1..+3` `blacksmithUpgrade` (`+15%` weapon dmg / `+1` armor def per level, rejecting `+4`). Unlocked affinity discounts (`10%–20%`) apply cleanly at Merchant/Blacksmith.

### 3.4 Bounty Board & HUD Tracker ✅
- `3` deterministic active bounties per cycle with live compact HUD tracker and atomic Gold + item claims.

### 3.5 Terrain Atlas & Blender 5.3 Architectural Art Pipeline (🚧)
- Expand GPU Terrain Atlas (`terrainTextures.ts`, `terrainTileDetails.ts`, `minimapTileCache.ts`) to `21` rows with `CityCobble`, `CityPlazaStone`, `CityWoodPlank`, and `CityGardenGrass` featuring pixel-art cobblestone courses, pavers, nailed floorboards, and trimmed lawn tufts.
- Model multi-part 3D architecture & props in Blender 5.3 (`tools/sprite-studio/blender/city/build_city_architecture.py` & `build_city_props.py`), process with `pixelPost.mjs` sel-out & depth creases via `npm run city:bake`, output `.webp` sprites to `packages/client/public/assets/city/`, and register all entries in `sprite-manifest.json`.

### 3.6 Hybrid Pocket Interiors & Seamless Roof Cutaways (🚧)
- **6 Enterable Pocket Interiors (`ZoneManager`)**: *The Rusty Flagon* (`interior:tavern`), *The Iron Anvil* (`interior:blacksmith`), *The Gilded Scale* (`interior:merchant`), *The Artisan's Workshop* (`interior:artisan`), *Havenhold Guild Hall & Vault* (`interior:guild`), and *Player's City Cottage* (`interior:player-cottage`). Door interaction (`[E]`/tap `InteriorDoor` or hero facade threshold) triggers a smooth `220ms` fade transition and isolates zone snapshots strictly by `zoneId`.
- **Street Roof Cutaways**: Outer residential cottages stamp `BuildingWall` + `CottageRoof` directly on the overworld grid and smoothly fade `CottageRoof.alpha -> 0.12` when the local player enters the footprint.

### 3.7 Animated 3D NPC Roster & Living Schedules (🚧)
- Render `>= 20` named Citizens, Shopkeepers, Guards, Barkeep, Artisan, Patron, and Villagers using `PlayerSprite` (`player-rig.json`) with unique `CharacterAppearance`. NPCs traverse daytime cobblestone routes, patrol gates, shift into *The Rusty Flagon* at dusk/night (`dayPhase`), and display periodic overheard street speech bubbles.

### 3.8 Full Cinematic Dialogue Mode & Animalese Voice Synth (🚧)
- Talking to any NPC smoothly zooms & centers camera (`~1.45×`) between player and NPC, frames viewport with subtle top/bottom letterbox bars, rotates NPC toward player, animates a talking 3D portrait canvas (`dialoguePortrait.ts`), and types branching dialogue text with click/Space skip, `1..4` keyboard/touch choices (`390×844` responsive), affinity bar, gift button, and direct service handoffs.
- `audio/voiceSynth.ts` synthesizes Animal-Crossing-style syllable blips per spoken character using per-NPC base pitch, formant filter, waveform, cadence, punctuation pauses, and `?`/`!` pitch inflection while honoring mute & SFX gain settings.

### 3.9 Saloon Service, Minigames, Mysteries, Affinity, Collectibles & Housing (🚧)
- **Saloon (`tavernModal.ts`)**: *The Rusty Flagon* serves hot meals/elixirs (`tavernBuy`), `5`-Gold Hearth Rest (`tavernRest` restoring full HP/Stamina + `Rested`), Frontier rumors, and **Tavern Dice** (`10/25/50g` wagered 3d6 vs house with reroll/double-down).
- **Garrison Arena (`arenaChallengeHud.ts`)**: Timed `30s` Archery Target Challenge against `ArcheryTarget` props + wagered Sparring Bout in the East Garrison Yard.
- **5 Multi-Step City Mysteries (`cityMysteries.ts`)**: Persistent stage progression across NPC interviews, clues, and object inspections (*The Smuggler's Cellar*, *Stolen Masterwork Ingot*, *Missing Gate Watchman*, *Whispering Fountain Vault*, *The Haunted Barrows Map*).
- **NPC Affinity (`0..100`) & 12 Hidden Secrets (`citySecrets.ts`)**: Gifting (`giftNpc`) & completing NPC quests/mysteries raise affinity through `Stranger -> Acquaintance -> Trusted -> Honored`, unlocking shop discounts and secret lore; `12` hidden `LorePedestal` tomes award Gold & Codex entries.
- **Buyable & Furnishable Cottage (`housingModal.ts`)**: Purchase deed (`150g`), enter private `interior:player-cottage`, and place/remove persisted furniture (hearth, cozy bed granting `Rested`, trophy rack, bookshelf, rug, table, lantern).

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Insufficient Gold / Full Bag / Invalid Picks**: All Economy, Tavern, Minigame wagers, Cottage Deed/Furniture purchases, and Gift transfers validate Gold, item ownership, and bag capacity atomically server-side before mutating state.
- **Zone Isolation**: Entering a Pocket Interior isolates snapshots (`players`, `cityNpcs`, `entities`, `chests`, `chatMessages`) strictly to that `zoneId`, and Player Cottage interior decor syncs exclusively to its owning account.
- **Gate & Perimeter Integrity**: Non-gate perimeter tiles (`CityWall` / `CityWallTower`) block movement with zero diagonal squeeze-through; hostile wildlife cannot spawn inside or enter `|x| <= 128 && |y| <= 128`.
- **Voice Synth & Camera Recovery**: Canceling dialogue mid-sentence (via `Escape`, close, or zone transition) immediately stops queued typewriter voice blips and smoothly restores user camera zoom & follow target with zero leaked `AudioNode`s.
- **Zero Regression Guarantee**: Spawn Plaza, Elevated Dais stairs, East Sparring targets, and nearby forageable bushes remain accessible so Pass 1 and Phase 8 E2E specs pass alongside Pass 2.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P9-01` | Fog Math ✅ | `FogState` tracks `8×8`-tile cells per `32×32` chunk, reveals `18`-tile radius (`22` elevated daytime), and round-trips losslessly through `encodeFogMask` / `decodeFogMask`. | `unit` | `packages/engine/src/world/fog/fogOfWar.test.ts` |
| `REQ-P9-02` | Fog Map UI ✅ | `[M]` Overworld Map renders dark fog over unexplored cells while keeping Waystone `?` beacons, Safe-Room icons, and Home Bed pin visible, maintaining `>= 45 FPS` (`<= 40%` FPS drop). | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-9.spec.ts` |
| `REQ-P9-03` | Fog Sync ✅ | Server replicates incremental `selfFogDelta` on explore and persists `fogMask` in `PersistedPlayerRecord` across server restart and browser reload. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-04` | Sanctuary Hub | Havenhold Sanctuary City (`x, y` in `[-128, 128]`) hosts `NpcGuide`, `NpcMerchant`, `NpcBlacksmith`, `BountyBoard`, `StashChest`, `Campfire`, `Workbench`, Saloon & Artisan shops with `inSanctuary: true` blocking hostile aggro/damage. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/world/pois/safeRoomLayout.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-05` | Outer Safe Rooms ✅ | Outer `safe-room` POIs (`PoiKind`) generate outside Havenhold (`r >= 176`) in Tier II–IV biomes with valid walkable layout, hearth, stash access, and `inSanctuary: true`. | `unit`, `static`, `sim` | `packages/engine/src/world/pois/poiCatalog.test.ts`, `scripts/verify/content-integrity.mjs`, `packages/game-server/src/sim/hubs/hubSim.test.ts` |
| `REQ-P9-06` | Sanctuary Stash ✅ | `27`-slot personal `StashChest` supports deposit/withdraw/drag-swap, isolates slots strictly per player in multiplayer, and survives server restarts. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/engine/src/inventory/stashOps.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-07` | Gold Currency ✅ | Players track authoritative `gold >= 0`, earn Gold from enemy/elite/chest loot, display Gold in HUD & Inventory, and persist Gold across restarts. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-08` | Merchant Buy ✅ | `merchantBuy` deducts exact Gold, adds purchased stack/item (failing safely with `"Not enough Gold"` or `"Inventory full"`), and syncs HUD inventory/gold immediately. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-09` | Merchant Sell ✅ | `merchantSell` removes target slot item and grants deterministic `computeItemValue` Gold scaling with `rarity`, `prefixId`, and `upgradeLevel`. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/items/pricing.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-10` | Prefix Reforge ✅ | `blacksmithReforge` deducts Gold/materials, replaces `prefixId` with a different valid category prefix preserving `upgradeLevel`, and updates `ItemCardPopover` stats. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/inventory/upgradeOps.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-11` | Gear Upgrade ✅ | `blacksmithUpgrade` upgrades gear from `+0` up to `+3` max (`+15%` damage or `+1` defense per level in `computePlayerGearStats`) and rejects `+4` safely. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/inventory/gearStats.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-12` | Bounty Board ✅ | `BountyBoard` generates `3` deterministic active bounties per floor cycle, increments live kill/clear/discover counters on server ticks, and pays Gold + reward on claim. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/bountyTracker.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-13` | Guide Quests ✅ | `NpcGuide` offers `>= 4` deterministic floor side-quests with accept/progress/turn-in states and persistent completion flags. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-14` | Hub Prompts & UI ✅ | Approaching NPCs/Bounty Board/Stash/Doors within interaction range displays `[E]`/tap prompts; opening modals works cleanly on `390×844` mobile without clipped buttons. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-9.spec.ts` |
| `REQ-P9-15` | Prop Integrity ✅ | Original Pass 1 hub `PropKind`s (`stash-chest`, `bounty-board`, `npc-guide`, `npc-merchant`, `npc-blacksmith`) pass textures, footprints, and collision specs. | `static`, `unit` | `scripts/verify/content-integrity.mjs`, `packages/client/src/render/textures/pois/safeRoomTextures.test.ts` |
| `REQ-P9-16` | Offline Parity ✅ | Solo offline preview supports Fog-of-War, Gold, Merchant, Blacksmith, Bounties, and Stash with persistence across `F5` browser reload. | `e2e-desktop` | `e2e/phase-9.spec.ts` |
| `REQ-P9-17` | City Terrain Tiles | `4` new City `GroundKind`s (`CityCobble`, `CityPlazaStone`, `CityWoodPlank`, `CityGardenGrass`) paint custom masonry/plank/lawn motifs in the 21-row GPU atlas and minimap RGB palette across `256×256` tiles. | `unit`, `static`, `e2e-desktop`, `visual` | `packages/engine/src/world/city/cityLayout.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/phase-9.spec.ts` |
| `REQ-P9-18` | City Grid & Districts | `256×256` Havenhold grid (`x, y` in `[-128, 128]`) provides `8` named districts, 6-tile boulevards, 4-tile streets, clear spawn, preserved Dais stairs, East Sparring Yard, and Botanical Herb Garden. | `unit`, `e2e-desktop`, `visual` | `packages/engine/src/world/city/cityLayout.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-19` | Perimeter Walls & Gates | Impassable 2-tile battlemented `CityWall` + `CityWallTower`s enclose Havenhold with strictly `4` Cardinal `6`-tile Gates guarded by `CityGateTower`s and twin animated `NpcGuard`s. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/world/city/cityLayout.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-20` | Blender 3D Pipeline | Blender 5.3 generators (`build_city_architecture.py`, `build_city_props.py`, `bakeCityAssets.mjs`) bake multi-part sel-out `.webp` city assets registered cleanly in `sprite-manifest.json`. | `unit`, `static` | `packages/client/src/render/textures/city/cityManifest.test.ts`, `scripts/verify/content-integrity.mjs` |
| `REQ-P9-21` | City Prop Registry | All new City `PropKind`s (walls, towers, 6 hero facades, cutaway parts, furnishings, decor, signs) have exhaustive `PROP_SPECS` and mounted renderers in `chunkProps.ts` (`0` orphans/missing). | `static`, `unit` | `scripts/verify/content-integrity.mjs`, `packages/client/src/render/textures/city/cityManifest.test.ts` |
| `REQ-P9-22` | Dedicated Shops | Havenhold stamps dedicated hero shop buildings for *The Rusty Flagon* Saloon, *The Iron Anvil* Forge, *The Gilded Scale* Emporium, *The Artisan's Workshop*, *Guild Hall & Vault*, and *Buyable Cottage*. | `unit`, `e2e-desktop`, `visual` | `packages/engine/src/world/city/cityLayout.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-23` | Pocket Interiors | Entering any Hero Building door transfers player atomically via `ZoneManager` into isolated Pocket Interior Zones (`interior:tavern`, `blacksmith`, `merchant`, `artisan`, `guild`, `player-cottage`) and returns cleanly to doorstep. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/engine/src/world/city/interiorLayouts.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-24` | Roof Cutaways & Decor | Outer grid pocket cottages & market stalls fade `CottageRoof` (`alpha -> 0.12`) on player entry without zone reload; blocks contain `CityFountain`, `CityLantern`, `CityBench`, `PlanterBox`, and `TownWell`. | `unit`, `e2e-desktop`, `visual` | `packages/engine/src/world/city/cityLayout.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-25` | Living 3D NPCs | `>= 20` named animated 3D City NPCs render via `PlayerSprite`, walk daytime cobblestone schedules, gather at Saloon at dusk/night, face speakers, and display ambient speech bubbles. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/content/src/city/cityCatalog.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-26` | Cinematic Dialogue | Talking to NPCs smoothly zooms/pans camera (`~1.45×`), shows letterbox bars, animates 3D portrait mouth/bounce, types text with click/Space skip, offers choices, and opens shop/quest/minigame UIs. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-9.spec.ts` |
| `REQ-P9-27` | Animalese Voice Audio | `voiceSynth.ts` plays per-NPC pitched procedural voice blips synced with typewriter cadence, punctuation pauses, and `?`/`!` inflection, honoring mute/gain with `0` leaked `AudioNode`s. | `unit`, `e2e-desktop` | `packages/client/src/audio/voiceSynth.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-28` | Saloon Bar Service | *The Rusty Flagon* serves food/drinks (`tavernBuy`), `5`-Gold Hearth Rest (`tavernRest` full HP/Stamina + `Rested`), and rotating Frontier rumors inside `TavernModal`. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/content/src/city/cityCatalog.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-29` | Tavern Dice Game | Playable **Tavern Dice** minigame inside the Saloon supports Gold wagers, 3d6 roll + reroll/double-down vs house, deterministic payouts, and anti-cheat server validation. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/engine/src/city/minigames.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-30` | Garrison Arena Games | East Garrison Arena supports timed `30s` Archery Target Challenge and wagered Sparring Champion bouts paying Gold & trophies atomically. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/city/minigames.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-31` | 5 City Mysteries | `5` multi-stage City Questlines track investigation clues across multiple NPCs & locations, award Gold/items/affinity on completion, and persist across restarts. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/city/cityCatalog.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-32` | NPC Affinity & Gifts | `giftNpc` & quests raise per-NPC Affinity (`0..100`) across 4 trust tiers, unlocking `10%–20%` Merchant/Blacksmith discounts and secret dialogue lines. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/city/cityCatalog.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-33` | 12 Hidden Secrets | `12` inspectable Havenhold `LorePedestal` tomes & alley curios award Codex entries and Gold atomically once per account and persist across reloads. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/city/cityCatalog.test.ts`, `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-34` | Buyable Player Cottage | Players purchase the Cottage Deed (`150g`), enter private `interior:player-cottage`, and place/remove persisted hearth, bed, trophy, and decor items isolated per account. | `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/game-server/src/sim/city/citySim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-35` | City Map & Offline Sync | `[M]` map renders Havenhold districts, shops, and 4 Gates; solo offline preview mirrors pocket interiors, NPCs, dialogue, Saloon, minigames, mysteries, affinity, secrets, and housing across `F5`. | `e2e-desktop` | `e2e/phase-9.spec.ts` |
| `REQ-P9-36` | City Perf & Mobile UX | Full `256×256` Havenhold City + Interiors + Dialogue sustain `>= 45 FPS` desktop, zero HUD overlap/clipping on `390×844` mobile, and zero regressions in `baseline-smoke` & `phase-8`. | `e2e-desktop`, `e2e-mobile` | `e2e/phase-9.spec.ts` |

---

## 6. Phase Exit Gate

Phase 9 may be marked `✅ Complete` only when `npm run verify:phase -- phase-9` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `36` requirements (`REQ-P9-01`..`REQ-P9-36`) passing across Desktop & Mobile.
