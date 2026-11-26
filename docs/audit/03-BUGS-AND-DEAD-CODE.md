# 03 — Confirmed Bugs, Logic Edge Cases, Unused/Dead Code & Orphaned Assets

> **Scope**: Full static and behavioral audit across `@dc2d/content`, `@dc2d/engine`, `@dc2d/game-server`, `@dc2d/client` (`net`, `input`, `render`, `audio`, `ui`, `sandbox`, `soundStudio`), `packages/client/public/**`, `scripts/`, and `tools/`.
> **Summary**: **26 confirmed/potential bugs (`BUG-01`–`BUG-26`)** and **16 dead-code / orphaned-asset groups (`DEAD-01`–`DEAD-16`)**, including **40.58 MB (93.8%) of unreferenced files** inside `packages/client/public/` currently deployed to S3/CloudFront on every release.

---

## Executive Summary & Severity Matrix

| Category | Critical | High | Medium | Low | Total |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Part 1: Confirmed & Potential Bugs (`BUG-01`–`BUG-26`)** | 4 | 9 | 10 | 3 | **26** |
| **Part 2: Dead Code & Orphaned Assets (`DEAD-01`–`DEAD-16`)** | 1 | 4 | 6 | 5 | **16** |
| **Combined Total** | **5** | **13** | **16** | **8** | **42** |

### Highest-Impact Takeaways
1. **Core RPG Combat & Progression Promises Are Silently Disconnected**: Bows ignore all critical-strike stats and all item/prefix perks (`BUG-01`); `bleed` deals `0` HP damage while `burn` and `poison` ignore item/prefix `perkValue` despite explicit DPS tooltips (`BUG-02`); the `Workbench` item claims to unlock Copper, Iron, and Frontier recipes but `RecipeDef` has no workbench check (`BUG-03`); and upgraded `copper-axe` / `frost-hatchet` / `copper-pickaxe` tools deal the exact same `28` node damage as starter stone tools (`BUG-04`).
2. **Outer-Biome & Sanctuary Rules Were Partially Wired**: `computeDangerTier(_biome, wx, wy)` ignores `_biome`, forcing `autumn-woods` and `misty-bog` within `r = 220..999` to Danger Tier 1 and blocking all `minTier: 2` POIs there (`BUG-07`); Frontier biome props (`MapleTree`, `BirchTree`, `DeadTree`, `GiantMushroom`, `BogReed`, `Boulder`, `CopperVein`, `IronVein`, `CursedObelisk`, etc.) were never added to AI LOS, stealth occlusion, spider cover, web anchors, or arrow collision sets (`BUG-08`); and Friendly Sanctuaries (`Hermit's Hut`, `Tinker's Camp`) are ignored by AI aggro, leashing, PvP checks, and HUD indicators (`BUG-09`).
3. **Client Prediction Drifts From Authoritative Server Math**: `worldPrediction.ts` omits `player.moveSpeedMult` (gear speed modifiers + `+22%` Swiftness buffs) and weapon-weight windup speed tiers (`BUG-16`), causing continuous rubberbanding whenever speed-modifying gear or buffs are active.
4. **93.8% of `packages/client/public/` Is Dead Payload**: `40.58 MB` out of `43.26 MB` in `public/` (74 files — led by 48 raw RPG Maker source PNGs in `public/assets/packs/**` totaling `40.06 MB`, plus `.pxo` editor files, legacy atlases, and prototype PNGs/GIFs) has zero runtime references (`DEAD-01`) yet is uploaded to S3 on every deploy.

---

## Part 1: Confirmed & Potential Bugs (`BUG-01`–`BUG-26`)

### 1.1 Combat, Perks, Harvesting & Progression Bugs

