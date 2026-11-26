# Phase 9 — Fog-of-War Map, Sanctuary Hubs, Gold Economy & Bounties

> **Status**: ✅ Complete (Verified via `npm run verify:phase -- phase-9`)
> **Dependencies**: Phase 8 Pass 2 ✅, Frontier Overhaul (`Phase 8A`) ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Shipped Modules**:
> `@dc2d/content` (`src/hubs/bounties.ts`, `src/hubs/quests.ts`, `src/hubs/merchantCatalog.ts`, `src/items/pricing.ts`),
> `@dc2d/engine` (`src/world/fog/fogOfWar.ts`, `src/world/pois/safeRoomLayout.ts`, `src/inventory/stashOps.ts`, `src/inventory/upgradeOps.ts`, `src/inventory/armorOps.ts`, `src/net/hubSchemas.ts`, `src/net/inventorySchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/hubs/hubCoordinator.ts`, `src/sim/hubs/npcManager.ts`, `src/sim/hubs/bountyTracker.ts`, `src/sim/hubs/stashManager.ts`, `src/net/hubSessionSync.ts`, `src/sim/survival/persistenceStore.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/ui/map/minimapOverlay.ts`, `src/ui/map/fogOverlay.ts`, `src/ui/hubs/`, `src/render/world/npcs/hubNpcOverlay.ts`, `src/render/textures/pois/safeRoomTextures.ts`, `src/net/hubClientBridge.ts`, `src/net/offline/offlineHubs.ts`, `src/net/offlinePersistence.ts`)
> **Folder-Size Guardrails**: `packages/engine/src/world/`, `packages/client/src/ui/hud/`, `packages/client/src/render/textures/`, and `packages/client/src/render/world/` are saturated — place new modules strictly in subfolders (`world/fog/`, `ui/hubs/`, `render/textures/pois/`, `render/world/npcs/`).

*(Phase-Spec Graduated per `AGENTS.md`: architectural details live in colocated `README.md`s next to the shipped modules above; below is the retained `REQ-P9-*` traceability record and exit gate.)*

---

## 1. Scope & Player Experience

