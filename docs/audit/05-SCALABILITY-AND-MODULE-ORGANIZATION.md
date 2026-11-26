# 05 — Scalability & Feature-Sliced Module Organization Blueprint

> **Scope**: Scaling DungeonCrawler2D from **<10% completion (`v0.11.10`)**—77 items, 37 props, 9 creatures, 1 overworld plane, flat JSON persistence, full-tick WebSocket snapshots—to **100% completion across Phases 8–13 and post-launch expansions** (600+ static & System-AI-crafted items, 150+ props, 50+ creatures & multi-phase bosses, multi-floor pitch-black dungeons, safe-room hubs, dynamic weather, co-op parties, and composable runtime `EffectGraph`s).

---

## Executive Summary

At current prototype scale (`1–4` players in a single overworld zone), flat arrays, full-state JSON saves, per-tick object snapshots, and category-less folders work adequately. **Every one of these patterns hits a hard scaling wall between Phase 8 and Phase 13:**

- **Module Folder Wall (`SCALE-02`)**: Five key directories (`client/src/net`, `client/src/render/character`, `client/src/render/world`, `engine/src/world`, `game-server/src/sim/wildlife`) are already at **`12/12` direct files** (`MAX_DIRECT_FILES = 12` in [check-folder-size.mjs](file:///c:/repos/DungeonCrawler2D/scripts/check-folder-size.mjs#L9)), and six more sit at `10–11/12`. Phase 8–13 features literally cannot be added into those folders without restructuring into domain feature slices.
- **Content & Effect Combinatorial Wall (`SCALE-01`)**: Hardcoded item/perk/status `if`/`switch` branches ([gearEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/gearEffects.ts), [statusEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/statusEffects.ts)) cannot scale to 600+ items or Phase 13's runtime LLM-synthesized items (`System AI`), which require deterministic, data-driven `EffectGraph` execution.
- **Spatial & Multi-Zone Wall (`SCALE-03`)**: `WorldSim` hardcodes a single coordinate space, `WorldChunkCache` caps at `96` chunks (thrashing at `11+` dispersed players), and A* / ecology / AOI perform linear scans (`O(N_props)` and `O(N_entities)`).
- **Network & Persistence Walls (`SCALE-04`, `SCALE-05`)**: Resending all `worldDeltas` on every chop/build (`wsServer.ts:97`) and serializing the entire world + all players + untouched POI chests via main-thread `JSON.stringify` (`persistenceStore.ts:93`) will stall the 20 Hz server loop once fog-of-war masks, safe-room stashes, multi-floor deltas, and invented item catalogs accumulate.

---

## Scaling Bottleneck Matrix

| ID | Severity | Subsystem | Current Limit (`v0.11.10`) | Breaking Point | Target Architecture (10x+ Scale) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SCALE-01` | **Critical** | Content, Statuses & Composable Effects | Hardcoded `if`/`switch` per perk/status; 10-file manual edits per item/prop | Phase 8–10 perks & Phase 13 System-AI items | Unified Declarative `ItemDef` / `PropSpec` / `StatusSpec` Manifests + Pure `EffectGraph` VM |
| `SCALE-02` | **Critical** | Monorepo Folder & Module Organization | 5 folders at `12/12` files, 6 at `10–11/12`; horizontal layer buckets | Immediate (Phase 8 file additions fail lint) | Vertical Feature-Sliced Domain Folders (`<= 10` prod files/folder) across all packages |
| `SCALE-03` | **Critical** | Multi-Zone Sim, Spatial Indexing & Chunk Cache | Single global plane; `O(N)` entity/prop scans; `96`-chunk LRU cap | Phase 9–11 multi-floor dungeons & `11+` co-op players | `ZoneManager` (`ZoneSim` per floor/dungeon) + `16×16` Spatial Hash Grid + `32×32` Nav Cost Bitmask |
| `SCALE-04` | **High** | 20 Hz WebSocket Protocol & AOI Filtering | Full `worldDeltas` broadcast; tick-bypass `BROADCAST_ACTIONS`; unredacted chests/players | `10+` concurrent players or `500+` world deltas | Chunk-Subscribed Delta Streams + Dirty-Bit Entity Compression + Strict AOI/Vault Redaction |
| `SCALE-05` | **High** | World & Player Persistence | Monolithic main-thread `world-save.json` + name-keyed player identity + eager POI chests | `100+` player profiles + Phase 9 fog masks + Phase 13 items | Node `node:sqlite` (WAL mode) + Schema Migrations + Session-Token Auth + Mutated-Only Chests |
| `SCALE-06` | **High** | Sprite Bake, Runtime Atlases & CDN Caching | `31` flat files in `sprite-studio`; runtime CPU `playerAtlasPacker`; `max-age=0` S3 assets | Bosses, swim/punch clips, `50+` armor visuals | Modular `sprite-studio` + Build-Time Trimmed Atlases + Content-Hashed `immutable` Asset Packs |
| `SCALE-07` | **Medium** | Client HUD & Modal Orchestration | Imperative cross-wired callbacks in `main.ts` (`218` lines) & `hudRoot.ts` | Phases 9–12 add 8 new HUD panels/modals | Typed Reactive Client Store (`ClientViewState`) + Declarative Panel/Shortcut Controller Registry |
| `SCALE-08` | **Medium** | Procedural Worldgen & POI Placement | `findChunkPoi` runs `33,124` FBM calls per candidate chunk on main thread | Dispersed players exploring new chunks at sprint/mount speed | Macro-Region Seed Planner (`256×256` tile regions) + 5-Point Coarse Slope Pre-Rejection |

---

## Detailed Scaling Designs & Proposed Fixes

### `SCALE-01` (Critical) — Unified Declarative Content Manifests & Early Phase-13 Composable `EffectGraph`

#### Problem Analysis
Today, item, prop, and status behavior is split between passive data in `@dc2d/content` and imperative string/enum dispatchers scattered across `engine`, `game-server`, and `client`:
- [gearEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/gearEffects.ts#L57-L96) hardcodes `lifesteal`, `bleed`, `burn`, `poison`, and `thorns` in imperative combat hooks.
- [statusEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/statusEffects.ts#L1-L126) hardcodes fixed DoT steppers for `poisonTimer` and `burnTimer` only (`bleedTimer` isn't even ticked there!) rather than iterating a data-driven `StatusRegistry`.
- [lootTables.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/lootTables.ts#L27-L33) manually lists rollable gear IDs (`GEAR_BY_RARITY`), so any new weapon/armor omitted from that array silently never drops in the world.
- If Phases 8, 10, 11, and 12 add food buffs, boss debuffs, class perks, weapon masteries, and trap effects as bespoke `if` branches, **Phase 13 (`Composable Effects & System AI`) will require rewriting the entire combat engine**.

#### Target Architecture: Data-Driven Registries + Pure `EffectGraph` VM Now
Introduce the bounded `EffectGraph` and unified `PropSpec` / `ItemDef` / `StatusSpec` registries **before Phase 8**, so every Phase 8–12 buff, potion, shrine, perk, trap, and boss aura is authored as data on the exact same VM that Phase 13's System-AI will target:

```ts
// 1. Unified Prop Capability Manifest (@dc2d/content/src/props/propRegistry.ts)
export interface PropSpec {
  readonly kind: PropKind;
  readonly category: "tree" | "foliage" | "rock" | "ore" | "structure" | "lighting" | "furniture" | "hazard" | "portal";
  readonly collision: { readonly shape: "none" | "circle" | "aabb"; readonly radius?: number; readonly halfW?: number; readonly halfH?: number; readonly offsetY?: number };
  readonly blocksLineOfSight: boolean;
  readonly foliageOcclusionRadius?: number;
  readonly stealth: { readonly groundCoverBonus: number; readonly canopyShadeBonus: number; readonly lightEmitRadius?: number };
  readonly combatSurface: "none" | "wood" | "stone" | "flesh" | "metal";
  readonly spiderWebAnchor: boolean;
  readonly harvest?: HarvestNodeSpec;
  readonly interaction?: { readonly kind: "chest" | "workbench" | "forge" | "campfire" | "bedroll" | "portal" | "lore" | "puzzle" | "shrine" };
}
// Enforces at compile time that EVERY PropKind has complete physics, AI, stealth, and harvest metadata:
export const PROP_SPECS = { /* ... */ } as const satisfies Record<PropKind, PropSpec>;
```

```ts
// 2. Composable Effect Triggers & Bounded Actions (@dc2d/contracts/src/effects.ts)
export type EffectTrigger =
  | "on_melee_hit" | "on_crit" | "on_kill" | "on_block" | "on_parry"
  | "on_dodge" | "on_damaged" | "on_consume" | "on_equip_passive" | "on_interval";

export type EffectAction =
  | { readonly op: "apply_status"; readonly statusId: StatusId; readonly stacks: number; readonly durationSec: number }
  | { readonly op: "deal_aoe_damage"; readonly element: DamageElement; readonly radiusTiles: number; readonly weaponDamageMult: number }
  | { readonly op: "restore_vital"; readonly vital: "hp" | "stamina"; readonly flat?: number; readonly fractionOfDamage?: number }
  | { readonly op: "spawn_hazard"; readonly hazardId: string; readonly radiusTiles: number; readonly durationSec: number }
  | { readonly op: "modify_stat"; readonly stat: StatKey; readonly add?: number; readonly mult?: number };

export interface EffectRule {
  readonly trigger: EffectTrigger;
  readonly chance?: number;           // Validated in [0, 1]
  readonly internalCooldownSec?: number;
  readonly actions: readonly EffectAction[]; // Capped at <= 4 actions, recursion depth = 1
}
```
- **Dynamic Loot Indexing**: Replace `GEAR_BY_RARITY` in [lootTables.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/lootTables.ts#L27-L33) with a pure startup index computed from `ITEM_CATALOG.filter((i) => i.lootDropEligible !== false && (i.weaponArchetype || i.armorSlot))` grouped by `rarity` and `biomeTags`. Adding an item to its domain catalog file automatically wires drops, tooltips, mobile action labels, and combat effects!

---

### `SCALE-02` (Critical) — Feature-Sliced Domain Module Organization Blueprint (`<= 10` Prod Files / Folder)

#### Current Saturation Snapshot (Exact Direct File Counts)
Per [check-folder-size.mjs](file:///c:/repos/DungeonCrawler2D/scripts/check-folder-size.mjs#L9-L11), every folder is capped at `12` direct JS/TS files (`SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/`):
- **At 12/12 (100% full — zero files can be added)**:
  - `packages/client/src/net` (`8` prod + `4` test)
  - `packages/client/src/render/character` (`11` prod + `1` test)
  - `packages/client/src/render/world` (`10` prod + `2` test)
  - `packages/engine/src/world` (`8` prod + `4` test)
  - `packages/game-server/src/sim/wildlife` (`11` prod + `1` test)
- **At 10–11/12 (83–92% full)**:
  - `packages/client/src/audio` (`11`), `packages/client/src/render/combat` (`11`), `packages/client/src/render/textures` (`11`), `packages/client/src/ui/hud` (`11`), `packages/engine/src/combat` (`11`), `packages/client/src/soundStudio` (`10`), `packages/game-server/src/sim` (`10`).
- **Unchecked 31-file monolith**: `tools/sprite-studio` has **`31` direct `.py`/`.mjs` files** in one flat directory because `SOURCE_FILE` in [check-folder-size.mjs](file:///c:/repos/DungeonCrawler2D/scripts/check-folder-size.mjs#L11) only counts JS/TS extensions (`8` `.mjs` files) and completely ignores its `23` `.py` Blender scripts!

#### Target Feature-Sliced Directory Architecture
Organize every package by **vertical domain feature slices** rather than horizontal technical grab-bags, keeping `<= 8` production files per folder + colocated `README.md` + `*.test.ts`:

```text
packages/
├── contracts/src/                  # Zero-dep shared IDs, types & Zod schemas
│   ├── world/                      # BiomeKind, GroundKind, PropKind, ZoneId, PoiKind
│   ├── items/                      # ItemDef, RecipeDef, Rarity, ArmorSlot, WeaponArchetype
│   ├── combat/                     # DamageElement, StatusSpec, EffectGraph, HitboxSpec
│   ├── actors/                     # Appearance, Progression, Party, CreatureKind
│   └── net/                        # ClientMessage, ServerMessage, DeltaChunkPacket
│
├── content/src/                    # Pure declarative catalogs (imports @dc2d/contracts)
│   ├── biomes/                     # overworldBiomes.ts, dungeonFloors.ts, weatherProfiles.ts
│   ├── props/                      # foliageProps.ts, structureProps.ts, dungeonProps.ts, propRegistry.ts
│   ├── items/
│   │   ├── weapons/                # meleeWeapons.ts, rangedWeapons.ts, stavesAndShields.ts
│   │   ├── armor/                  # lightArmor.ts, heavyArmor.ts, accessories.ts
│   │   ├── consumables/            # foodAndMeals.ts, potionsAndDraughts.ts
│   │   ├── materials/              # rawResources.ts, refinedGoods.ts, bossTrophies.ts
│   │   └── modifiers/              # prefixes.ts, rarities.ts, lootTables.ts, statResolver.ts
│   ├── recipes/                    # handcraftRecipes.ts, stationRecipes.ts, cookingRecipes.ts
│   ├── creatures/                  # wildlifeCatalog.ts, dungeonMobCatalog.ts, bossCatalog.ts
│   ├── statuses/                   # elementalStatuses.ts, survivalBuffs.ts, statusRegistry.ts
│   └── progression/                # xpCurves.ts, perkTrees.ts, weaponMasteries.ts, bounties.ts
│
├── engine/src/                     # Pure deterministic simulation rules (zero I/O, zero Pixi)
│   ├── kinematics/                 # collision.ts, jumpPhysics.ts, moveModifiers.ts, gaitClock.ts
│   ├── combat/
│   │   ├── melee/                  # weaponMovesets.ts, swingStepper.ts, combatRules.ts
│   │   ├── hitboxes/               # combatShapes.ts, creatureHitboxSpecs.ts, hitboxOverlap.ts
│   │   ├── sensing/                # aiSensing.ts, stealthRules.ts, darknessTerror.ts
│   │   └── effects/                # effectVm.ts, statusTicker.ts, runtimeItemRegistry.ts
│   ├── navigation/                 # navGridBitmask.ts, pathfinding.ts, pathHeap.ts
│   ├── worldgen/
│   │   ├── terrain/                # biomeSampler.ts, macroBiome.ts, chunkGenerator.ts
│   │   ├── pois/                   # shrineLayouts.ts, lairLayouts.ts, microLayouts.ts, poiStamper.ts
│   │   └── dungeons/               # dungeonGraphGen.ts, roomTemplates.ts, bossArenaStamper.ts
│   ├── inventory/                  # slotModel.ts, armorOps.ts, chestOps.ts, crafting.ts, gearStats.ts
│   ├── survival/                   # harvestRules.ts, campBuilding.ts, worldDeltas.ts
│   └── spatial/                    # spatialHashGrid.ts, fogBitmask.ts, dayNight.ts, noise.ts
│
├── game-server/src/                # Authoritative multi-zone host & persistence
│   ├── net/                        # wsServer.ts, sessionAuth.ts, aoiBroadcaster.ts, rateLimiter.ts
│   ├── persistence/                # sqliteStore.ts, migrations/, playerRepo.ts, zoneDeltaRepo.ts
│   ├── zones/                      # zoneManager.ts, zoneSim.ts, portalTransfers.ts, safeRoomHub.ts
│   ├── actors/
│   │   ├── players/                # playerActor.ts, playerInventory.ts, dodgeRoll.ts, progressionSim.ts
│   │   ├── creatures/              # creatureActor.ts, navigationRunner.ts, scentTrail.ts, pursuitLoss.ts
│   │   ├── behaviors/              # boarAi.ts, bearAi.ts, wolfPackAi.ts, spiderAi.ts, humanoidAi.ts
│   │   └── bosses/                 # bossDirector.ts, wardenBossAi.ts, catacombBossAi.ts
│   ├── systems/                    # meleeSystem.ts, projectileSystem.ts, ecologySpawner.ts, lootSystem.ts
│   ├── exploration/                # discoveryTracker.ts, fogTracker.ts, shrineSystem.ts, puzzleSystem.ts
│   ├── social/                     # proximityChat.ts, partyManager.ts, pingSystem.ts, adminCommands.ts
│   └── ai-director/                # systemAiSynthesizer.ts, itemValidator.ts, countdownDirector.ts
│
├── client/src/                     # Playable browser client ONLY (devtools extracted)
│   ├── app/                        # bootstrap.ts, clientStore.ts, keybindRouter.ts
│   ├── net/
│   │   ├── transport/              # worldSocket.ts, actionGate.ts, chunkDeltaSubscriber.ts
│   │   └── prediction/             # localPredictor.ts, localSwingTracker.ts, remoteInterp.ts
│   ├── input/                      # desktopInput.ts, mobileControls.ts, autoAim.ts, interactHooks.ts
│   ├── render/
│   │   ├── stage/                  # worldScene.ts, worldViewportGraph.ts, cameraController.ts
│   │   ├── terrain/                # chunkRenderer.ts, tileBuilder.ts, cliffStrips.ts, chunkProps.ts
│   │   ├── hero/                   # playerSprite.ts, playerCompositor.ts, heldGearView.ts, armRig.ts
│   │   ├── hero-atlas/             # playerAssets.ts, playerAtlasPacker.ts, playerRecolor.ts
│   │   ├── actors/                 # entitySprites.ts, entityAnimator.ts, eliteVisuals.ts, pickupsView.ts
│   │   ├── vfx/                    # combatVfx.ts, gore/, webs/, weatherParticles.ts
│   │   ├── lighting/               # lightingSystem.ts, castShadows.ts, fogOfWarShader.ts, glsl/
│   │   └── textures/               # terrain/, foliage/, props/, pois/, icons/
│   ├── audio/                      # engine/, synth/, ambience/, adaptiveMusic/, creatures/, weapons/
│   └── ui/                         # vitals/, hotbar/, inventory/, crafting/, map/, hub/, party/, progression/
│
└── studio/                         # Extracted dev-only workspace (never deployed to prod S3!)
    ├── sandbox/                    # Combat & ecology visual testbed + poseTuner
    └── sound-studio/               # Multi-track procedural Web Audio DAW
```

---

### `SCALE-03` (Critical) — Multi-Zone Simulation, Spatial Hash Grid & Nav-Bitmask Scaling

#### Evidence of Current `O(N)` & Single-Zone Limits
1. **Single Coordinate Plane**: `WorldSim` ([worldSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/worldSim.ts#L50-L75)) owns a single `WorldChunkCache`, a single `WorldEcology`, and a single `WebNetwork`. Phase 11 requires simultaneous simulation of the Overworld alongside instanced/multi-floor pitch-black dungeons (`floor-2-catacombs`, `floor-3-abyss`), where sunlight, weather, creature rosters, and coordinates are completely independent.
2. **Hardcoded `96`-Chunk LRU Thrashing**: [collision.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L13-L14) sets `maxCachedChunks = 96` on `WorldChunkCache`. Each player loads a `3×3` (`9` chunk) neighborhood in `worldEcology.ts` (plus collision/LOS neighbor queries). At **`11+` dispersed players** (`11 × 9 = 99 > 96`), `WorldChunkCache` evicts active chunks *every single tick* and regenerates `32×32` FBM noise + POIs continuously!
3. **`O(N_props)` A* Obstacle Inner Loop**: [pathfinding.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/pathfinding.ts#L86-L108) (`evaluatePropCost`) iterates over **every prop in a `3×3` chunk neighborhood** (`~600–1,400` props) for *every candidate neighbor cell* across up to `720` A* iterations = up to **`~1,000,000` prop distance checks per path query**.
4. **Global Linear Scans**: `snapshotFilter.ts` scans all global entities/loot/webs/chests per client at 20 Hz; `webNetwork.ts` scans all webs vs all campfires/torches.

#### Proposed Fix
1. **`ZoneManager` + Isolated `ZoneSim` Instances**:
   - Wrap per-space state (`chunkCache`, `spatialGrid`, `ecology`, `deltaOverlay`, `weatherState`, `players`) inside `ZoneSim`.
   - `ZoneManager` ticks only **active zones** (zones with `>= 1` connected player, hibernating empty dungeon zones after a `60s` grace timer and flushing deltas to SQLite).
2. **Uniform `SpatialHashGrid<T>` (`16×16` tile cells) in `@dc2d/engine/src/spatial/spatialHashGrid.ts`**:
   - Maintain per-zone spatial buckets for `CreatureActor`, `PlayerActor`, `GroundLoot`, `WorldChest`, and `WebStrand`.
   - Updating a moving actor's cell takes `O(1)` integer bitshifts (`cellX = x >> 4`, `cellY = y >> 4`).
   - AOI filtering, melee/cleave overlap, projectile sweeps, pack-howl queries, and campfire warmth queries inspect only the `3×3` or `5×5` overlapping cells (`O(k_local)` instead of `O(N_global)`).
3. **Cached Per-Chunk `Uint8Array` Walkability & Cost Grid (`64×64` half-tile resolution = `4 KB` / chunk)**:
   - Bake static terrain + prop collision footprints + foliage movement costs into a `Uint8Array(4096)` once when a chunk is generated, updating only dirty `3×3` cells when a tree/rock is harvested or camp structure built.
   - `pathfinding.ts` (`sampleCellCost`) becomes a **single `O(1)` array read** (`chunk.navCost[ly * 64 + lx]`), speeding up A* by **~200x** and unlocking boss/party crowd pathfinding!
4. **Dynamic Chunk Cache Sizing**: Set `maxCached = Math.max(256, activePlayerCount * 36)` with reference-counted pinning for chunks inside any active player's `5×5` simulation window.

---

### `SCALE-04` (High) — Network Protocol Scaling: Chunk-Subscribed Deltas, Dirty-Field Snapshots & Strict AOI Redaction

#### Evidence
1. **Tick-Bypass `O(C^2)` Broadcast Amplification**: [wsServer.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L21-L23) (`BROADCAST_ACTIONS`) triggers `broadcastTickSnapshots({ clients, sim, ... })` (`line 184`) **immediately inside `dispatchMessage`** on every `hello`, `setAppearance`, `equipArmor`, `unequipArmor`, `selectHotbar`, `placeStructure`, `pickupLoot`, `dropItem`, `useItem`, `chat`, etc.—re-filtering and serializing full world snapshots to **every connected client** out-of-band of the 20 Hz tick (while non-broadcast actions at `line 185` still rebuild `makeTickBroadcastData` for the sender)!
2. **Unbounded Full-World `worldDeltas` Resends**: [wsServer.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/wsServer.ts#L97-L108) sends `worldDeltas: sim.worldDeltaSnapshot()` (every chopped stump and camp piece across the *entire server*) to every client whenever `deltaRev` increments! At `5,000` harvested/built props across a persistent world, every single tree chop broadcasts megabytes of JSON.
3. **AOI & Information-Disclosure Leaks in `snapshotFilter.ts`**:
   - [snapshotFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/snapshotFilter.ts#L91-L95) sends **all `players` across the entire map** (including sneaking PvP players `5,000` tiles away!) in every 20 Hz snapshot.
   - [snapshotFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/snapshotFilter.ts#L19) (`DEFAULT_AOI_RADIUS_TILES = 42`, applied at [line 98](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/net/snapshotFilter.ts#L98)) sends full `chest.slots` for **unopened and sealed puzzle/lair chests** within `42` tiles before the player unlocks or opens them.

#### Proposed Fix
1. **Eliminate Immediate `broadcastTickSnapshots`**: Mutate state inside `WorldSim`, mark `player.inventoryDirty = true` or `zone.pendingDeltaEvents.push(delta)`, and flush **strictly once per 20 Hz tick** (sending private `inventorySync` packets only to the affected player, not re-broadcasting world snapshots to all clients!).
2. **Chunk-Subscribed Delta Sync (`chunkSubscribe` / `worldDeltaPatch`)**:
   - Server tracks `session.loadedChunkKeys: Set<string>` based on the player's `zoneId` and `3×3` visual chunk window.
   - When a player enters a new chunk `(cx, cy)`, server sends `chunkDeltasInit { chunkKey, deltas }` once.
   - Live harvests/regrowths/builds emit a tiny incremental `worldDeltaEvent { op: "upsert" | "remove", delta }` (`< 120 bytes`) **only** to sessions subscribed to that `chunkKey`!
3. **Strict AOI + Stealth + Vault Redaction**:
   - Filter remote `players` to `zoneId === viewer.zoneId && dist <= AOI_RADIUS` (except party members' coarse map pins sent at 1 Hz via `partyPins`), and omit remote crouching/stealthed non-party players outside detection range!
   - Strip `chest.slots` from `WorldChestSnapshot` (send `{ id, x, y, sealed, isEmpty }` in AOI, and send `openChestSync { chestId, slots }` **only** to sessions currently interacting with an unsealed chest).
4. **Static vs Dynamic Entity Split (`entitySpawn` + Compact Tick Updates)**:
   - Send static fields (`kind`, `eliteRank`, `affixes`, `packId`, `maxHp`, `scale`) once when an entity enters a client's AOI (`entitiesAdded`), and send only quantized dynamic fields (`id`, `x`, `y`, `z`, `facing`, `hp`, `state`, `statusMask`) on 20 Hz ticks—cutting snapshot bandwidth by **~65%**.

---

### `SCALE-05` (High) — Persistence Scaling: Migrating `world-save.json` to SQLite WAL (`node:sqlite`) + Migrations

#### Evidence
[persistenceStore.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/persistenceStore.ts#L78-L96) serializes the entire persistent state (`worldDeltas`, all historical `players`, and all `chests`) into a single JSON string synchronously on the Node.js main thread (`JSON.stringify(snapshot)`). Additionally:
- **Eager Untouched Chest Bloat**: [worldEcology.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/worldEcology.ts#L51-L60) spawns deterministic POI chests whenever a player walks near any chunk and [worldPersistenceSync.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/worldPersistenceSync.ts#L42) persists **every generated chest**, even if no player ever opened or touched it!
- **`simElapsedSec` Reset Bug**: `WorldDelta.regrowAtSec` stores server-boot-relative `this.elapsedSec + spec.regrowSec`, yet `elapsedSec` resets to `0` on server restart! A tree scheduled to regrow at `t = 36,300s` after a 10-hour server uptime will stay a stump for **10 hours** after a server restart!
- **Unauthenticated Name Keying**: `players` is keyed by raw display name (`Record<string, PersistedPlayerRecord>`), allowing anyone typing another player's name on the title screen to hijack or clone their character.

#### Proposed Fix: Node 22 Built-In `node:sqlite` (Zero Native C++ Build Hassle!) in WAL Mode
Since `package.json` already mandates `"node": ">=22"`, use Node's built-in `node:sqlite` (`DatabaseSync` with `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) behind a clean `WorldRepository` interface:

1. **Normalized Incremental Tables (commit only dirty rows every `5s` in `< 1ms`)**:
   - `schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER)`
   - `world_meta (key TEXT PRIMARY KEY, value TEXT)` — stores `world_seed` and **monotonic `world_clock_sec`** so `regrowAtSec` survives restarts accurately!
   - `accounts (token_hash TEXT PRIMARY KEY, player_id TEXT UNIQUE, display_name TEXT, created_at INTEGER)` — client stores a high-entropy `256-bit` bearer token in `localStorage` (`dc2d.authToken`), decoupling display name from account ownership.
   - `players (player_id TEXT PRIMARY KEY, zone_id TEXT, x REAL, y REAL, appearance_json TEXT, inventory_json TEXT, progression_json TEXT, stash_json TEXT, updated_at INTEGER)`
   - `player_fog_chunks (player_id TEXT, zone_id TEXT, chunk_key TEXT, bitmask BLOB, PRIMARY KEY (player_id, zone_id, chunk_key))` — scales Phase 9 fog-of-war cleanly with compact binary `BLOB`s (`128 bytes` per `32×32` chunk).
   - `zone_deltas (zone_id TEXT, chunk_key TEXT, prop_id TEXT, kind TEXT, payload_json TEXT, regrow_at_sec REAL, PRIMARY KEY (zone_id, prop_id))` indexed on `(zone_id, chunk_key)` and `(regrow_at_sec)`.
   - `mutated_chests (zone_id TEXT, chest_id TEXT PRIMARY KEY, sealed INTEGER, slots_json TEXT, updated_at INTEGER)` — **only persist chests once `dirty === true`** (unsealed or slot-modified); untouched POI chests regenerate deterministically from `worldSeed`!
   - `invented_items (item_id TEXT PRIMARY KEY, def_json TEXT, created_by TEXT, created_at INTEGER)` — ready for Phase 13 `System AI` persistence.

---

### `SCALE-06` (High) — Asset, Sprite-Bake & Runtime VRAM Scaling Pipeline

#### Evidence
1. **31-File Flat `tools/sprite-studio/`**: Every creature builder (`build_goblin.py`..`build_orc.py`), action generator (`arachnid_actions.py`..`quadruped_actions.py`), and Node baker (`bakePlayerAssets.mjs`, `bakeSpriteSheet.mjs`, `bakeGearAssets.mjs`) lives in one 31-file directory. Scaling to `50` creatures and `15` bosses will make `tools/sprite-studio` `120+` flat files.
2. **Client-Side Runtime Atlas Packing**: [playerAtlasPacker.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/atlas/playerAtlasPacker.ts) decodes 16 full-grid WebP layers (`player-rig.json` alone is `244 KB` of JSON frame metadata!) and packs cropped sub-cells on the browser main thread.
3. **Zero CDN Caching on Static Sprites**: [deploy-production.yml](file:///c:/repos/DungeonCrawler2D/.github/workflows/deploy-production.yml#L104-L109) syncs `packages/client/dist` (including all fixed-name WebP/PNG spritesheets and JSON manifests under `public/assets/`) with `--cache-control "no-cache"`—granting `immutable` caching only to Vite's hashed `*-????????.js` and `*-????????.css` bundles—forcing browsers to revalidate megabytes of sprite assets while any unreferenced pack files under `packages/client/public/` ship straight to S3.

#### Proposed Fix
1. **Restructure `tools/sprite-studio/` into Sub-Packages**:
   - `tools/sprite-studio/core/` (`studio_core.py`, `pixelPost.mjs`, `pngCodec.mjs`, `manifestSync.mjs`)
   - `tools/sprite-studio/actions/` (`humanoid_actions.py`, `quadruped_actions.py`, `arachnid_actions.py`, ...)
   - `tools/sprite-studio/creatures/` (one file per creature or data-driven rig recipes)
   - `tools/sprite-studio/player/` (`build_player.py`, `player_actions.py`, `export_player_layers.py`, `bakePlayerAssets.mjs`)
2. **Build-Time Trimmed Atlas Packing + Binary/Compact Rig Metadata**:
   - Move tight-bbox trimming and multipack atlas assembly into `bakePlayerAssets.mjs` at build time, emitting pre-trimmed WebP sheets + compact frame-array tuples (`[x, y, w, h, ox, oy]`) instead of verbose repeated JSON object keys (`244 KB` -> `~28 KB`).
3. **Content-Hashed Zone Asset Bundles**:
   - Group creature/prop/audio manifests by **Zone/Biome Pack** (`core-hero`, `biome-meadow`, `biome-mire`, `dungeon-catacombs`), emit content-hashed filenames (`goblin-sheet.8f3a1c.webp`) in `sprite-manifest.json`, and serve `assets/baked/**` with `Cache-Control: public, max-age=31536000, immutable`.

---

### `SCALE-07` (Medium) — Client UI & Modal State Scaling

#### Evidence
[main.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/main.ts#L80-L218) manually wires callbacks between `WorldClient`, `HudRoot`, `MinimapOverlay`, `WorldScene`, `AudioEngine`, and `SettingsMenu`. Adding Phase 9 Safe-Room Stash + Map Pin Editor, Phase 10 Level/Perk Tree + Bounty Board + Floor Countdown Banner, Phase 11 Weather/Terror Vignette, Phase 12 Co-Op Party Frames + Emote Wheel, and Phase 13 System-AI Item Reveal Ceremony into `main.ts` and `hudRoot.ts` will immediately breach the 250-line and 12-file caps.

#### Proposed Fix
Introduce a lightweight, framework-free **Typed Observable Store (`ClientStore<ClientState>`)** + **`ModalRouter`** in `packages/client/src/app/`:
- Each UI feature slice (`ui/map/`, `ui/stash/`, `ui/progression/`, `ui/party/`, `ui/bounties/`) implements `HudModule { mount(root, store, actions): void; sync(state): void; destroy(): void }` and registers its exclusive modal ID (`"inventory" | "stash" | "perks" | "map" | "chest" | "settings"`) with `ModalRouter` so `Escape`, `Tab`, `M`, and mobile back-buttons never conflict.

---

### `SCALE-08` (Medium) — Procedural Worldgen & POI Placement Scaling

#### Evidence
[poiStamper.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/poiStamper.ts#L62-L85) (`isFlatDryFootprint` / `isFlatDryRow`, invoked from `findChunkPoi` at [lines 151–158](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/poiStamper.ts#L151-L158)) evaluates `sampleMacroTerrain` across up to a `26×26` (`676`) tile footprint, where each river check samples a `7×7` (`49`) neighborhood of multi-octave FBM noise (`676 × 49 = 33,124` noise evaluations) synchronously on the server main thread when generating candidate POI chunks.

#### Proposed Fix
1. **5-Point Coarse Rejection Filter First**: Sample only the 4 corners + center of the POI footprint (`5` samples instead of `676`) before running full footprint validation—rejecting `>85%` of river/cliff candidates in `0.2%` of the CPU time.
2. **Region-Level World Graph (`256×256` tile Regions)**: Generate a deterministic `RegionPlan` once per `8×8`-chunk region that assigns guaranteed locations for Safe-Room Hubs (Phase 9), Floor Boss Arenas / Stairwells (Phase 10), and Dungeon Portals (Phase 11) so critical progression POIs are guaranteed to spawn at fair distances regardless of local slope noise rejections.
