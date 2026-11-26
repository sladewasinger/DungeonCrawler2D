# Phase 8 — Gathering Feedback, Workbench Gating, Camp Building UX & Offline Persistence

> **Status**: ✅ Complete (Pass 1 + Pass 2 verified via `npm run verify:phase -- phase-8`)
> **Dependencies**: Phase 7 ✅, Frontier Overhaul (`Phase 8A`) ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Shipped Modules**:
> `@dc2d/content` (`src/items/catalog.ts`, `src/recipes/recipes.ts`, `src/recipes/gearRecipes.ts`),
> `@dc2d/engine` (`src/survival/harvestRules.ts`, `src/survival/campBuilding.ts`, `src/survival/survivalBuffs.ts`, `src/survival/worldDeltas.ts`, `src/net/protocol.ts`, `src/net/worldDeltaSchemas.ts`, `src/net/worldEventSchemas.ts`),
> `@dc2d/game-server` (`src/sim/survival/resourceHarvester.ts`, `src/sim/survival/campStructures.ts`, `src/sim/survival/playerSurvivalState.ts`, `src/sim/survival/worldPersistenceSync.ts`, `src/sim/combatSim.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/render/survival/campPropTextures.ts`, `src/render/survival/harvestFxLayer.ts`, `src/render/survival/placementGhostLayer.ts`, `src/render/survival/propHitVisuals.ts`, `src/render/world/chunkProps.ts`, `src/ui/hud/buffs/`, `src/ui/hud/craftingPanel.ts`, `src/ui/map/minimapOverlay.ts`, `src/net/offlinePersistence.ts`, `src/net/offline/`)

*(Phase-Spec Graduated per `AGENTS.md`: architectural details live in colocated `README.md`s next to the modules above; below is the retained `REQ-P8-*` traceability record and exit gate.)*

---

## 1. Scope & Player Experience

Pass 1 established server-side resource depletion, structure storage, basic `Well-Fed`/`Rested` timers, and JSON disk persistence. Frontier Overhaul (`8A`) already satisfied Copper/Iron ingot smelting, Copper gear items, `32×32` ground loot icons, and server `SIGINT`/`SIGTERM` shutdown flushes.