#### `BUG-01` [Critical] — Bows Completely Ignore Crit Chance, Crit Multiplier, and All On-Hit Perks
- **Locations**:
  - [combatSimHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/combatSimHelpers.ts#L215-L231) (`spawnChargedBowArrow`)
  - [projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L101-L113) (`applyWildlifeArrowHit`)
  - [projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L252-L256) (`serializeProjectiles`)
- **Root Cause**:
  - `spawnChargedBowArrow` resolves `heldSlot` only for `staminaCost` and flat `damage`, never calling `resolvePlayerGear`, `rollCritDamage`, or storing attacker perks/crit metadata on `SimProjectile`.
  - `applyWildlifeArrowHit` deals flat `ctx.pr.damage` (plus stealth ambush multiplier) without calling `applyPlayerOnHitPerks`.
  - `serializeProjectiles` hardcodes `element: "none"`, even though `ProjectileSnapshotSchema` defines `"none" | "fire" | "poison"` for elemental arrow trails.
- **Impact**:
  - `Hunter Bow` (`critChance: 0.10`), `Amber Recurve Bow` (`critChance: 0.15`), Epic `Whisperwind Longbow` (`critChance: 0.25, critMult: 1.75`), `Hunter's` prefix (`+10%` crit), `Autumn Ranger` marksman armor (`+16%` total set crit), and `Blazing` / `Venomous` / `Vampiric` / `Serrated` bow prefixes have **zero effect** on ranged attacks.
- **Proposed Fix**:
  - Resolve full `AggregatedPlayerGearStats` (`resolvePlayerGear(p)`) in `spawnChargedBowArrow`, roll crits via `rollCritDamage`, attach `{ isCrit, lifestealRatio, burnDamage, poisonDamage, bleedDamage, element }` onto `SimProjectile`, invoke `applyPlayerOnHitPerks` inside `applyWildlifeArrowHit` (and PvP `hitPlayer`), and populate `ProjectileSnapshot.element` (`"fire"` when `burnDamage > 0`, `"poison"` when `poisonDamage > 0`).

---

#### `BUG-02` [Critical] — `bleed` Perk Deals Zero Damage & `burn`/`poison` Perks Ignore `perkValue` (Contradicting Item Card Tooltips)
- **Locations**:
  - [itemCardCompare.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/itemCard/itemCardCompare.ts#L11-L18) (`PERK_LABELS`)
  - [gearEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/gearEffects.ts#L77-L80) (`applyPlayerOnHitPerks`)
  - [statusEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/statusEffects.ts#L16-L28) (`flushPoisonTicks`) & [statusEffects.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/statusEffects.ts#L90-L107) (`flushBurnTicks`)
  - [statResolver.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/statResolver.ts#L38-L43) (`collectPerks`)
- **Root Cause**:
  1. **Zero-damage `bleed`**: `applyPlayerOnHitPerks` sets `target.bleedTimer = Math.max(target.bleedTimer, 3.5)`, but creature/player/dummy tick loops only decrement `bleedTimer` to spawn cosmetic blood drips — no HP damage is ever subtracted. Meanwhile `PERK_LABELS.bleed` tells players `"Bleed: Inflicts ${v} bleed trauma on hit"`.
  2. **Hardcoded `burn` tick damage**: `flushBurnTicks` hardcodes `MELEE_FEEL_TUNING.burnTickDamage` (`4`), discarding `gear.burnDamage`. Legendary `Sunforged Greatsword` (`perkValue: 6`) and `Blazing` weapons (`perkValue: 5`) deal `4` dmg/tick despite tooltips stating `(6 dmg/tick)` and `(5 dmg/tick)`.
  3. **Hardcoded `poison` tick damage**: `flushPoisonTicks` hardcodes `MELEE_FEEL_TUNING.poisonTickDamage` (`3`), discarding `gear.poisonDamage`. Epic `Venomfang Saber` (`perkValue: 6`), `Bog Venom Dagger` (`perkValue: 4`), and `Venomous` (`perkValue: 4`) all deal `3` dmg/tick.
  4. **Same-perk prefix shadowing**: `collectPerks` checks `if (p.perk && p.perk !== d.perk)`, silently dropping a higher prefix `perkValue` when the base item shares the same perk kind (e.g., `Blazing` `5` on `Torch` `4` stays `4`).
- **Impact**: Multiple Rare/Epic/Legendary weapons (`Iron Halberd`, `Bog Venom Dagger`, `Venomfang Saber`, `Sunforged Greatsword`) and high-tier prefixes (`Serrated`, `Blazing`, `Venomous`) either do nothing or underperform their UI-advertised numbers.
- **Proposed Fix**:
  - Store `burnDamagePerTick`, `poisonDamagePerTick`, and `bleedDamagePerTick` on `BurnableTarget` / `PoisonableTarget` / `BleedableTarget` (taking `Math.max` when refreshed) and tick `bleed` HP damage alongside `burn` and `poison`.
  - In `collectPerks`, merge matching perk kinds via `Math.max(d.perkValue || 1, p.perkValue || 1)`.

---

#### `BUG-03` [High] — Fake Workbench Progression Gate: Copper & Frontier Gear Are Craftable Bare-Handed Anywhere
- **Locations**:
  - [catalog.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/catalog.ts#L162) (`workbench` description)
  - [recipes.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/recipes/recipes.ts#L9-L15) (`RecipeDef`)
  - [frontierRecipes.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/recipes/frontierRecipes.ts#L15-L45) (`FRONTIER_RECIPES`)
  - [crafting.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/inventory/crafting.ts#L65-L86) (`craftRecipeInState`)
- **Root Cause**:
  - `workbench` (`catalog.ts#L162`) states *"Craftsman's bench unlocking copper, iron, and frontier gear recipes"*, and players spend `10 Wood + 4 Stone` to craft and place `PropKind.Workbench`.
  - However, `RecipeDef` and `CraftRecipe` only have `requiresCampfire?: boolean` — there is no `requiresWorkbench` property anywhere in `@dc2d/content`, `@dc2d/engine`, `@dc2d/game-server`, or `CraftingPanel`. Copper weapons/tools, shields, bows, and Moss/Autumn armor sets have no station gate at all, and Iron/Shadowsteel sets only check `requiresCampfire: true`.
- **Impact**: Breaks the survival tech-tree progression loop; placing a `Workbench` has zero gameplay function.
- **Proposed Fix**:
  - Add `requiresWorkbench?: boolean` to `RecipeDef` / `CraftRecipe` and `nearWorkbench?: boolean` to `InventorySnapshot` (computed via `PropKind.Workbench` proximity in `playerInventory.ts`, `clientInventory.ts`, and displayed in `CraftingPanel`), and mark copper, iron, and frontier equipment recipes with `requiresWorkbench: true`.

---

#### `BUG-04` [High] — Tiered Axes & Pickaxes Deal Identical Harvest Node Damage (`28`) to Starter Stone Tools
- **Locations**:
  - [combatSimHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/combatSimHelpers.ts#L190-L193) (`runSwingActivePass`)
  - [weaponMovesets.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/weapons/weaponMovesets.ts#L60-L67) (`WEAPON_MOVESETS.axe` / `pickaxe`)
  - [frontierWeapons.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/frontierWeapons.ts#L14-L28) (`copper-axe`, `copper-pickaxe`, `frost-hatchet`)
- **Root Cause**:
  - `runSwingActivePass` passes `toolPower: sw.moveset.harvestPower`, which is a static constant `28` per weapon archetype (`axe: 28`, `pickaxe: 28`) rather than scaling with the equipped tool's `harvestPower` or `damage`.
- **Impact**:
  - `Copper Axe` (*"Heavy bronze-edged axe built to drop mature timber in fewer swings"*), `Copper Pickaxe` (*"Reinforced mining pick that cracks highland ore seams briskly"*), and Rare `Frostbite Hatchet` take the exact same number of hits to chop trees or mine ore as Tier 0 stone tools.
- **Proposed Fix**:
  - Add explicit `harvestPower?: number` to `ItemDef` (e.g., Stone `28`, Copper `42`, Frostbite/Iron `56`), include it on `PendingMeleeSwing`, and pass `sw.harvestPower` into `harvester.hitHarvestableInSector`.

---

#### `BUG-05` [Low] — Crafting Ingredient Consumption Strips `prefixId` From Partially Consumed Stacks
- **Location**: [crafting.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/inventory/crafting.ts#L31-L41) (`consumeSingleIngredient`)
- **Root Cause**:
  - Line 37 writes `slots[i] = slot.count > take ? { itemId: slot.itemId, count: slot.count - take } : null;` instead of preserving `slot.prefixId` (e.g., via `makeSlotItem` or `{ ...slot, count: slot.count - take }`).
- **Impact**: Currently masked because `prefixGroupsForItem` skips `maxStack > 1`, so stackable materials do not roll prefixes today. As soon as stackable quality materials or prefixed components are added (or granted via admin/loot), crafting will silently wipe their `prefixId`.
- **Proposed Fix**: Replace `{ itemId: slot.itemId, count: slot.count - take }` with `{ ...slot, count: slot.count - take }`.

---

#### `BUG-06` [Medium] — Brittle Substring & Implicit Range Heuristics for Weapon/Prefix Classification
- **Locations**:
  - [prefixes.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/prefixes.ts#L60-L66) (`prefixGroupsForItem`)
  - [catalog.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/catalog.ts#L184-L189) (`isBowItem`)
  - [weaponMovesets.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/weapons/weaponMovesets.ts#L111-L120) (`ITEM_TO_ARCHETYPE` / `resolveWeaponArchetype`)
- **Root Cause**:
  - `prefixes.ts#L61` detects bows via `opts.id.includes("bow")` — any future item with `"bow"` in its ID (`bone-bowl`, `rainbow-cape`, `elbow-guards`, `crossbow`) will falsely roll bow/weapon prefixes, while a bow named `"ash-longshot"` will fail to get `"bow"` prefixes.
  - `catalog.ts#L188` classifies any `category === "weapon"` without `weaponArchetype` and `(def.range ?? 0) > 4` as a bow (consuming arrows and using bow draw). Adding wands, staves, throwing spears, or slings will silently turn them into arrow-shooting bows.
  - `weaponMovesets.ts#L111-L115` hardcodes only 3 legacy IDs (`"flint-dagger"`, `"wooden-spear"`, `"iron-greatsword"`) in `ITEM_TO_ARCHETYPE`; calling `resolvePlayerAttackHitbox` without explicit `itemStats.weaponArchetype` falls back to `"unarmed"` for all 11 Frontier melee weapons.
- **Proposed Fix**: Add `"bow"` directly to `ItemWeaponArchetype` (or add `rangedArchetype?: "bow" | "crossbow" | "wand"` on `ItemDef`) and derive `isBowItem`, `prefixGroupsForItem`, and `resolveWeaponArchetype` strictly from explicit schema fields.

---

### 1.2 World Generation, AI Sensing, Collision & Sanctuary Bugs

#### `BUG-07` [Critical] — `computeDangerTier` Ignores `_biome` Base Danger Tier, Suppressing Tier 2 POIs & Scaling Across Inner Frontier Biomes
- **Location**: [macroBiome.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/biomes/macroBiome.ts#L16-L39)
- **Root Cause**:
  - Lines 16–26 define `BASE_TIERS` (`"autumn-woods": 2`, `"misty-bog": 2`, `"craggy-highlands": 3`, `"cursed-ruinlands": 4`) and `biomeBaseDangerTier(biome)`.
  - Yet lines 37–39 implement:
    ```ts
    export function computeDangerTier(_biome: BiomeKind, wx: number, wy: number): DangerTier {
      return distanceDangerTier(wx, wy);
    }
    ```
    completely ignoring `_biome` (leaving `biomeBaseDangerTier` as a dead function!).
- **Impact**:
  - `sampleMacroBiome` spawns `autumn-woods` and `misty-bog` starting at `SPAWN_SAFE_BIOME_RADIUS = 220` tiles, whereas `TIER_DISTANCES[2]` is `1000` tiles.
  - Throughout the entire `r = 220..999` annulus (~3,000,000 square tiles of Autumn Woods and Misty Bog), `computeDangerTier` returns `1` instead of `2`. Consequently, every `minTier: 2` POI designed for those biomes (`broodmother-hollow`, `orc-totem-ring`, `shrine-shadow`, `sun-dial-ruin`) is **impossible to generate** there, the compass badge displays `Autumn Woods · TI` instead of `TII`, and enemies/chests roll Tier 1 stats and loot.
- **Proposed Fix**:
  - Return `Math.max(biomeBaseDangerTier(biome), distanceDangerTier(wx, wy)) as DangerTier` from `computeDangerTier(biome, wx, wy)` (except inside `r < SPAWN_SAFE_BIOME_RADIUS`, which is already `"verdant-forest"` Tier 1).

---

#### `BUG-08` [High] — Frontier Biome & POI Props Omitted From AI Line-of-Sight, Stealth Cover, Spider Ecology, Webs & Arrow Collisions
- **Locations**:
  - [aiSensing.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/aiSensing.ts#L46-L98) & [aiSensing.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/aiSensing.ts#L225-L234)
  - [stealthRules.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/stealthRules.ts#L48-L78)
  - [creatureBehaviors.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureBehaviors.ts#L7) (`SPIDER_COVER_PROPS`)
  - [webGeometry.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/webs/webGeometry.ts#L24-L26) (`ANCHOR_PROPS`) & [webNetwork.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/webs/webNetwork.ts#L136) (`hasHeatSourceNear`)
  - [projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L37-L38) & [projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L150-L160)
- **Root Cause**:
  - Prop physics/perception traits are scattered across 6 hardcoded `Set<PropKind>` / `switch` tables instead of centralized prop metadata, and Phase 7 Frontier props (`PropKind` values `14..32`) were omitted:
    1. **AI LOS (`aiSensing.ts`)**: `LOS_BLOCKING_PROPS` only contains `Boulder, Palisade, Tent, RuinPillar` (omitting `HermitHut, BrokenCart, GreatStump, SunkenBoat, RunicForge, CursedObelisk, BoneTotem, CopperVein, IronVein, CursedCrystal`). `foliageOcclusionSpec` only checks `Bush, OakTree, PineTree, TallGrass` — so `MapleTree`, `BirchTree`, `DeadTree`, `GiantMushroom`, and `BogReed` provide **zero** sight occlusion! Furthermore, `computePropOcclusion` (`#L84-L98`) and `hasClearChargeLane` (`#L225-L234`) ignore `prop.elevation`, allowing ground-level bushes/trees to occlude cliff-top vision or block boar charges across elevation tiers.
    2. **Stealth (`stealthRules.ts`)**: `COVER_PROPS` omits `BogReed`; `CANOPY_PROPS` omits `MapleTree`, `BirchTree`, `GiantMushroom`; `propLightContrib` only checks `Campfire` and `Torch`, ignoring light-emitting `BrazierLit`, `RunicForge`, `Waystone`, `ShrineAltar`, and `CursedObelisk`.
    3. **Spider Daytime Spawns (`creatureBehaviors.ts#L7` & `worldEcology.ts#L86`)**: `SPIDER_COVER_PROPS` only lists `OakTree, PineTree, Bush, RuinPillar` — in Misty Bog and Autumn Woods during daytime, spiders near `GiantMushroom`, `DeadTree`, `BogReed`, `BirchTree`, or `MapleTree` fail the cover check and get converted into boars!
    4. **Webs (`webGeometry.ts#L24`, `webNetwork.ts#L136`)**: Spiders cannot anchor webs to `BirchTree`, `MapleTree`, `DeadTree`, `GiantMushroom`, or `GreatStump`; `hasHeatSourceNear` only checks `PropKind.Campfire`, ignoring `Torch`, `BrazierLit`, and `RunicForge`.
    5. **Arrow Impacts (`projectileSim.ts#L37-L38`)**: `WOOD_PROPS` (`OakTree, PineTree, Palisade`) and `STONE_PROPS` (`RuinPillar`) omit `Boulder`, `BirchTree`, `MapleTree`, `DeadTree`, `GreatStump`, `CopperVein`, `IronVein`, `CursedCrystal`, `CursedObelisk`, `HermitHut`, etc. — **arrows fly straight through boulders, ore veins, obelisks, and birch/maple trees!**
- **Proposed Fix**:
  - Define a single authoritative `PROP_CATALOG: Readonly<Record<PropKind, PropPhysicsSpec>>` in `@dc2d/engine` (`blocksLos`, `sightOcclusion`, `stealthCover`, `canopyShade`, `lightRadius`, `spiderCover`, `webAnchor`, `projectileMaterial: "none" | "wood" | "stone"`) so TypeScript exhaustiveness forces every new `PropKind` to declare all physical interactions, and filter `computePropOcclusion` / `hasClearChargeLane` by `prop.elevation === queryElevation`.

---

#### `BUG-09` [High] — Friendly POI Sanctuaries (`Hermit's Hut`, `Tinker's Camp`) Ignored by AI Aggro, Leashing, PvP Protection & HUD
- **Locations**:
  - [poiInteractions.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/frontier/poiInteractions.ts#L26-L29) (`isFriendlyOrSpawnSanctuary`)
  - [combatRules.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/combatRules.ts#L57-L59) (`isInSanctuary`)
  - [combatSimHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/combatSimHelpers.ts#L107) (`inSanctuary` snapshot flag)
  - [projectileSim.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/projectileSim.ts#L139) (PvP arrow check)
  - `packages/game-server/src/sim/wildlife/factionTargeting.ts` (`#L79,81,92,106,117`), `tracking/pursuitLoss.ts#L62`, `creatureNavigation.ts#L107`, `combat/playerCombatHits.ts#L104`
- **Root Cause**:
  - `poiCatalog.ts` marks `hermit-hut` and `tinkers-camp` with `isSanctuary: true`, and `poiInteractions.ts` defines `isFriendlyOrSpawnSanctuary(cache, x, y)`.
  - However, `isFriendlyOrSpawnSanctuary` is **only** called in `ecologyHelpers.ts#L143` (nullifying wildlife melee strike damage). All 8 other sanctuary call sites still call `isInSanctuary(x, y)` (which checks `Math.hypot(x - 0.5, y - 0.5) <= 7.5` around world origin only!).
- **Impact**:
  - Inside `Hermit's Hut` and `Tinker's Camp`: (1) enemies still aggro and chase players inside and swing endlessly for `0` damage instead of leashing back; (2) PvP melee and bow attacks deal full lethal damage; and (3) `PlayerSnapshot.inSanctuary` is `false`, so the HUD `"Sanctuary"` badge never appears.
- **Proposed Fix**:
  - Move `isInWorldSanctuary(cache, x, y)` into `@dc2d/engine` (combining origin sanctuary + `poi.isSanctuary` radius) and replace all `isInSanctuary(x, y)` call sites across AI targeting, pursuit loss, navigation, PvP melee/projectiles, and `buildPlayerCombatExtras`.

---

#### `BUG-10` [Medium] — `resolveMovement` Ignores Obstacle Elevation — Cliff-Edge Props Push/Block Actors on Adjacent Elevation Tiers
- **Location**: [collision.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/collision.ts#L240-L242) (`resolveMovement`)
- **Root Cause**:
  - `resolveMovement` collects nearby blocking obstacles via:
    ```ts
    const obstacles = cache.blockingObstaclesNear(query.x, query.y).filter(
      (obs) => Math.abs(obs.x - query.x) <= range && Math.abs(obs.y - query.y) <= range,
    );
    ```
    without filtering `obs.elevation === elevation` (when `!onStairs`). Large-footprint props (`Boulder`, `HermitHut`, `GreatStump`, trees, palisades) placed near a cliff edge extend their collision circle/box across the cliff boundary in 2D `(x, y)` space.
- **Impact**: Players and creatures walking at the base of a cliff (`elevation: 0`) collide with invisible walls projecting from props perched on top of the cliff (`elevation: 1`), and vice versa.
- **Proposed Fix**: Filter `obstacles` in `resolveMovement` (and `canStandAt` / pathfinding obstacle checks) so obstacles only collide when `onStairs || Math.abs(obs.elevation - elevation) === 0`.

---

#### `BUG-11` [Medium] — `WorldDeltaOverlay` `propId` Parsing Maps Negative Coordinates in `[-0.09, 0)` to Chunk `0` Instead of Chunk `-1`
- **Location**: [worldDeltas.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/survival/worldDeltas.ts#L34-L43) (`keyFromPropIdOrPos`)
- **Root Cause**:
  - `biomeProps.ts` encodes `propId` using `Math.round(wx * 10)` and `Math.round(wy * 10)`.
  - For a prop at `wx = -0.04` (which resides in chunk `cx = worldToChunkCoord(Math.floor(-0.04)) = -1`), `Math.round(-0.04 * 10)` produces `-0` (`0`). When `keyFromPropIdOrPos` later parses `px = Number("0")` on `setDepletedProp` / `restoreProp`, `Math.floor(0 / 10)` yields `0` (`cx = 0`) instead of `-1` (`cx = -1`).
- **Impact**: Depleting or regrowing a prop within `0.05` tiles of the negative X or Y axis bumps `chunkRevs` for chunk `0` instead of chunk `-1`, leaving chunk `-1`'s cached mesh/props stale on client and server until unmounted.
- **Proposed Fix**: Store explicit `x` and `y` (or `cx, cy`) on `DepletedPropDelta` (matching `PlacedStructureRecord`) instead of reverse-parsing rounded tenths out of string `propId`s.

---

### 1.3 Persistence, State & Exploit Bugs

#### `BUG-12` [Critical] — Sealed Brazier Vault Bypass via `LootManager.dropFromChest` + Unfiltered Chest Slot Snapshots
- **Locations**:
  - [lootManager.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/lootManager.ts#L78-L89) (`dropFromChest`)
  - `packages/game-server/src/net/snapshotFilter.ts#L96-L102`
- **Root Cause**:
  - While `openChest`, `transferChest`, and `takeAllChest` check `if (!chest || chest.sealed) return false;`, `dropFromChest` (`#L82-L88`) omits the `chest.sealed` check completely!
  - Compounding this, `snapshotFilter.ts` serializes the full `slots` array of every chest within the 42-tile AOI even when `chest.sealed === true`.
- **Impact**: Any client near a sealed `brazier-vault` or `sun-dial-ruin` can inspect all 27 loot slots from WebSocket snapshots and send `{ type: "dropItem", source: "chest", chestId, slotIndex: 0..26 }` packets to pop every Epic/Rare reward onto the ground without lighting a single brazier.
- **Proposed Fix**: Add `if (!chest || chest.sealed) return false;` at line 83 of `lootManager.ts`, and strip `slots` to empty in `snapshotFilter.ts` whenever `chest.sealed === true` (or `!chest.opened`). *(Cross-referenced in `01-SECURITY-AND-EXPLOITS.md`.)*

---

#### `BUG-13` [High] — Depleted Resource `regrowAtSec` Uses Ephemeral Server Uptime Instead of Persisted World Time
- **Locations**:
  - [resourceHarvester.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/resourceHarvester.ts#L85) & [resourceHarvester.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/survival/resourceHarvester.ts#L99-L105)
  - `packages/game-server/src/sim/worldSim.ts#L203` (`timeSec = this.tick / TICK_RATE`)
- **Root Cause**:
  - `ResourceHarvester.applyNodeDamage` stores `regrowAtSec: timeSec + spec.regrowSec` and persists `depleted` to `world-save.json`.
  - However, `WorldSim.tick` is initialized to `0` on every process start and is **not** persisted in `PersistedWorldFile`.
- **Impact**:
  - If a server runs for 48 hours (`timeSec = 172,800`), a player chops an oak tree (`regrowAtSec = 172,980`), and the server restarts or redeploys (`timeSec` resets to `0`), `timeSec < delta.regrowAtSec` remains true for **48 hours** instead of 3 minutes — leaving harvested trees and ore veins permanently stuck as stumps/rubble across restarts.
- **Proposed Fix**: Persist monotonic `worldTick` (or `elapsedWorldSec`) in `PersistedWorldFile` and restore `this.tick` on boot, OR persist `remainingRegrowSec = Math.max(0, delta.regrowAtSec - currentTimeSec)` when saving and reconstruct `regrowAtSec = currentTimeSec + remainingRegrowSec` on load.

---

#### `BUG-14` [Medium] — Tracked Runtime Save File (`packages/game-server/data/world-save.json`) Pollutes Git & Seeds Stale World State
- **Location**: [world-save.json](file:///c:/repos/DungeonCrawler2D/packages/game-server/data/world-save.json)
- **Root Cause**:
  - `packages/game-server/data/world-save.json` is tracked in git rather than ignored. Inspecting its contents reveals stale pre-overhaul artifacts: chunk `(2, 2)` contains **two** POIs (`brazier-vault:2,2` and `hunters-blind:2,2`) in the same chunk, and `cursed-obelisk:4,3` sits at `(144, 112)` inside `SPAWN_SAFE_BIOME_RADIUS = 220` where cursed POIs cannot spawn anymore. Running `npm run dev` locally also mutates this tracked file every 30 seconds.
- **Proposed Fix**: `git rm --cached packages/game-server/data/world-save.json`, add `packages/game-server/data/*.json` to `.gitignore`, and generate fresh state on first boot when the save file is absent.

---

#### `BUG-15` [Medium] — Per-Connection State Leaks & Reconnect Cooldown Bypass in `WorldWebNetwork` and `PoiInteractionManager`
- **Locations**:
  - `packages/game-server/src/sim/webs/webNetwork.ts#L14` (`prevPos = new Map<string, { x: number; y: number }>()`)
  - [poiInteractions.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/frontier/poiInteractions.ts#L48) & [poiInteractions.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/frontier/poiInteractions.ts#L75-L78) (`shrineCooldowns`)
- **Root Cause**:
  - Neither `WorldWebNetwork.prevPos` nor `PoiInteractionManager.shrineCooldowns` is pruned when `WorldSim.removePlayer(id)` runs, accumulating entries indefinitely over server uptime.
  - Furthermore, `shrineCooldowns` keys by ephemeral socket `player.id` (`p-1`, `p-2`, ...) instead of persistent profile key, so refreshing the browser (`F5`) assigns a new `player.id` and immediately bypasses the 120-second `SHRINE_COOLDOWN_SEC` (allowing infinite Vigor full-heals).
- **Proposed Fix**: Key `shrineCooldowns` by normalized persistent profile identity (and prune expired timestamps `readyAt <= simTimeSec`), and delete `prevPos.delete(playerId)` inside `WorldSim.removePlayer`.

---

### 1.4 Client Prediction, UI, Map, Sandbox & Asset Pipeline Bugs

#### `BUG-16` [High] — Client Movement Prediction Omits `moveSpeedMult` & Swing Windup Speed Tiers, Causing Continuous Rubberbanding
- **Locations**:
  - [worldPrediction.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/net/worldPrediction.ts#L109-L134) (`baseActionMultiplier`, `movementMultiplier`)
  - [combatSimHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/combatSimHelpers.ts#L55-L82) (`windupMultForSwing`, `computePlayerMoveMultiplier`)
- **Root Cause**:
  1. **Missing `moveSpeedMult`**: Server `computePlayerMoveMultiplier` multiplies speed by `Math.max(0.65, 1 + gear.moveSpeedMult + swiftBonus)` (up to `+22%` from Wind Shrine / Swiftness Draught, `+12%` from Moss Stalker / Autumn Ranger sets, `+7%` per `Fleet` armor piece, or `-8%` from `Aegis Tower Shield`), and sends `moveSpeedMult` on `PlayerSnapshot` (`#L91`). Client `movementMultiplier` (`worldPrediction.ts#L131-L134`) **completely ignores `player.moveSpeedMult`**!
  2. **Mismatched swing speed**: Client `baseActionMultiplier` (`#L112`) applies flat `m.swing` (`0.55`) across the entire swing, whereas server `windupMultForSwing` (`#L55-L60`) uses `0.85` (light), `0.72` (medium), or `0.58` (heavy) during windup!
  3. **Sprinting threshold mismatch**: `isSprintingPrediction` (`worldPrediction.ts#L210`) checks `opts.mult >= 0.99` without factoring gear penalties (`Heavy` prefix `-3%` or `Aegis Tower Shield` `-8%`).
- **Impact**: Every tick that a player moves while wearing speed-modifying Frontier armor/prefixes, holding a speed-modifying weapon/shield, or under a Swiftness Shrine/Draught blessing, client prediction runs ~10%–45% slower or faster than the server and gets snapped back by `reconcilePredictedPlayer` 20 times per second (visible micro-stutter/rubberbanding).
- **Proposed Fix**: Extract a single pure `computeSharedPlayerMoveMultiplier(state)` into `@dc2d/engine` and call it identically on both server (`combatSimHelpers.ts`) and client (`worldPrediction.ts`), multiplying by `player.moveSpeedMult ?? 1`.

---

#### `BUG-17` [Medium] — Client Bow Charge & Melee Prediction Desync (`bowDrawSpeedMult`, Spear `shieldPoke`, Prefix `staminaCostDelta`, `godMode`)
- **Locations**:
  - [worldPrediction.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/net/worldPrediction.ts#L138-L142) (`resolvePredictedBowCharge`)
  - [localSwingTracker.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/net/localSwingTracker.ts#L26-L32) & [localSwingTracker.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/net/localSwingTracker.ts#L83-L100)
- **Root Cause**:
  1. `resolvePredictedBowCharge` computes `(player.bowCharge ?? 0) + dt / BOW_MAX_CHARGE_SEC` without `bowDrawSpeedMult` (`Whisperwind Longbow` `+35%`, `Amber Recurve Bow` `+20%`, `Hunter's` `+15%`, `Autumn Ranger` `+10%`).
  2. `LocalSwingTracker.startSwing` (`#L95`) never passes `shieldPoke: Boolean(opts.player.blocking) && archetype === "spear"`, so shield-poking with a spear predicts a `0.29s`/`0.33s` combo swing instead of the server's `0.24s` `SPEAR_SHIELD_POKE_STEP`.
  3. `LocalSwingTracker.step` (`#L84-L85`) uses `def?.staminaCost ?? 8` (ignoring `Swift` prefix `staminaCostDelta: -2`) and blocks swings when `stamina < cost` even if `opts.player.godMode` is `true`!
- **Proposed Fix**: Pass resolved held `SlotItem` + `AggregatedPlayerGearStats` into `resolvePredictedBowCharge` and `LocalSwingTracker.step`, include `shieldPoke`, and bypass stamina checks when `player.godMode` is `true`.

---

#### `BUG-18` [High] — Overworld Map `[M]` Zero-Discovery Fallback Glitch & Unfiltered Chest/Enemy/Global-Player Radar
- **Locations**:
  - [mapPinRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/mapPinRenderer.ts#L93-L97) (`drawWindowPoiPins`)
  - [minimapOverlay.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/minimapOverlay.ts#L201-L209) (`drawMarkers`)
- **Root Cause**:
  1. **Vanishing POI pins bug**: `mapPinRenderer.ts#L94-L96` evaluates:
     ```ts
     const show = opts.discovered.size > 0
       ? opts.discovered.has(poi.id)
       : Math.hypot(poi.x - opts.localX, poi.y - opts.localY) <= 36;
     ```
     Before a brand-new player discovers their first POI (`discovered.size === 0`), **all** undiscovered POIs within 36 tiles appear on the map. The moment they step into 1 POI (`discovered.size === 1`), every other nearby POI pin suddenly disappears!
  2. **Wallhack radar**: `minimapOverlay.ts#L201-L209` draws bright yellow dots for **every unopened chest** in the 42-tile AOI (even inside undiscovered POIs), bright red dots for **every live creature** (including concealed ambush spiders and unseen dungeon/forest enemies), and purple dots for **every connected player across the entire world** (because `snapshotFilter.ts` does not AOI-filter `players`, even when crouching/sneaking in PvP!).
- **Proposed Fix**:
  - Remove the `opts.discovered.size === 0` fallback in `mapPinRenderer.ts` so `show = opts.discovered.has(poi.id)` consistently.
  - Only draw POI chest markers for discovered POIs, omit unspotted/concealed hostile entities from the parchment overworld map, and AOI/stealth-filter remote players on both server (`snapshotFilter.ts`) and map UI.

---

#### `BUG-19` [Low] — Map Pin Glyph Renderer Collapses `"star"` Into `"diamond"` and `"dot"` Into `"square"`
- **Location**: [mapPinRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/mapPinRenderer.ts#L8-L16) & [mapPinRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/map/mapPinRenderer.ts#L20-L37) (`drawPinGlyph`)
- **Root Cause**:
  - `CATEGORY_PIN` assigns `lair: { shape: "star" }` and `micro: { shape: "dot" }`.
  - Yet `drawPinGlyph` checks `if (shape === "diamond" || shape === "star")` (drawing the exact same 4-vertex diamond for both) and falls into `else` for both `"square"` and `"dot"` (drawing a `6×6` `fillRect` square for `"dot"`).
- **Proposed Fix**: Render a distinct 5/8-point star or spiked emblem for `"star"` (`lair`) and `ctx.arc(..., 2.5, 0, Math.PI * 2)` for `"dot"` (`micro`).

---

#### `BUG-20` [Low] — Inventory Modal Stats Readout Shows Wrong Unarmed Damage (`8` vs `10`) & Omits Active Swiftness Buffs
- **Locations**:
  - [inventoryModal.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/inventoryModal.ts#L168-L175) (`formatStatRows`)
  - [combatSimHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/combat/combatSimHelpers.ts#L19) (`DEFAULT_MELEE_STATS`)
- **Root Cause**:
  - `inventoryModal.ts#L174` formats `Dmg: ${gear.heldDamage || 8} · Spd: ${Math.round((1 + gear.moveSpeedMult) * 100)}%`, whereas authoritative unarmed damage in `combatSimHelpers.ts#L19` is `10`, and authoritative speed (`player.moveSpeedMult`) includes `+22%` Swiftness Shrine/Draught buffs and the `0.65` minimum floor.
- **Proposed Fix**: Use a shared `UNARMED_BASE_DAMAGE` constant (`10`) from `@dc2d/engine` and display `Math.round((opts.player?.moveSpeedMult ?? Math.max(0.65, 1 + gear.moveSpeedMult)) * 100)%` (also including `moveSpeedMult` in `playerStatsFp` on `#L14-L17`).

---

#### `BUG-21` [Medium] — Asset Sandbox Hardcodes `wooden-shield` Check & Silently No-Ops Crafting/Character Handlers
- **Location**: [sandboxMode.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/sandbox/sandboxMode.ts#L51-L52) & [sandboxMode.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/sandbox/sandboxMode.ts#L141)
- **Root Cause**:
  - Line 141 passes `hasShield: cur.inventory.armor.offhand === "wooden-shield"` instead of `isShieldItem(cur.inventory.armor.offhand)` (unlike `main.ts#L107`), preventing shield blocking when testing `iron-buckler` or `aegis-tower-shield` in `/?sandbox=1`.
  - Lines 51–52 wire `onCraft: () => {}` and `onSetCharacter: () => {}`, so clicking Craft or Hero Appearance options inside the Sandbox HUD appears interactive but silently does nothing.
- **Proposed Fix**: Use `isShieldItem(cur.inventory.armor.offhand)` and `offhandItem: cur.inventory.armor.offhand` in `sandboxMode.ts#L141`, and wire `onCraft` / `onSetCharacter` to `SandboxSim` (already supported via `applyCraftRecipe` and `appearance` state).

---

#### `BUG-22` [High] — Hardcoded `D:/repos/dungeoncrawler2D` Paths Break All Three Sprite-Studio Asset Bakers on Any Other Path/Machine
- **Locations**:
  - [bakeGearAssets.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/bakeGearAssets.mjs#L8-L9) (`GEAR_OUT`, `MANIFEST_PATH`)
  - [bakePlayerAssets.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/bakePlayerAssets.mjs#L7) (`OUT_DIR`)
  - [bakeSpriteSheet.mjs](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/bakeSpriteSheet.mjs#L8-L9) (`DEFAULT_CREATURES_DIR`, `DEFAULT_MANIFEST`)
- **Root Cause**:
  - All three asset bakers hardcode `"D:/repos/dungeoncrawler2D/packages/client/public/assets/..."` instead of resolving paths relative to `import.meta.url` (like `runBake.mjs#L7` and `runPlayerBake.mjs#L7` do).
- **Impact**: Running `npm run sprite:bake -- <creature>` or `npm run player:bake` on any machine where the workspace is cloned anywhere else (such as `c:\repos\DungeonCrawler2D`, macOS/Linux dev machines, or CI runners) either crashes (`ENOENT` reading `D:/...`) or **silently writes baked sprites into a completely different checkout on `D:`** while leaving the active repo's `public/assets/` untouched!
- **Proposed Fix**: Replace all hardcoded `"D:/repos/dungeoncrawler2D/..."` constants with `path.resolve(import.meta.dirname, "../../packages/client/public/assets/...")`.

---

#### `BUG-23` [High] — `CharacterSpriteSet` LRU Eviction Destroys Live GPU Textures Without Incrementing `cacheRevision`
- **Locations**:
  - [characterSprites.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/characterSprites.ts#L124-L131) (`evictOldestIfFull`)
  - [playerSprite.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/playerSprite.ts#L152-L161) (`syncAppearanceSet`)
- **Root Cause**:
  - When `spriteCache.size >= MAX_CACHED_SETS` (`32`), `evictOldestIfFull()` deletes `oldestKey` and immediately calls `destroySpriteSet(evicted)` (`tex.destroy(false)` and `source.destroy()`), **without** incrementing `cacheRevision` (unlike `invalidateCharacterCacheKey` at `#L29-L37`).
  - Meanwhile, any mounted `PlayerView` still rendering `oldestKey` short-circuits in `syncAppearanceSet` (`if (key === this.appearanceKey && rev === this.cacheRev) return;`) and continues binding destroyed PixiJS `Texture` / `TextureSource` instances every frame.
- **Impact**: Seeing or cycling through `>32` distinct appearance + armor combinations corrupts live `PlayerView` sprites (black/missing quads or WebGL texture errors). *(Cross-referenced in `02-PERFORMANCE-AND-MEMORY.md`.)*
- **Proposed Fix**: Reference-count active `CharacterSpriteSet` consumers (evicting only unreferenced entries) AND increment `cacheRevision += 1` whenever an entry is evicted so any live `PlayerView` cleanly rebuilds on its next `sync()`.

---

#### `BUG-24` [Medium] — `"performance"` Quality Preset Disables Water/Wind Uniforms While Leaving PixiJS `Filter.enabled = true`
- **Locations**:
  - [waterFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/waterFilter.ts#L48-L60) (`WaterSurfaceEffect.update`)
  - [foliageWindFilter.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/shaders/foliageWindFilter.ts#L44-L53) (`FoliageWindEffect.update`)
  - [worldScene.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/worldScene.ts#L86-L88) & `#L256-L260`
- **Root Cause**:
  - Selecting the `"performance"` preset sets `preset.waterShader = false` and `preset.windShader = false`, which sets shader uniforms `u.uEnabled = 0` (`waterFilter.ts#L51`) and `u.uWindStrength = 0` (`foliageWindFilter.ts#L47`) — **without** setting `this.filter.enabled = false`.
- **Impact**: PixiJS v8 still allocates full-screen offscreen FBO render textures and executes pass-through fragment shader passes for `waterHost` and `canopyHost` every frame on low-end/mobile devices where the user explicitly turned shaders off. *(Cross-referenced in `02-PERFORMANCE-AND-MEMORY.md`.)*
- **Proposed Fix**: Set `this.filter.enabled = params.enabled;` in `WaterSurfaceEffect.update` and `this.filter.enabled = params.windStrength > 0;` in `FoliageWindEffect.update`.

---

#### `BUG-25` [Medium] — `WorldDeltaOverlay.replaceFromSnapshot` Marks Every Delta Chunk Dirty Globally on Every Single World Delta Broadcast
- **Locations**:
  - [worldDeltas.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/survival/worldDeltas.ts#L149-L186) (`replaceFromSnapshot`)
  - [chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L80) (`syncChunkRow`)
- **Root Cause**:
  - Whenever any single tree is chopped, brazier is lit, or structure is placed anywhere in the world, the server broadcasts a full `WorldDeltaSnapshot`. `replaceFromSnapshot` collects **all** previously and newly modified chunk keys across the entire world into `dirty` and bumps `this.chunkRevs` for every one of them, rather than diffing which chunk's deltas actually changed.
- **Impact**: Every visible chunk containing *any* historical stump, lit brazier, or camp structure unmounts, destroys, and rebuilds all of its WebGL tilemap meshes, cliff strips, and prop sprites whenever *any* unrelated resource node changes elsewhere. *(Cross-referenced in `02-PERFORMANCE-AND-MEMORY.md`.)*
- **Proposed Fix**: Diff per-chunk delta fingerprints inside `replaceFromSnapshot` (or send incremental delta events over WebSocket) and bump `chunkRevs` only for chunks whose effective `depleted` / `structures` / `litBraziers` set actually changed.

---

#### `BUG-26` [Medium] — Web Audio Subgraph Disconnect Leaks (`vocalSynth.ts`, `synthCreatureSfx.ts`) & Uncleaned `200ms` Interval in `TitleScreen`
- **Locations**:
  - [vocalSynth.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/vocalSynth.ts#L158-L172) (`scheduleVocalTrack`)
  - [synthCreatureSfx.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/synthCreatureSfx.ts#L39-L49) (`playSampleOverride`)
  - [titleScreen.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/title/titleScreen.ts#L60-L62) (`window.setInterval`)
- **Root Cause**:
  1. `scheduleVocalTrack` constructs an 11-node formant/oversampled-waveshaper subgraph connected into the persistent `sfxGain` graph via `connectWithPan`, schedules `.stop(...)` on the source nodes, and never attaches `onended` cleanup to `.disconnect()` `envGain` / `tract` (or spatial bus nodes in `AudioEngine.handleWorldEvents`). `playSampleOverride` (`synthCreatureSfx.ts#L39-L49`) likewise omits `onended` disconnect.
  2. `TitleScreen` starts `window.setInterval(..., 200)` in its constructor without storing the interval ID or clearing it in `dismiss()` (only restarting on `reopen()`), leaving a 5 Hz timer running for the entire game session.
- **Proposed Fix**: Attach `rig.carrier.onended = () => { ...disconnect() }` on one-shot Web Audio subgraphs, and start/stop `TitleScreen`'s preview poll interval inside `reopen()` / `dismiss()` (or subscribe to a character-cache event instead of polling). *(Cross-referenced in `02-PERFORMANCE-AND-MEMORY.md`.)*

---

## Part 2: Unused / Dead Code & Orphaned Assets (`DEAD-01`–`DEAD-16`)

### 2.1 Orphaned Public & Tooling Assets

#### `DEAD-01` [Critical] — 40.58 MB (93.8% of `public/`) of Unreferenced Source Packs, Legacy Atlases, `.pxo` Editor Files & Prototype Sprites Shipped to Production
- **Locations**: `packages/client/public/assets/**` (copied verbatim into `packages/client/dist/assets/` by `vite build` and synced to S3/CloudFront by `.github/workflows/deploy-production.yml`).
- **Verification**: Cross-checked every file under `packages/client/public/` against all non-test `.ts`, `.html`, `.webmanifest` files, `sprite-manifest.json`, and `player-rig.json`. Out of `45,356,603` bytes (`43.26 MB`) in `public/`, **`42,546,723` bytes (`40.58 MB` across 74 files = 93.8%) have zero runtime references**:

| Orphaned Path(s) in `packages/client/public/` | Files | Exact Size | Origin / Why It Is Dead |
| :--- | :---: | :---: | :--- |
| `assets/packs/{coc,dragon-cave,dwarf-volcano-underground-fortress,goblin-cave,goblin-mechanical-workshop,haunted-amusement-park,medieval-sewer}/*.png` | 48 | `42,004,414 B` (`40.06 MB`) | Raw RPG Maker / third-party source tileset sheets (`~1 MB` each across 7 pack folders). Terrain is 100% procedurally painted in `terrainTextures.ts`. |
| `assets/atlas.json` + `assets/atlas.png` | 2 | `261,482 B` (`255.4 KB`) | Pre-3D legacy packed texture atlas; zero runtime loaders. |
| `assets/terrain/shared-atlas.png` + `shared-atlas.png.pxo` + `shared-atlas_OLD.png` + `debug-atlas.png` | 4 | `106,303 B` (`103.8 KB`) | Old terrain experiment PNGs + Pixelorama `.pxo` project file + `_OLD` backup. |
| `assets/contact-sheet.png` + `assets/debug-tileset.png` | 2 | `50,157 B` (`49.0 KB`) | Developer contact sheet and debug tileset artifacts. |
| `assets/props/arena-gate.png`, `door.png`, `door.pxo`, `spawn-room-megaphone.png`, `torch.png`, `torch.pxo` | 6 | `45,326 B` (`44.3 KB`) | Early dungeon-room prototype props + 2 Pixelorama `.pxo` source files. |
| `assets/pets/dino-doux.png`, `dino-mort.png`, `dino-tard.png`, `dino-vita.png`, `dungeon-dog.png` | 5 | `38,044 B` (`37.2 KB`) | Unused pet sprites (no pet system exists). |
| `assets/animations.json` | 1 | `14,540 B` (`14.2 KB`) | Legacy animation table superseded by `sprite-manifest.json` and `player-rig.json`. |
| `assets/creatures/boar-idle-south.png` + `assets/creatures/gifs/boar_sprint_{east,south}.gif` | 3 | `12,934 B` (`12.6 KB`) | Leftover PNG (`boar.webp` is used) and 2 preview GIFs baked into `public/`. |
| `assets/fonts/monogram.ttf` | 1 | `10,468 B` (`10.2 KB`) | Unused bitmap TTF font (no `@font-face` or CSS/JS reference anywhere). |
| `assets/particles/particle-atlas.json` + `particle-atlas.png` | 2 | `3,055 B` (`3.0 KB`) | Unused particle atlas (`particleTextures.ts` generates particle textures in canvas). |
| **Total Dead Public Payload** | **74** | **`42,546,723 B` (`40.58 MB`)** | **Only `2.68 MB` (`player/*.webp`, `creatures/*.webp`, `gear/*.webp`, `pois/*.webp`, JSON manifests) is actually used!** |

- **Proposed Fix**:
  - Delete superseded build artifacts (`_OLD.png`, `contact-sheet.png`, `debug-*.png`, `boar-idle-south.png`, `gifs/*.gif`, `atlas.*`, `animations.json`, `particle-atlas.*`).
  - Move any licensed reference packs or `.pxo` source art you wish to keep for offline art reference into a git-ignored or non-deployed top-level `art-sources/` directory outside `packages/client/public/`.

---

#### `DEAD-02` [Medium] — Orphaned `tools/sprite-studio/player_v2.blend` (`2.96 MB`)
- **Location**: [player_v2.blend](file:///c:/repos/DungeonCrawler2D/tools/sprite-studio/player_v2.blend) (`3,031,654` bytes)
- **Verification**: `build_player.py`, `render_player_preview.py`, `runPlayerBake.mjs#L46`, and `PLAYER_EDITING_TUTORIAL.md` all target `player.blend` (`7.47 MB`). `player_v2.blend` has **zero** references in any script or markdown doc.
- **Proposed Fix**: Confirm whether `player_v2.blend` was an abandoned experiment or merged into `player.blend`, then delete `player_v2.blend` (saving `3 MB` in git checkout weight).

---

### 2.2 Dead Source Files, Dead Subsystems & Unused GPU Textures

#### `DEAD-03` [High] — Entire Dead Module `packages/client/src/ui/icons/itemIconSpecs.ts` (`104` Lines, Zero Importers)
- **Location**: [itemIconSpecs.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/icons/itemIconSpecs.ts#L1-L104) (`ITEM_ICON_SPECS`)
- **Verification**: Zero imports across all production and test files. Superseded when `itemIcons.ts` switched from 16×16 `PixelRect` tables to 32×32 procedural canvas icon painters (`campItemIcons.ts`, `weaponItemIcons.ts`, `frontierItemIcons.ts`).
- **Proposed Fix**: Delete `packages/client/src/ui/icons/itemIconSpecs.ts`.

---

#### `DEAD-04` [High] — Dead Creature Loot Table (`CREATURE_SPECS[*].lootDrops`, `LootDropSpec`, and 8 `ITEM_*` Constants)
- **Locations**:
  - [creatureSpecs.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureSpecs.ts#L17-L24) (`ITEM_COOKED_MEAT`, `ITEM_BANDAGE`, `ITEM_ARROW`, `ITEM_FLINT`, `ITEM_STONE`, `ITEM_HERB`, `ITEM_TORCH`, `ITEM_WOOD`)
  - [creatureSpecs.ts](file:///c:/repos/DungeonCrawler2D/packages/game-server/src/sim/wildlife/creatureSpecs.ts#L38-L42) (`LootDropSpec`), `#L62` (`CreatureArchetypeSpec.lootDrops`), and `#L177-L233` (per-creature `lootDrops` arrays)
- **Verification**: `CREATURE_SPECS[kind].lootDrops` is **never read anywhere** (`0` callers). Actual enemy drops are rolled via `spawnScaledEnemyDrops` (`eliteScaling.ts`) -> `rollEnemyDrop` (`@dc2d/content/src/items/lootTables.ts`). Having two conflicting loot definitions in different packages misleads developers and AI agents editing drop rates (e.g., `creatureSpecs.ts` says spiders drop `herb`, while `lootTables.ts` drops `spider-silk` and `venom-gland`!).
- **Proposed Fix**: Delete `LootDropSpec`, `lootDrops` from `CreatureArchetypeSpec` and `CREATURE_SPECS`, and the 8 unused `ITEM_*` constants (`ITEM_RAW_MEAT` is still used by scavenger bait logic).

---

#### `DEAD-05` [High] — Dead Tap-to-Swap Plumbing (`activeTapSource() => null`, `tapSource`, `data-tap-source`) Across 6 HUD Modules
- **Locations**:
  - [slotDragManager.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/slotDragManager.ts#L52) (`activeTapSource(): DragSource | null { return null; }`)
  - [hudRoot.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/hudRoot.ts#L145-L149)
  - [bottomHotbar.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/bottomHotbar.ts#L93-L99) & [bottomHotbar.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/bottomHotbar.ts#L122-L129)
  - [inventoryModal.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/inventoryModal.ts#L22-L32) & [inventoryModal.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/inventoryModal.ts#L104-L135)
  - [chestModal.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/chestModal.ts#L18-L21) & [chestModal.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/chestModal.ts#L91-L120)
  - [slotRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/slotRenderer.ts#L49) & `#L54`, plus dead `[data-tap-source="true"]` CSS rules in `hudStyles.ts`
- **Root Cause**: When slot tapping was redesigned to open the Item Card Popover (`handleTapUp` -> `onInspectItem`), `activeTapSource()` was stubbed to unconditionally return `null`, leaving `tapSource`, `tapFp`, `tapSourceFingerprint`, and `btn.dataset.tapSource = "false"` threaded through 6 HUD files on every frame.
- **Proposed Fix**: Remove `activeTapSource`, `tapSource` parameters, `tapFp`/`tapSourceFingerprint` helpers, and `[data-tap-source]` CSS rules across all 6 HUD modules.

---

#### `DEAD-06` [High] — Dead GPU Textures Baked & Uploaded on Every Client Startup (`makeFallbackKnight`, `makeHdWoodChestTexture`) + Uncalled Fire Bakers
- **Locations**:
  - [fxPropTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/fxPropTextures.ts#L23-L58) (`makeCampfireFrames`, `makeTorchFrames`, `makeFallbackKnight`)
  - [propTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/propTextures.ts#L35) & [propTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/propTextures.ts#L58) (`fallbackKnight: makeFallbackKnight()`)
  - [campPropTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/survival/campPropTextures.ts#L63-L72) & `#L79,L88` (`makeHdWoodChestTexture`, `woodChest`)
  - [chunkProps.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkProps.ts#L78) vs [chunkProps.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkProps.ts#L147) (`if (prop.kind === PropKind.WoodChest) return;`)
  - [poiPropTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/poiPropTextures.ts#L4) & `#L30-L61` (unreachable `makeOutlinedTexture` fallback branches behind `pickPoiOrHdFallback` in `propTextures.ts#L41-L43`)
- **Verification**:
  1. `makeCampfireFrames` and `makeTorchFrames` in `fxPropTextures.ts` have **zero callers** (`propTextures.ts` uses `makeHdCampfireFrames` and `makeHdTorchFrames` from `hdFireTextures.ts`). Meanwhile `makeOutlinedTexture` in `fxPropTextures.ts` is only imported by `poiPropTextures.ts#L4` inside unreachable fallback branches (`#L33, #L43, #L55`) that can never execute because `pickPoiOrHdFallback` only calls `makePalisadeTexture` / `makeTentTexture` / `makeRuinPillarTexture` after confirming `getLoadedSpriteAsset(assetKey)` is truthy!
  2. `makeFallbackKnight()` is called on every boot in `createPropTextureSet()`, allocating a canvas and uploading a WebGL texture stored as `PropTextureSet.fallbackKnight`, which has **zero readers** in the entire codebase!
  3. `makeHdWoodChestTexture()` is called on every boot in `createCampPropTextures()`, uploading `PropTextureSet.woodChest`, and mapped in `PROP_TEX_BY_KIND[PropKind.WoodChest]` (`chunkProps.ts#L78`) — yet `mountChunkProp` (`chunkProps.ts#L147`) returns early on `if (prop.kind === PropKind.WoodChest) return;` before `propTextureFor` is ever reached (because chests are rendered by `WorldPickupsRenderer`)!
- **Proposed Fix**: Strip the unreachable `makeOutlinedTexture` fallback branches and import from `poiPropTextures.ts`, delete `fxPropTextures.ts` completely, remove `fallbackKnight` from `PropTextureSet`, and remove `makeHdWoodChestTexture` / `woodChest` from `campPropTextures.ts` and `chunkProps.ts`.

---

#### `DEAD-07` [Medium] — Legacy Fixed-3-Hit Melee Constants & Helper (`COMBO_WINDOW_SEC`, `COMBO_SWING_SEC`, `COMBO_DAMAGE_MULT`, `comboMultiplier`)
- **Location**: [combatRules.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/combat/combatRules.ts#L23), `#L42-L44`, and `#L61-L64`
- **Verification**: Superseded by per-archetype `WEAPON_MOVESETS` in `weaponMovesets.ts`. `COMBO_WINDOW_SEC` (`0` refs), `COMBO_DAMAGE_MULT` (`0` external refs), and `comboMultiplier` (`0` prod refs, `1` legacy unit test) are dead in production; `COMBO_SWING_SEC` is only used as a legacy fallback denominator when `swingProgress` isn't active.
- **Proposed Fix**: Remove `COMBO_WINDOW_SEC`, `COMBO_DAMAGE_MULT`, `comboMultiplier`, and `COMBAT_TUNING.melee.comboDamageMult`, updating `combatRules.test.ts` to test `WEAPON_MOVESETS` instead.

---

#### `DEAD-08` [Medium] — Duplicate Armor Color System (`ARMOR_VISUAL_STYLES` vs `ItemDef.visualLayer`)
- **Locations**:
  - [palettes.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/character/palettes.ts#L81-L106) (`ARMOR_VISUAL_STYLES`, `getArmorVisualStyle`, `ArmorVisualStyle`)
  - [characterArmorLayers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/characterArmorLayers.ts#L2) & `armRig.ts`
  - `packages/content/src/items/frontierArmor.ts` (`ItemDef.visualLayer.recolorPrimary` / `recolorTrim`)
- **Verification**: All live 3D hero sprites use `ItemDef.visualLayer` (`playerCompositor.ts` -> `armorLayerRecolor.ts`). `ARMOR_VISUAL_STYLES` is **only** consulted by the pre-3D 32×32 rect fallback character renderer (`buildFallbackSpriteSet`), which runs only if `player-rig.json` hasn't loaded (e.g., headless Node unit tests). Every new armor set currently has to be entered in **both** `frontierArmor.ts` (`visualLayer`) and `palettes.ts` (`ARMOR_VISUAL_STYLES`) with slightly different hex values!
- **Proposed Fix**: Derive fallback 2D armor colors directly from `getItemDef(id)?.visualLayer` (or remove the ~400-line legacy 2D rect character builder once tests mock `PlayerRigMeta`).

---

#### `DEAD-09` [Medium] — Unused Outline Preset Switching (`OUTLINE_STYLE_PRESETS.subtle`, `OUTLINE_STYLE_PRESETS.borderlands`, `OutlineStyleId`, `DEFAULT_OUTLINE_STYLE`)
- **Location**: [outlineConfig.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/world/outlineConfig.ts#L3-L22)
- **Verification**: Every consumer across `@dc2d/client` imports only the static constant `ACTIVE_OUTLINE_STYLE` (`bold`). Neither Settings UI nor Sandbox exposes switching `OutlineStyleId`, leaving `subtle`, `borderlands`, `OUTLINE_STYLE_PRESETS`, `DEFAULT_OUTLINE_STYLE`, and `OutlineStyleId` unused outside `outlineConfig.ts`.
- **Proposed Fix**: Either collapse `outlineConfig.ts` to `export const ACTIVE_OUTLINE_STYLE = ...` or wire an Outline Style selector in Sandbox/Settings (note that changing it at runtime would require invalidating cached prop/hero textures).

---

#### `DEAD-10` [Medium] — Unobtainable Legacy `"map"` Item in `ITEM_CATALOG` & Dead Held-Map Plumbing
- **Locations**:
  - [catalog.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/catalog.ts#L120-L123) (`id: "map"`)
  - [hudRoot.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/ui/hud/hudRoot.ts#L157) (`state.localPlayer?.heldItem === "map"`)
  - [prefixes.ts](file:///c:/repos/DungeonCrawler2D/packages/content/src/items/prefixes.ts#L65) (`opts.id !== "map"`)
- **Verification**: Our automated obtainability audit across all **77 catalog items** confirmed that 76/77 items are obtainable via starter loadout, harvesting, crafting, or loot tables — **except `"map"`**, which has **zero** survival acquisition paths! When the Overworld Map was promoted to a permanent `[M]` keybind + HUD hotbar button (`bottomHotbar.ts#L44-L52`), `"map"` was removed from `STARTER_LOADOUT` (`catalog.ts#L177`), stranding `"map"` as a ghost item in `ITEM_CATALOG` whose icon is borrowed by `getItemIconUrl("map")`.
- **Proposed Fix**: Move the parchment map icon into a dedicated UI icon helper (`makeMapUiIconUrl()`), remove `"map"` from `ITEM_CATALOG`, and clean up `heldItem === "map"` (`hudRoot.ts#L157`) and `opts.id !== "map"` (`prefixes.ts#L65`).

---

#### `DEAD-11` [Low] — Unused `_torchTex` Constructor Argument & `torchFrames` Sync Property on `PlayerView`
- **Locations**:
  - [playerSprite.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/playerSprite.ts#L62) (`constructor(_torchTex: Texture, snap: PlayerSnapshot)`) & `#L84` (`readonly torchFrames: readonly Texture[]`)
  - [chunkRenderer.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/world/chunkRenderer.ts#L146) & `#L151`
  - [sandboxMode.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/sandbox/sandboxMode.ts#L150) & `#L152`
- **Verification**: `PlayerView` renders held torches via `getHeldWeaponVisual` -> `getInHandTorchFrames()` (`heldWeapons.ts#L145`) and waist lanterns via `getWaistLanternFrames()`. Neither `_torchTex` nor `input.torchFrames` is ever read inside `PlayerView`.
- **Proposed Fix**: Remove `_torchTex` from `new PlayerView(snap)` and `torchFrames` from `PlayerView.sync(...)`.

---

### 2.3 Dead Exported Functions, Test-Only Exports & Unused Types

#### `DEAD-12` [Low] — Zero-Caller Exported Functions Across `@dc2d/client` and `@dc2d/engine`
Every function below is `export`ed, has `0` external production callers, `0` test callers, and `0` internal calls within its own module (`selfOccurrences === 1`):
- [clientInventory.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/net/clientInventory.ts#L37-L45) — `isNearCampfire(cache, x, y)` (server computes `nearCampfire` authoritatively on `InventorySnapshot`).
- [playerAssets.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/character/playerAssets.ts) — `sampleShoulderSockets` (legacy IK socket helper unused after baked 3D arm animations).
- [poseTuningHelpers.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/poseTuning/poseTuningHelpers.ts#L49-L66) & `#L78-L80` — `computeTunedFreeArm` and `getTunedBowConfig` (unused after switching to 3D hero arms & 3D bow overlay; also renders the corresponding Pose Tuner UI tabs partially disconnected).
- [propTextures.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/propTextures.ts#L68-L71) — `isPoiLoadedTexture`.
- [spriteManifest.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/render/textures/spriteManifest.ts#L164-L166) — `isSpriteManifestLoaded`.
- [frontierPoiLayouts.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/pois/frontierPoiLayouts.ts) — `isFrontierPoiKind`.
- [macroBiome.ts](file:///c:/repos/DungeonCrawler2D/packages/engine/src/world/biomes/macroBiome.ts#L24-L26) — `biomeBaseDangerTier` (dead **because** of `BUG-07` — wire into `computeDangerTier` rather than deleting!).
- **Proposed Fix**: Delete the 7 genuinely obsolete functions and wire `biomeBaseDangerTier` into `computeDangerTier` (`BUG-07`).

---

#### `DEAD-13` [Low] — Production Exports Kept Alive Exclusively by Unit Tests (`prodRefs = 0, testRefs = 1`)
- `packages/client/src/net/actionGate.ts` :: `shouldAcceptServerState` (`0` prod callers, `1` test caller).
- `packages/client/src/render/character/playerRecolor.ts` :: `computeSelOutRgb` (`0` prod callers, `1` test caller).
- `packages/client/src/soundStudio/studioSynth.ts` :: `totalTracksDurationSec` (`0` prod callers, `1` test caller).
- `packages/engine/src/combat/weapons/weaponMovesets.ts` :: `getWeaponMoveset` (`0` prod callers, `1` test caller).
- **Proposed Fix**: Delete unused helpers (`shouldAcceptServerState`, `computeSelOutRgb`, `totalTracksDurationSec`) along with their orphaned unit tests, or keep `getWeaponMoveset` only if designated as part of `@dc2d/engine`'s public SDK.

---

#### `DEAD-14` [Low] — Dead Exported Constants, Dead Schema Types & ~120 Over-Exported Module-Internal Types
- **Completely unreferenced constants/types (`0` internal + `0` external references)**:
  - `packages/client/src/ui/settings/cameraZoom.ts` :: `RELATIVE_ZOOM_STOPS`
  - `packages/client/src/sandbox/sandboxTerrain.ts` :: `SANDBOX_TOTAL_W`
  - `packages/client/src/render/textures/pixelCanvas.ts` :: `OutlineOptions`
  - `packages/engine/src/character/appearance.ts` :: `BodyStyle`, `SkinToneId`, `EyeColorId`, `HairColorId` (`CharacterAppearance` uses `z.infer<typeof CharacterAppearanceSchema>` directly)
  - `packages/engine/src/net/protocol.ts` :: `WebNodeSnapshot`, `WebStrandSnapshot`
- **~120 module-internal `export interface` / `export type` / `export const` declarations** (e.g., `ClientHelloSchema`..`ServerSnapshotSchema` individual sub-schemas in `protocol.ts`, `ToneVoiceLayer`/`SweepVoiceLayer` in `creatureVoiceTypes.ts`, `SceneFrameInput`/`CAMERA_TUNING` in `worldScene.ts`) that are only referenced inside their defining file (`prodRefs = 0, testRefs = 0`).
- **Proposed Fix**: Delete the 9 completely unused constants/types above, and strip `export` from file-private interfaces/constants (automatically surfaced by `knip`).

---

#### `DEAD-15` [Low] — Dead Audio Sample-Override Subsystem (`AudioEngine.preloadSample`, `AmbienceBed.registerSample`, `AmbienceBed.sample`, `playSampleOverride`)
- **Locations**:
  - [audioEngine.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/audioEngine.ts#L39-L49) (`preloadSample`) & `#L97` (`this.bed.sample(...)`)
  - [ambienceBed.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/ambienceBed.ts#L54-L57) (`samples`, `registerSample`, `sample`)
  - [synthCreatureSfx.ts](file:///c:/repos/DungeonCrawler2D/packages/client/src/audio/creatures/synthCreatureSfx.ts#L26), `#L39-L49` (`playSampleOverride`), & `#L103-L106`
- **Verification**: `AudioEngine.preloadSample` has **zero callers** across the entire codebase (and zero `.wav`/`.ogg`/`.mp3` files exist in `public/`), leaving `AmbienceBed.samples` permanently empty and `playSampleOverride` completely unreachable (superseded by procedural synthesis + Sound Studio `localStorage` preset overrides).
- **Proposed Fix**: Remove `preloadSample`, `AmbienceBed.samples` / `registerSample` / `sample`, and `playSampleOverride` / `sampleOverride` until an actual sample asset pipeline is introduced.

---

#### `DEAD-16` [Medium] — Missing Automated Dead-Code, Asset-Reference & Content-Reachability Gates (Systemic Prevention)
- **Root Cause**: ESLint's `@typescript-eslint/no-unused-vars` only checks **intra-file** unused variables — any symbol marked `export` (or any file dropped in `public/assets/` or `src/`) completely bypasses `npm run lint` and `npm run typecheck`. At `<10%` game completion, dead assets (`40.58 MB`) and dead subsystems (`itemIconSpecs.ts`, `lootDrops`, `activeTapSource`) have already accumulated silently.
- **Proposed Fix**:
  1. **Add [`knip`](https://knip.dev/) (`npm run lint:deadcode`)**: Configure workspace entry points (`packages/client/{index.html,sound-studio.html}`, `packages/game-server/src/main.ts`, `scripts/*.mjs`, `tools/**/*.mjs`) so unused files, unused exports, and unused dependencies fail CI deterministically.
  2. **Add `scripts/verify-public-assets.mjs` to CI**: Assert that every file in `packages/client/public/` is either referenced in `sprite-manifest.json`, `player-rig.json`, `manifest.webmanifest`, `index.html`, or an explicit allowlist, and forbid `.pxo`, `.blend`, `.gif`, and `*_OLD.*` extensions inside `public/`.
  3. **Extend existing [content-integrity.mjs](file:///c:/repos/DungeonCrawler2D/scripts/verify/content-integrity.mjs#L30-L45) (`npm run verify:content`) and [contentIntegrity.test.ts](file:///c:/repos/DungeonCrawler2D/tests/integration/contentIntegrity.test.ts)**: Remove the `item.id !== "map"` exemption (`content-integrity.mjs#L42`) and the dead `creatureSpecs.ts` loot source (`#L39`) once `DEAD-04` and `DEAD-10` are cleaned up, and add assertions verifying that every `ItemPerkKind` has an active damage/effect handler in `gearEffects.ts` / `statusEffects.ts` (`BUG-02`) and every `RecipeDef` station requirement has a matching engine check (`BUG-03`). *(Detailed CI loop integration is covered in `06-DETERMINISTIC-RULES-AND-AI-TESTING-LOOP.md`.)*