Frontier Overhaul already delivered `20` POIs, color-coded `[M]` map pins, and Waystone `?` beacons. Phase 9 transforms exploration and downtime around Safe Rooms:
- **Fog-of-War Explorer's Map**: Unexplored tiles on `[M]` are shrouded in dark parchment fog; walking clears the shroud permanently per player while Waystone `?` beacons and Floor Stairwell hints gleam through unexplored fog, alongside placed Campfires, Home Bed pins, and Safe-Room Hub badges.
- **Floor 1 Sanctuary Hub & Outer Safe Rooms**: Spawn Glade (`r <= 14`) upgrades into a living Sanctuary Town Hub with protective Sanctuary wards, shared crafting hearth & workbench, a **27-slot cross-floor Sanctuary Stash**, and `3` interactive NPCs + a **Bounty Board**. Rare outer **Frontier Safe Rooms** (`safe-room` POI) spawn in Tier II–IV biomes as forward supply outposts.
- **Gold Economy, Upgrades & Bounties**: Monsters, elites, chests, and selling loot award **Gold**. Players spend Gold at the **Merchant** (supplies/arrows/elixirs), **Blacksmith** (prefix reforging & `+1..+3` weapon/armor upgrades), **Floor Guide Mentor** (`>= 4` floor side-quests & directional hints), and **Bounty Board** (`3` rotating bounties with live HUD progress).

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` (`world/fog/fogOfWar.ts`, `inventory/slotModel.ts`, `net/hubSchemas.ts`, `net/protocol.ts`)
- **Fog-of-War Bitset**: Coarse `8×8`-tile cell resolution (`FOG_CELL_TILES = 8`, `16` cells per `32×32` chunk). `FogState` stores `Map<ChunkKey, Uint16Array|number>` (`16`-bit mask per chunk), serialized compactly as RLE/base64 string in snapshots and `PersistedPlayerRecord.fogMask`.
- **SlotItem Upgrade Field**: Extend `SlotItemSchema` with `upgradeLevel: z.number().int().min(1).max(3).optional()`, and `InventorySnapshotSchema` with `armorUpgrades: Partial<Record<ArmorSlotKey, number>>.optional()`. Each `+1` upgrade adds `+15%` base weapon `damage` or `+1` base armor `defense` in `computePlayerGearStats`.
- **Player Economy & Progression Snapshot**:
  - `PlayerSnapshotSchema`: add `gold: z.number().int().nonnegative().optional()` (also in `InventorySnapshotSchema.gold`).
  - `NpcKind`: `"guide" | "merchant" | "blacksmith" | "bounty-board"`.
  - `PoiKind` & `PropKind`: add `"safe-room"` to `PoiKind` (`21` total POIs) and `PropKind.StashChest`, `PropKind.BountyBoard`, `PropKind.NpcGuide`, `PropKind.NpcMerchant`, `PropKind.NpcBlacksmith`.
- **Client/Server Hub Messages (`hubSchemas.ts`)**:
  - Client -> Server: `interactNpc` (`npcId`), `merchantBuy` (`offerId`, `count`), `merchantSell` (`slotIndex`), `blacksmithReforge` (`slotIndex`), `blacksmithUpgrade` (`slotIndex`), `bountyAccept` (`bountyId`), `bountyClaim` (`bountyId`), `questAccept` (`questId`), `questClaim` (`questId`), `stashTransfer` (`from: "stash"|"inv"`, `fromSlot`, `to: "stash"|"inv"`, `toSlot`).
  - Server -> Client: `hubModalState` / snapshot fields (`selfStash?: (SlotItem|null)[27]`, `selfBounties?: ActiveBountyState[]`, `selfQuests?: ActiveQuestState[]`, `selfFogDelta?: FogChunkDelta[]`).

### 2.2 Persistence (`persistenceStore.ts` & `offlinePersistence.ts`)
- `PersistedPlayerRecord`: add `gold: number`, `stashSlots: (SlotItem | null)[]` (length `27`), `fogMask: string`, `activeBounties`, `activeQuests`.
- Mirror identical fields in `dc2d_offline_world_v1_<seed>` for solo/offline preview.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Fog-of-War Overworld Map (`fogOfWar.ts`, `minimapOverlay.ts`)
- **Reveal Radius**: Automatically reveals `8×8`-tile cells within `18` tiles of player position (`22` tiles when standing on `elevation >= 1` during daytime).
- **Fog Mask Rendering**: Unexplored cells render opaque dark parchment ink (`rgba(15, 19, 28, 0.92)`), hiding unvisited terrain and enemies while **still rendering** Waystone-revealed `?` beacons, Floor Stairwell directional hints, Sanctuary Hub icon, and player's own Home Bed pin.
- **Camp & Landmark Pins**: `[M]` map renders player-placed `Campfire`s (orange flame), `Home Bed` (emerald bed icon), `Safe Room` hubs (blue shield icon), and all Frontier POI pins within revealed cells.
- **Performance Guard**: Fog compositing caches onto an offscreen canvas updated only when `fogDelta` arrives or player crosses a tile boundary, maintaining `>= 45 FPS` (no `> 40%` FPS drop while map is open).

### 3.2 Sanctuary Hub, Outer Safe Rooms & Personal Stash
- **Floor 1 Sanctuary Hub (`r <= 14`)**: Upgrades Spawn Glade into a safe paved sanctuary (`inSanctuary: true` blocks all enemy aggro, spawns, and PvP/enemy damage) featuring a central hearth Campfire, shared Workbench, `StashChest`, `BountyBoard`, `Floor Guide`, `Merchant`, and `Blacksmith` NPCs arranged cleanly around clear walkable paths.
- **Outer Safe Rooms (`safe-room`)**: Stamped in Tier II–IV biomes (`1` per `~4×4` macro-cell region outside `r >= 64`) containing `inSanctuary: true`, Hearth, Workbench, `StashChest`, and a `Wayfarer Merchant`.
- **27-Slot Sanctuary Stash**: Per-player bank accessible at any `StashChest` via `[E]` / tap (same drag-and-drop & quick-transfer UX as `ChestModal`), persisted across floor wipes and server restarts.

### 3.3 Gold Currency, Merchant, Blacksmith & Floor Guide
- **Gold Drops & Pricing (`pricing.ts`)**:
  - Enemies drop Gold scaled by `DangerTier` (`3–8` Tier I up to `25–55` Tier IV/V, `3×` for Elites); chests roll bonus Gold pouches.
  - Deterministic `computeItemValue(itemId, prefixId, upgradeLevel)` drives Merchant sell price (`50%` of buy value, minimum `2` Gold) and Blacksmith costs.
- **Merchant UI (`ui/hubs/merchantModal.ts`)**:
  - Fixed stock of essentials (`arrow` bundle, `bandage`, `healing-salve`, `torch`, `swiftness-draught`, `ironbark-tonic`, `copper-pickaxe`, `iron-ingot`) + rotating biome curios.
  - Clicking/tapping `Sell` on bag items transfers item -> adds exact Gold -> updates HUD Gold counter (`>= 1` Gold badge always visible in HUD top-right/inventory).
- **Blacksmith UI (`ui/hubs/blacksmithModal.ts`)**:
  - **Reforge Prefix**: Costs `25 + 15 * rarityRank` Gold (+ `1` `flint` or `copper-ingot`); deterministically rolls a new valid `prefixId` distinct from the current one (preserving `upgradeLevel`).
  - **Upgrade Gear (`+1` to `+3`)**: Costs escalating Gold + `copper-ingot` (`+1`), `iron-ingot` (`+2`), or `sunstone`/`shadow-shard` (`+3`), incrementing `upgradeLevel` and displaying `+N` suffix & green stat preview inside `ItemCardPopover`.
- **Floor Guide Mentor (`>= 4` Side-Quests)**: Offers `>= 4` deterministic Floor 1 side-quests (e.g., *Light the Way*, *Clear the Bandit Camp*, *Attune a Waystone*, *Mine Highland Iron*) with dialogue, progress tracking, and Gold + rare gear rewards.

### 3.4 Bounty Board & HUD Tracker
- **3 Active Bounties**: `BountyBoard` exposes `3` deterministic bounties seeded per floor cycle (covering creature kills, camp/lair clears, and landmark discoveries).
- **Live Tracking & Turn-In**: Accepting a bounty pins a compact collapsible `1–2` line tracker in HUD (`Wolves Culled: 3/5`); completing objectives enables `[Claim]` at the Bounty Board (or auto-notifies `"Bounty Ready — Return to Hub"`), paying Gold + XP (Phase 10 hook) + bonus supplies.

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Insufficient Gold / Full Bag**: `merchantBuy`, `blacksmithReforge`, `blacksmithUpgrade`, and `bountyClaim` validate Gold and empty bag space atomically before deducting currency or items, returning clear toast errors (`"Not enough Gold"`, `"Inventory full"`).
- **Reforge Safety**: Reforging never applies an invalid prefix category (e.g., armor prefix on a sword) and never downgrades `upgradeLevel`.
- **Upgrade Cap**: Attempting to upgrade beyond `+3` is rejected cleanly (`"Maximum upgrade level (+3) reached"`).
- **Stash Isolation**: Two players opening the same `StashChest` simultaneously view and mutate only their own private `27`-slot `Stash` without race conditions or cross-player item leaks.
- **Sanctuary Integrity**: Hostile creatures cannot enter or deal damage inside `r <= 14` Sanctuary Hub or outer `safe-room` radii.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P9-01` | Fog Math | `FogState` tracks `8×8`-tile cells per `32×32` chunk, reveals `18`-tile radius (`22` elevated daytime), and round-trips losslessly through `encodeFogMask` / `decodeFogMask`. | `unit` | `packages/engine/src/world/fog/fogOfWar.test.ts` |
| `REQ-P9-02` | Fog Map UI | `[M]` Overworld Map renders dark fog over unexplored cells while keeping Waystone `?` beacons, Safe-Room icons, and Home Bed pin visible, maintaining `>= 45 FPS` (`<= 40%` FPS drop). | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-9.spec.ts` |
| `REQ-P9-03` | Fog Sync | Server replicates incremental `selfFogDelta` on explore and persists `fogMask` in `PersistedPlayerRecord` across server restart and browser reload. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-04` | Sanctuary Hub | Spawn Glade (`r <= 14`) spawns `NpcGuide`, `NpcMerchant`, `NpcBlacksmith`, `BountyBoard`, `StashChest`, `Campfire`, and `Workbench` with `inSanctuary: true` blocking hostile aggro/damage. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/world/pois/safeRoomLayout.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-05` | Outer Safe Rooms | Outer `safe-room` POIs (`PoiKind`) generate outside `r >= 64` in Tier II–IV biomes with valid walkable layout, hearth, stash access, and `inSanctuary: true`. | `unit`, `static`, `sim` | `packages/engine/src/world/pois/poiCatalog.test.ts`, `scripts/verify/content-integrity.mjs`, `packages/game-server/src/sim/hubs/hubSim.test.ts` |
| `REQ-P9-06` | Sanctuary Stash | `27`-slot personal `StashChest` supports deposit/withdraw/drag-swap, isolates slots strictly per player in multiplayer, and survives server restarts. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/engine/src/inventory/stashOps.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-07` | Gold Currency | Players track authoritative `gold >= 0`, earn Gold from enemy/elite/chest loot, display Gold in HUD & Inventory, and persist Gold across restarts. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-08` | Merchant Buy | `merchantBuy` deducts exact Gold, adds purchased stack/item (failing safely with `"Not enough Gold"` or `"Inventory full"`), and syncs HUD inventory/gold immediately. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-09` | Merchant Sell | `merchantSell` removes target slot item and grants deterministic `computeItemValue` Gold scaling with `rarity`, `prefixId`, and `upgradeLevel`. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/items/pricing.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-10` | Prefix Reforge | `blacksmithReforge` deducts Gold/materials, replaces `prefixId` with a different valid category prefix preserving `upgradeLevel`, and updates `ItemCardPopover` stats. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/inventory/upgradeOps.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-11` | Gear Upgrade | `blacksmithUpgrade` upgrades gear from `+0` up to `+3` max (`+15%` damage or `+1` defense per level in `computePlayerGearStats`) and rejects `+4` safely. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/inventory/gearStats.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-12` | Bounty Board | `BountyBoard` generates `3` deterministic active bounties per floor cycle, increments live kill/clear/discover counters on server ticks, and pays Gold + reward on claim. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/bountyTracker.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-13` | Guide Quests | `NpcGuide` offers `>= 4` deterministic floor side-quests with accept/progress/turn-in states and persistent completion flags. | `unit`, `sim`, `e2e-desktop` | `packages/content/src/hubs/hubCatalog.test.ts`, `packages/game-server/src/sim/hubs/hubSim.test.ts`, `e2e/phase-9.spec.ts` |
| `REQ-P9-14` | Hub Prompts & UI | Approaching NPCs/Bounty Board/Stash within `2.4` tiles displays `[E]`/tap prompts; opening NPC modals works cleanly on `390×844` mobile without clipped buttons. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-9.spec.ts` |
| `REQ-P9-15` | Prop Integrity | All new hub `PropKind`s (`stash-chest`, `bounty-board`, `npc-guide`, `npc-merchant`, `npc-blacksmith`) have valid textures, footprints, and collision specs. | `static`, `unit` | `scripts/verify/content-integrity.mjs`, `packages/client/src/render/textures/pois/safeRoomTextures.test.ts` |
| `REQ-P9-16` | Offline Parity | Solo offline preview supports Fog-of-War, Gold, Merchant, Blacksmith, Bounties, and Stash with persistence across `F5` browser reload. | `e2e-desktop` | `e2e/phase-9.spec.ts` |

---

## 6. Phase Exit Gate

Phase 9 may be marked `✅ Complete` only when `npm run verify:phase -- phase-9` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `16` requirements (`REQ-P9-01`..`REQ-P9-16`) passing.