Pass 2 closes every remaining gathering, crafting-station, camp-building, survival-buff, and offline-persistence gap with strict measurable behavior:
- **Physical Gathering & Foraging**: Hitting trees, boulders, or ore veins shakes the node, displays a decaying micro HP bar and `<= 50%` damage wear, fells trees with a `0.35s` tip-over animation into `Stump`, emits `"Requires Pickaxe!"` when striking ore/crystal without a pickaxe, allows `[E]` / tap foraging of `Bush`/`Wildflower`/`GiantMushroom`/`BogReed`, and renders stripped vs. ripe berry bushes.
- **3-Tier Station Crafting (`Hand` / `Campfire` / `Workbench`)**: Cleanly gates Tier-2+ gear and heavy camp stations behind a placed `Workbench` (`<= 2.8` tiles), keeping basic tools/campfire/workbench hand-craftable and cooking/elixirs/smelting at `Campfire` (`<= 2.8` tiles).
- **Tactile Building & 100% Dismantling**: Live `0.5`-tile snapped emerald/crimson placement ghost with aura rings, explicit invalid-reason badges, `[R]` rotation, mobile drag-place, full-refund dismantling (blocking non-empty chests), and neighbor-connecting damageable `Palisade` walls.
- **Icon Buff Tray & Offline Parity**: Distinct HUD icon badges with timers/tooltips separating `Well-Fed`, `Invigorated`, `Rested`, and `Herbal Salve` HoT, plus seed-keyed `localStorage` offline persistence and a `"Reset Local World"` control.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/content` (`recipes.ts`, `frontierRecipes.ts`)
- Extend `RecipeDef`:
  - `readonly requiresCampfire?: boolean;`
  - `readonly requiresWorkbench?: boolean;`
- **Authoritative 3-Tier Station Split**:
  - **Hand (`!requiresCampfire && !requiresWorkbench`)**: `craft-flint-dagger`, `craft-wooden-spear`, `craft-bow`, `craft-axe`, `craft-pickaxe`, `craft-torch`, `craft-arrows`, `craft-bandage`, `craft-leggings`, `craft-boots`, `craft-wooden-shield`, `craft-campfire`, `craft-standing-torch`, `craft-workbench`.
  - **Campfire (`requiresCampfire: true`)**: `craft-cooked-meat`, `craft-herb-tea`, `craft-healing-salve`, `smelt-copper-ingot`, `smelt-iron-ingot`, `craft-swiftness-draught`, `craft-ironbark-tonic`, `craft-shadow-oil`, `craft-phoenix-salve`.
  - **Workbench (`requiresWorkbench: true`)**: `craft-storage-chest`, `craft-camp-bed`, `craft-wood-palisade`, `craft-iron-greatsword`, and all Tier-2+ Frontier gear (`craft-copper-*`, `craft-bog-dagger`, `craft-amber-recurve-bow`, `craft-frost-hatchet`, `craft-golem-maul`, `craft-shadowfang-spear`, `craft-reinforced-shield`, `craft-runic-buckler`, `craft-moss-stalker-*`, `craft-autumn-ranger-*`, `craft-iron-knight-*`, `craft-shadowsteel-*`).

### 2.2 `@dc2d/engine` (`protocol.ts`, `worldDeltaSchemas.ts`, `worldEventSchemas.ts`, `campBuilding.ts`)
- `InventorySnapshotSchema`: add `nearWorkbench: z.boolean()`.
- `PlacedStructureSchema` & `PlacedStructureRecord`: add `rotation: z.number().int().min(0).max(3).optional()` (default `0`, incremented by `[R]`) and `hp: z.number().optional()` (used by `palisade`, `maxHp = 80`).
- `ClientPlaceStructureSchema`: add `rotation: z.number().int().min(0).max(3).optional()`.
- `ClientDismantleStructureSchema`: `{ t: "dismantleStructure", structureId: string, seq?: number }` added to `ClientMessageSchema`.
- `PlayerSnapshotSchema`: add:
  - `invigoratedTimer: z.number().optional()`
  - `hotTimer: z.number().optional()`
  - `hearthWarmProgress: z.number().min(0).max(1).optional()`
  - `respawnBedPos: z.object({ x: z.number(), y: z.number() }).optional()`
- `WorldEventSchema`: add `"dismantleStructure"` to `WORLD_EVENT_KINDS`, plus `hpRatio?: z.number().min(0).max(1)` on `harvestHit` and `reason?: string` for tool/craft hints.

### 2.3 `@dc2d/game-server` & Offline `localStorage` Persistence
- `PersistedPlayerRecord`: add `invigoratedTimer?: number` and `hotTimer?: number`.
- Offline local preview (`packages/client/src/net/offlinePersistence.ts`):
  - Storage key: `dc2d_offline_world_v1_<worldSeed>`.
  - Stores JSON snapshot `{ version: 1, worldSeed, dayPhase, depleted, structures, beds, chests, player: { x, y, elevation, inventory, wellFedTimer, invigoratedTimer, restedTimer, hotTimer } }`.
  - Flushes throttled every `5_000ms` when dirty, immediately on structure placement/dismantle/bed bind/chest close, and synchronously on `beforeunload`.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Physical Gathering, Foraging & HD Camp Props
- **Hit Wobble & Flash**: On `harvestHit`, the matching prop sprite plays a `0.18s` decaying horizontal/rotational wobble (`±2.5px`, `±0.06 rad` biased away from `(dirX, dirY)`) and a `0.09s` white emissive tint pulse.
- **Active Node HP & Wear**: Replicate `hpRatio` (`0..1`) on `harvestHit`; render a `24×4px` micro HP bar above the node fading out `2.0s` after the last hit, and apply a crack/notch overlay when `hpRatio <= 0.50`.
- **Tree Felling**: On `harvestBreak` for `OakTree`, `PineTree`, `BirchTree`, `MapleTree`, or `DeadTree`, animate a `0.35s` rotation tip-over (`±1.35 rad` away from attacker swing vector) with leaf/bark particles before replacing with `PropKind.Stump`.
- **Tool Gating Feedback**:
  - Hitting `CopperVein`, `IronVein`, or `CursedCrystal` without a pickaxe deals `0` node damage, spawns yellow sparks, plays a dull metallic *clink*, and floats `"Requires Pickaxe!"`.
  - Hitting trees (`requiredTool: "wood"`) without an axe or boulders without a pickaxe shows `"Axe chops faster"` / `"Pickaxe mines faster"` throttled to once per `5.0s` per client.
- **Foraging & Berry Visuals**:
  - `Bush`, `Wildflower`, `GiantMushroom`, and `BogReed` within `2.2` tiles show an `[E] Forage` (desktop) / `FORAGE` (mobile) prompt and harvest cleanly on `[E]` or tap as well as melee swings.
  - Intact `Bush` sprites render crimson berries; harvested bushes flip to a stripped leafy state (`ReplacementKind` or depleted visual override) until regrowth restores berries.
- **Gathering Audio**: Distinct synthesized SFX in `audioEngine` for `wood` (hollow *thock* + felling creak), `stone` (flinty *chink*), `ore` (bright high metallic *ting!*), and `forage` (leafy rustle + snap).
- **HD `48 px/tile` Camp & Ore Art (`campPropTextures.ts`)**: Upgrade `CopperVein`, `IronVein`, `Workbench`, `Bed`, `WoodChest` (with `closed` and `open` lid textures matching POI chests), and `Palisade` (with cardinal neighbor rail auto-connection when orthogonal palisades sit within `1.2` tiles).

### 3.2 Live Placement Ghost, Rotation & 100% Refund Dismantling
- **Placement Validation Function (`validateStructurePlacement` in `campBuilding.ts`)**: Returns `{ ok: true } | { ok: false, reason: "Too Close" | "Too Far" | "Water" | "Wrong Elevation" | "Blocked" }`.
- **Desktop & Mobile Placement Ghost (`placementGhostLayer.ts`)**:
  - Active whenever the selected hotbar item has `placeStructure`.
  - Snaps to `0.5`-tile increments under cursor on desktop (clamped to `0.8..3.6` tiles, defaulting `1.5` tiles ahead) or `1.5` tiles ahead on mobile (adjustable via ground tap/drag).
  - Valid spot renders emerald ghost (`alpha: 0.65`) + dashed light/craft aura radius ring; invalid spot renders crimson ghost + compact rejection label (`reason`).
  - Pressing `[R]` (desktop) or tapping `ROT` (mobile) cycles `rotation` `0..3` for directional structures (`bed`, `palisade`).
- **Dismantling (`dismantleStructure`)**:
  - Standing within `2.4` tiles of a placed structure owned by the player (or any unowned camp structure) allows Hold `[E]` (`0.6s`) / `[Z]` (desktop) or `DISMANTLE` chip (mobile).
  - Removes structure, emits `dismantleStructure` event (dust burst + unbuild *clack*), and refunds `100%` of its recipe ingredients into inventory (overflow drops at player feet).
  - Attempting to dismantle a `wood-chest` containing `>= 1` item fails safely with `"Empty chest before dismantling"`.
- **Palisade Defense**: `Palisade` has `80 HP`, blocks both player and monster movement, triggers `Boar` wall-impact stun (`1.5s` dizzy stars), and takes damage from enemy/boar strikes (`harvestBreak` removes broken palisade).

### 3.3 Station Proximity, Prompts & Bed Home Pin
- Proximity radius is **`2.8` tiles** on the same elevation for both `nearCampfire` and `nearWorkbench`.
- `CraftingPanel` displays a clear station status header (`Hand` / `Campfire` / `Workbench` active badges) and locks/unlocks recipes strictly according to `nearCampfire` and `nearWorkbench`.
- Contextual world prompts (`<= 2.4` tiles): `[E] Open Chest`, `[E] Craft (Workbench)`, `[E] Cook & Smelt`, `[E] Set Respawn Bed`, `[E] Forage`.
- Standing within `4.5` tiles of a lit `Campfire` displays a smooth `Warming (0..5s)` progress indicator before triggering `Rested` (`300s`).
- Binding a `Camp Bed` heals `+15 HP` out-of-combat (`hitTimer <= 0`), sets `respawnBedPos`, emits `bedSet`, and renders a **Home Bed** pin on the `[M]` Overworld Map.

### 3.4 Distinct Survival Buffs, HUD Icon Tray & Offline Reset
- **Buff Separation (`survivalBuffs.ts`)**:
  - `Well-Fed` (`cooked-meat`): `240s`, `+15` temporary `maxHpBonus`, `+1.4 HP/s` out-of-combat, `+8 stamina/s`. Eating `berry` (`45s` light snack, `+6 stamina/s`, `+0` maxHp) **never overwrites** an active `Well-Fed` timer with `> 45s` remaining.
  - `Invigorated` (`herb-tea`): `invigoratedTimer = 180s`, `+16 stamina/s` regen and `0.5×` post-exhaustion stamina recovery delay.
  - `Rested` (`Campfire`): `300s`, `+0.8 HP/s` out-of-combat, `+10 stamina/s`.
  - `Herbal Salve` (`healing-salve`): `hotTimer = 4.0s`, heals `+55 HP` smoothly over `4.0s` (`13.75 HP/s`, works even while moving/retreating).
- **HUD Icon Buff Tray (`ui/hud/buffs/`)**: Replaces raw text pills (`FED 180s`) with `28×28` SVG/pixel icon badges (Drumstick, Steaming Cup, Hearth Flame, Leaf Salve, Shrine icons), radial/arc countdown rings, remaining-seconds badge, and hover/tap tooltip text.
- **Offline World Reset**: Settings modal and Title Screen include a `"Reset Local World"` button (with single-step inline confirmation) clearing `dc2d_offline_world_v1_<seed>` and resetting local offline preview cleanly.

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Non-Empty Chest Guard**: Dismantling a non-empty `wood-chest` never deletes items; server returns no-op and emits `"Empty chest before dismantling"`.
- **Full Inventory Refund**: Dismantling a structure when backpack + hotbar are full places overflow refunded materials onto the ground with `dropLockActive` safety rather than dropping items into the void.
- **Remote Crafting Rejection**: Sending `ClientCraftSchema` for a `requiresWorkbench` recipe without a nearby `Workbench` is rejected authoritatively on the server with `0` consumed ingredients.
- **Co-op Bed Isolation**: Binding a `Camp Bed` updates only the interacting player's `respawnBedPos` and `[M]` Home Bed pin; another player's bed binding is never overwritten.
- **Offline <-> Online Parity**: All 3-tier recipes, placement validation, dismantle refunds, and buff separation work identically in offline local preview (`worldClient`) and online `@dc2d/game-server`.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P8-01` | Station Gating | `RecipeDef` enforces 3-tier split (`Hand`, `requiresCampfire`, `requiresWorkbench`); crafting a `requiresWorkbench` recipe fails with `0` items consumed when no `Workbench` is within `2.8` tiles and succeeds when within `2.8` tiles. | `unit`, `sim`, `static` | `packages/engine/src/inventory/crafting.test.ts`, `packages/game-server/src/sim/survival/survivalSim.test.ts`, `scripts/verify/content-integrity.mjs` |
| `REQ-P8-02` | Station Sync | `InventorySnapshot.nearWorkbench` updates within `1` snapshot tick on entering/leaving `2.8` tiles of a `Workbench`; `CraftingPanel` enables/disables Workbench recipes accurately on Desktop and Mobile. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-03` | Ore Loop | `smelt-copper-ingot` & `smelt-iron-ingot` require `Campfire`; `copper-pickaxe`, `copper-axe`, `iron-greatsword`, `storage-chest`, `camp-bed`, `wood-palisade` require `Workbench`; all recipes reference valid catalog items. | `unit`, `static` | `packages/engine/src/inventory/crafting.test.ts`, `scripts/verify/content-integrity.mjs` |
| `REQ-P8-04` | Gather Feedback | `harvestHit` replicates `hpRatio` (`0..1`), triggers `0.18s` prop wobble/tint flash, shows `<= 2.0s` decaying micro HP bar + `<= 50%` crack state, and plays `0.35s` tree tip-over animation before swapping to `Stump`. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-05` | Tool Gating | Non-pickaxe hits on `CopperVein`/`IronVein`/`CursedCrystal` deal `0` damage and emit `"Requires Pickaxe!"`; wrong-tool hits on trees/boulders throttle tool hints to `>= 5.0s` cooldown. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/survival/survivalRules.test.ts`, `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-06` | Foraging UX | `Bush`, `Wildflower`, `GiantMushroom`, and `BogReed` within `2.2` tiles expose `[E]`/tap forage prompts; harvesting a `Bush` switches it to a stripped berry visual until regrowth. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-07` | Gather Audio | `synthSfx` / `audioEngine` maps distinct synthesis parameters per material family (`wood`, `stone`, `ore`, `forage`) with non-zero audible buffers and `<= 1.0` peak amplitude. | `unit` | `packages/client/src/audio/proceduralSynth.test.ts` |
| `REQ-P8-08` | HD Camp Props | `campPropTextures.ts` generates `48 px/tile` textures for `CopperVein`, `IronVein`, `Workbench`, `Bed`, `WoodChest` (both `closed` and `open` lids), and `Palisade` with non-empty alpha bounds. | `unit`, `static`, `visual` | `packages/client/src/render/survival/campPropTextures.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/phase-8.spec.ts` |
| `REQ-P8-09` | Placement Ghost | Holding any `placeStructure` item renders a `0.5`-tile snapped emerald/crimson ghost (`0.8..3.6` tile reach) with light/craft aura ring, `[R]` rotation `0..3`, and explicit rejection reason (`Water`/`Blocked`/`Wrong Elevation`/`Too Far`). | `unit`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/engine/src/survival/survivalRules.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-10` | Dismantle Refund | `dismantleStructure` removes owner-placed structures and refunds `100%` of recipe ingredients (overflowing safely to ground drops when bag is full). | `sim`, `e2e-desktop` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-11` | Chest Guard | Dismantling a `wood-chest` containing `>= 1` item is rejected with `0` lost items and emits `"Empty chest before dismantling"`; emptying it allows full-refund dismantle. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-12` | Palisades | `Palisade` has `80 HP`, blocks entity movement, stuns charging `Boar`s (`staggerTimer >= 1.4`), breaks at `0 HP`, and auto-connects orthogonal neighbor rails within `1.2` tiles. | `sim`, `unit` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `packages/engine/src/survival/survivalRules.test.ts` |
| `REQ-P8-13` | Station Prompts | Standing `<= 2.4` tiles from `Workbench`, `Campfire`, `WoodChest`, or `Bed` surfaces distinct `[E]`/tap prompts; `Campfire` displays `Warming (0..5s)` progress before granting `Rested` (`300s`). | `e2e-desktop`, `e2e-mobile` | `e2e/phase-8.spec.ts` |
| `REQ-P8-14` | Bed Map Pin | Binding a `Camp Bed` sets `respawnBedPos`, heals `+15 HP` out of combat, respawns the player at the bed on death across server restarts, and draws a Home Bed pin on `[M]` map. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/survival/survivalSim.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-15` | Buff Separation | `cooked-meat` (`Well-Fed` `240s`, `+15` maxHp) is not overwritten by `berry` (`45s`); `herb-tea` sets `invigoratedTimer = 180` (`+16 stam/s`, `0.5×` exhaustion delay); `healing-salve` heals `+55 HP` over `4.0s` HoT (`hotTimer`). | `unit`, `sim` | `packages/engine/src/survival/survivalRules.test.ts`, `packages/game-server/src/sim/survival/survivalSim.test.ts` |
| `REQ-P8-16` | Buff Icon Tray | HUD buff tray renders distinct icon badges (`Well-Fed`, `Invigorated`, `Rested`, `Salve`, shrines) with countdown rings/timers and hover/tap tooltips (zero raw `FED`/`REST` strings). | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-8.spec.ts` |
| `REQ-P8-17` | Offline Save | Offline preview serializes `depleted`, `structures`, `beds`, `chests`, `inventory`, and buff timers under `dc2d_offline_world_v1_<seed>` and restores them identically after browser `F5` reload. | `unit`, `e2e-desktop` | `packages/client/src/net/offlinePersistence.test.ts`, `e2e/phase-8.spec.ts` |
| `REQ-P8-18` | Reset World | Clicking `"Reset Local World"` in Settings or Title Screen clears `dc2d_offline_world_v1_<seed>` after confirmation and restores fresh starter state. | `e2e-desktop`, `e2e-mobile` | `e2e/phase-8.spec.ts` |

---

## 6. Phase Exit Gate

Phase 8 Pass 2 may be marked `✅ Complete` only when `npm run verify:phase -- phase-8` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `18` requirements (`REQ-P8-01`..`REQ-P8-18`) passing across Desktop, Mobile, static audit, and visual entropy checks.
