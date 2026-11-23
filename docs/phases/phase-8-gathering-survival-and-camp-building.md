# Phase 8 — Resource Gathering, Light Survival, Camp Building & Persistent Deltas

> **Status**: 🚧 Pass 1 Landed (`98a4f883`) — **Pass 2 Spec & Completion Pending**
> **Primary Touchpoints**:
> `@dc2d/content` (`src/items/catalog.ts`, `src/recipes/recipes.ts`),
> `@dc2d/engine` (`src/survival/harvestRules.ts`, `src/survival/campBuilding.ts`, `src/survival/survivalBuffs.ts`, `src/survival/worldDeltas.ts`, `src/world/chunkGenerator.ts`),
> `@dc2d/game-server` (`src/sim/survival/`, `src/net/wsServer.ts`),
> `@dc2d/client` (`src/render/survival/`, `src/render/world/chunkProps.ts`, `src/ui/hud/`, `src/ui/panels/craftingPanel.ts`, `src/ui/panels/mapModal.ts`, `src/net/worldClient.ts`)

---

## 1. Player Fantasy & Story Walkthrough

Venturing out from the Spawn Glade into dense oak woods and craggy granite highlands feels grounded and physical:
- Equipping your **Woodcutter Axe** (`CHOP` on mobile) and swinging into a towering Oak makes the tree visibly **shudder**, raining bark splinters and green leaves while a crisp chopping sound rings out; two heavy chops notch the trunk and fell it away from you into a **Stump**, scattering **Wood** bundles across the moss.
- Passing a bright cluster of crimson berry bushes, you either tap `[E]` / tap the bush to forage effortlessly by hand or swipe through wildflowers cleanly, watching bushes strip visibly bare while regenerating later.
- Scaling the rocky cliff stairways reveals gleaming seams of **Copper Ore** and **Iron Ore** jutting from dark granite boulders. Swinging a Sword clangs harmlessly off an ore seam with a crisp spark + `"Requires Pickaxe!"` callout, whereas slamming a **Stone Pickaxe** rains amber copper flecks or bright silver iron sparks until the seam shatters into raw ore chunks.
- Carrying fresh timber, ore, meat, and herbs back to a riverside clearing, you select **Campfire Kit**, **Workbench**, **Camp Bed**, **Storage Chest**, or **Wooden Palisade** in your hotbar. Immediately, a crisp **translucent green/red Placement Ghost** snaps cleanly under your cursor (or forward aim-pad on mobile with drag-and-confirm), showing valid ground, light radius rings, and adjacent palisade snapping.
- Lighting the **Campfire** and standing beside its warm glow fills an amber **Warming Up (`5s`)** ring before unlocking a rich hearth **Rested** buff icon (`+HP & Stamina Regen`). Cooking **Raw Meat**, brewing **Herbal Tea**, or smelting **Copper & Iron Ingots** at the fire feeds right into the newly functional **Workbench**, where hitting `[E]` unlocks rugged **Copper Tools**, **Spears**, **Daggers**, **Iron Greatswords**, and fortified camp gear.
- Claiming your **Camp Bed** chimes softly, pins a glowing **Home Bed** marker onto the `[M]` **Overworld Map**, and re-anchors your personal respawn point—while any structure placed in the wrong spot can be cleanly **dismantled for a 100% material refund**, and everything persists intact across server restarts AND local offline browser refreshes.

---

## 2. Pass-1 Audit (What Exists vs What Is Half-Baked)

| Area | What Exists in Pass 1 (`98a4f883`) | Pass-2 Gaps to Fix |
| :--- | :--- | :--- |
| **Gathering Feedback** | `HARVEST_NODE_SPECS` + `ResourceHarvester` deduct prop HP, spawn square chip particles (`HarvestFxLayer`), replace felled trees with `Stump`, and regrow later. | **Static Props on Hit**: Struck trees/rocks do not shake, flash, crack, or tip when felled; no diegetic node HP indicator during active chopping; wrong-tool hits on Copper/Iron emit a generic `arrowRicochet` spark with zero `"Requires Pickaxe!"` guidance text; bushes look identical before/after foraging and lack `[E]` / tap-to-forage UX. |
| **Placement UX & Dismantling** | Selecting a placeable item fires blind placement (`p.x + p.aimX * 1.5, p.y + p.aimY * 1.5`) when clicking Attack; `canPlaceStructure` validates server-side. | **Zero Placement Preview**: Player cannot see *where* a Campfire, Bed, Chest, or Palisade will land, nor why placement failed (`Water`/`Blocked`/`Elevation`); **impossible to dismantle or relocate** any placed structure once built; Palisades don't orient/connect cleanly or absorb enemy/boar hits. |
| **Workbench (`PropKind.Workbench`)** | Craftable (`6 wood + 2 stone`), renders sprite, blocks movement. | **Completely Non-Functional Decorative Box**: Zero recipes declare `requiresWorkbench`, `CombatWorld.handleInteract` never opens Crafting on nearby Workbench, and there is no `[E] Workbench` prompt! |
| **Copper & Iron Ore Utility** | `CopperVein` and `IronVein` spawn in highlands and drop `copper-ore` / `iron-ore`. | **Dead-End Resources**: Neither `copper-ore` nor `iron-ore` is used in ANY recipe in `RECIPE_CATALOG` (`recipes.ts`)! |
| **Campfire, Bed & Chest Prompts** | Pressing `E` binds the nearest Bed blindly if within `2.6` tiles (`bindNearestBed`); Campfires trigger `Rested` after `5s`; Chests open. | No contextual `[E] Cook & Warm`, `[E] Set Respawn`, `[E] Workbench`, or `[E] Forage` world prompts/mobile tap triggers; no `Warming Up 0..5s` progress indicator; placed Beds do not mark the `[M]` Overworld Map! |
| **Survival Buffs & Foods** | `wellFedTimer` and `restedTimer` grant passive regen and render raw uppercase strings (`FED 180s`, `REST 300s`) in `vitalsBar.ts`. | `cooked-meat`, `berry`, and `herb-tea` all collapse into one identical `wellFedTimer` counter (`berry` even overwrites or competes poorly); `healing-salve` acts as instant HP instead of a heal-over-time salve; missing icon badges, tooltips, distinct SFX, and max-HP / stamina-recovery identities. |
| **HD Prop Visuals & Persistence** | `campPropTextures.ts` draws `CopperVein`, `IronVein`, `Workbench`, `Bed`, `WoodChest`. | Sprites use flat rectangles lacking textured woodgrain/fabric/stone depth compared to `hdPropTextures.ts`; `WorldPersistenceStore` persists on game server (`data/world-save.json`), while **local/offline preview mode loses everything on `F5`**, and server process exit needs clean `SIGINT`/`SIGTERM` flush. |

---

## 3. Resource Gathering & Node Feedback Requirements

### 3.1 Physical Hit Feedback, Damage States & Felling
- **Prop Shake & Flash (`chunkProps.ts` / `HarvestFxLayer`)**:
  - When `harvestHit` fires on `(x, y)`, trigger a `0.18s` decaying horizontal/rotational **wobble** (`±2.5px` / `±0.06 rad` impulse biased away from `(dirX, dirY)`) + brief white emissive tint pulse on the matching sprite (`OakTree`, `PineTree`, `Boulder`, `CopperVein`, `IronVein`, `Bush`).
- **Active Node Health & Visual Wear**:
  - Replicate lightweight `harvestHpRatio` on active `harvestHit` events (zero per-tick chunk bloat!): when a player is actively chopping/mining a node, show a sleek subtle **2-second decaying micro progress bar** above the node + subtle **notch/crack overlay** at `<= 50%` HP.
- **Tree Felling & Destruction**:
  - On `harvestBreak` for `OakTree` / `PineTree`: animate a quick **`0.35s` tipping canopy fall** leaning away from the attacker's swing direction with leaf confetti bursts before swapping cleanly into `PropKind.Stump` (which can itself be chopped for `1–2` extra `wood`!).
  - On `harvestBreak` for `Boulder` / `CopperVein` / `IronVein`: shatter into directional stone/metal shard arcs + expanding dust puff.
- **Audio Distinction (`audioEngine` / `synthSfx`)**:
  - Wood: crisp resonant hollow *thock* per swing + creaking crackle/thump on tree fall.
  - Stone: sharp flinty *chink* + crumbling gravel burst on break.
  - Copper/Iron Veins: bright high metallic *ting!* resonance distinguishing rich ore seams from plain grey boulders.
  - Forage (`Bush` / `Wildflower`): soft leafy rustle & snappy stem pluck.

### 3.2 Clear Tool Gating, Interaction Prompts & Foraging
- **Tool Feedback & Item Drops**:
  - Swinging non-pickaxe gear (Sword, Axe, Fist) at `CopperVein` or `IronVein` bounces harmlessly with crisp yellow sparks, dull metallic clink, and floating **`"Requires Pickaxe!"`** text popup (`dmg === 0`).
  - Swinging sub-optimal tools at Trees (`0.25×` speed vs Axe) or Boulders shows a one-time gentle hint (`"Axe chops faster"` / `"Pickaxe mines faster"`) without spamming every hit (`5s` per-client hint cooldown).
  - **Visual Drop Parity**: All harvested drops (`wood`, `stone`, `flint`, `copper-ore`, `iron-ore`, `berry`, `herb`) share Phase 6's revamped ground loot renderer—rendering actual crisp `32×32` outlined pixel-art item icons rather than legacy `4×4` colored squares.
- **Hand Foraging & Interactable Bushes**:
  - `Bush` and `Wildflower` can be gathered either by **swinging** OR by pressing **`[E]` / mobile context tap** (`FORAGE` prompt when standing beside an intact berry bush or herb patch!).
  - **Berry Bush Visual State**: Render ripe crimson berries on untouched `Bush` variants; when picked (`berry` harvested), swap to a stripped leafy bush until regrowth restores the berries cleanly.

### 3.3 Unified HD-Pixel Camp & Ore Prop Art (`campPropTextures.ts`)
Upgrade `CopperVein`, `IronVein`, `Workbench`, `Bed`, `WoodChest`, and `Palisade` to rich `48 px/tile` (`HD_PROP_SCALE = 1 / 3`) shaded pixel art matching `hdPropTextures.ts` quality:
- Beveled shaded granite chunks with faceted glinting **amber-teal oxidized Copper** crystals and **bright steel-blue Iron** bands (`IronVein` / `CopperVein`).
- Multi-toned timber **Workbench** with visible plank joinery, iron vise, saw/hammer/blueprints on top, and cross-braced legs.
- Framed **Camp Bed** with stitched wool blanket fold, plump pillow, and notched timber posts.
- Iron-banded **Storage Chest** (supporting `closed` vs `open` lid parity with POI chests!) and sharpened **Timber Palisade** posts with rope lashings and neighbor-connecting horizontal rails.

---

## 4. Valheim-Lite Camp Building & Structure Interactions

### 4.1 Live Placement Ghost Preview (Desktop & Mobile)
Whenever the player's selected hotbar item has `placeStructure`:
- **Desktop**: Show a translucent **Placement Ghost** in world-space snapped cleanly to `0.5`-tile increments under the mouse cursor (clamped to valid build reach `0.8..3.6` tiles on the player's current elevation, defaulting straight ahead if cursor hasn't moved). Pressing Left-Click places precisely at the ghost's validated coordinates! Pressing **`[R]`** rotates directional structures (`bed`, `palisade`).
- **Mobile**: Hold-and-drag on the world OR tap `PLACE` in `MobileCombatControls`:
  - Selecting a placeable item shows the ghost `1.5` tiles in front of the player's facing vector (adjustable by tapping/dragging on the nearby tile ground!).
  - Tapping **`PLACE`** builds cleanly at the preview spot.
- **Validity Highlight & Reason**:
  - **Emerald Green Ghost** (`alpha: 0.65`) + faint dashed radius ring (light radius for `campfire`/`standing-torch`, comfort/crafting aura for `campfire`/`workbench`) when `canPlaceStructure === true`.
  - **Crimson Red Ghost** + compact label (`"Blocked"`, `"Deep/Shallow Water"`, `"Wrong Elevation"`, `"Too Far"`) when invalid—never confusingly swallowing clicks.

### 4.2 Dismantling & Relocation (100% Material Refund)
No structure should be an irreversible mistake:
- Standing beside any placed structure (`campfire`, `standing-torch`, `workbench`, `camp-bed`, `wood-palisade`, or an **empty** `wood-chest`) and holding **`[X]` / `Hold-Interact`** or clicking the **`Dismantle`** action button (`hammer/deconstruct` icon in mobile context / desktop `[Backquote]` or `[Z]` or Hold `[E] 0.6s`) cleanly breaks down the structure (`ClientMessage: "dismantleStructure"`), plays a wood/stone unbuild *clack* + dust puff, and refunds **`100%`** of its recipe ingredients directly into inventory (or ground drops if backpack is full)!
- Non-empty `wood-chest` gently prompts `"Empty chest before dismantling"` (`dismantle` blocked cleanly so loot is never accidentally deleted).
- **Co-op Rule**: Any player in Sanctuary/co-op can dismantle their own structures (`ownerName`), or any unowned camp obstacle older/abandoned if allowed; Palisades also take enemy/Boar collision hits (`hp = 80`) and can be repaired cleanly or rebuilt.

### 4.3 Interactive Camp Stations & Prompts
Unified world-interact priority (`combatSim.handleInteract` + `main.ts` contextual `[E]` / tap target):
1. **Storage Chest (`PropKind.WoodChest`)**: Opens 27-slot Chest modal (`[E] Open Chest`, tap on mobile, lid opens visually).
2. **Workbench (`PropKind.Workbench`)**: Shows **`[E] Craft (Workbench)`** prompt within `2.4` tiles; pressing `[E]` / tapping opens the Crafting modal (`CraftingPanel`) with **`nearWorkbench = true`**, displaying & prioritizing Workbench recipes cleanly!
3. **Campfire (`PropKind.Campfire`)**:
   - Shows **`[E] Cook & Smelt`** prompt within `2.4` tiles; opens Crafting modal filtered/sorted to Campfire cooking & ingot smelting!
   - Standing within `4.5` tiles displays a subtle golden **`Warming (3s...)`** progress glow on the buff tray that chimes and blooms **`RESTED (5m)`** once `hearthWarmSec >= 5.0s`, resetting cleanly if interrupted by combat hits? Warmth resumes smoothly once back at fire!
4. **Camp Bed (`PropKind.Bed`)**: Shows **`[E] Set Respawn Bed`** prompt within `2.4` tiles; pressing `[E]` / tapping binds player's personal respawn, triggers a gentle restorative `+15 HP` out-of-combat rest breath + `"Respawn Set!"` chime & green ring, and **pins a Bed/Home marker onto the `[M]` Overworld Map**!
5. **Palisade (`PropKind.Palisade`)**: Blocks movement cleanly (both players & monsters), stops & wall-stuns charging Boars cleanly, and auto-connects visual fence rails when two palisades are placed within `1.2` tiles orthogonally!

---

## 5. Survival Buffs, Cooking & Early Copper/Iron Progression Loop

### 5.1 Meaningful Copper & Iron Progression Hook (`recipes.ts` & `catalog.ts`)
Give the Copper and Iron veins spawned by Phase 8 genuine gameplay value right now (laying the foundation for Phase 10):
- **Campfire Smelting (`requiresCampfire: true`)**:
  - `copper-ore` (`2`) + `wood` (`1`) -> **`copper-ingot`** (`1`)
  - `iron-ore` (`2`) + `wood` (`1`) -> **`iron-ingot`** (`1`)
- **Workbench Recipes (`requiresWorkbench: true`)**:
  - **Copper Pickaxe** (`copper-pickaxe`): `2 copper-ingot + 2 wood` — faster mining (`harvestPower: 42`, `+18` vs Stone Pickaxe's `28`, plus `damage: 18`).
  - **Copper Axe** (`copper-axe`): `2 copper-ingot + 2 wood` — chops mature trees in 2 swings (`harvestPower: 44`, `damage: 24`).
  - **Flint Dagger** / **Wooden Spear** (`hand` or `workbench`) and **Iron Greatsword** (`3 iron-ingot + 2 wood`, `workbench`) connecting Phase 7's full moveset roster directly to Phase 8 mining!
  - **Storage Chest**, **Camp Bed**, **Copper/Iron-Trimmed Reinforced Shield** (`workbench`: `82%` block mitigation!), moving higher-tier gear construction cleanly to the player's crafted base camp rather than crafting heavy workbenches from thin air forever (note: keeping basic tools, bandages, campfires, and simple shelters hand-craftable so players are never soft-locked!).

### 5.2 Distinct Consumables & Buff Tray (`survivalBuffs.ts`, `vitalsBar.ts`)
- Replace tiny text labels (`FED 120s`, `REST 300s`) with crisp **HUD Icon Buff Badges** beside/under the HP bar featuring clear custom SVG/pixel icons, radial/fill timers, and hover/tap tooltip descriptions:
  - **Well-Fed (`cooked-meat` / `berry`)**: Drumstick icon; grants `+1.6 HP/s`, `+10 Stamina/s`, and a **temporary `+15 Max HP`** buffer (`cooked-meat` `240s` major feast vs `berry` `45s` light `+6` stamina snack—so eating a small berry never downgrades or wastes a full roast meal timer!).
  - **Invigorated (`herb-tea`)**: Steaming Leaf Cup icon (`invigoratedTimer`, `180s`): grants **`+16 Stamina/s` regen** and halves post-exhaustion stamina recovery delay, ideal for sprinting expeditions & heavy melee!
  - **Rested (Campfire warmth)**: Cozy Hearth Flame icon (`300s`): grants `+0.9 HP/s` + `+12 Stamina/s` recovery outside active combat.
  - **Herbal Salve (`healing-salve`)**: Field Apothecary HoT healing `+55 HP` over `4.0s` (`hotTimer`) with soft green soothing sparkles—workable even while retreating!
- Add distinct audio cues: crisp *crunch* for Berries, hearty bite for Cooked Meat, warm kettle *sip* for Herbal Tea, herbal *shimmer* for Salve.

---

## 6. Persistent World Deltas & Offline Browser Parity

- **Game Server (`WorldPersistenceStore` in `persistenceStore.ts`)**:
  - Default `WORLD_SAVE_PATH = data/world-save.json` (`NODE_ENV` test isolation via `WORLD_SAVE_PATH=none`).
  - Register `SIGINT` & `SIGTERM` graceful shutdown hooks calling `sim.savePersistenceNow()` alongside timed `10s` debounced atomic `.tmp -> renameSync` flushes so crash/restart never loses built camps, bed bindings, depleted veins, chest contents, or player inventory.
- **Offline / Solo Preview Parity (`worldClient.ts` + localStorage)**:
  - Persist local offline world deltas (`depleted`, `structures`, `beds`, `chests`, `inventory`, `buffTimers`) into a seed-keyed `localStorage` snapshot (`dc2d_offline_world_v1_<seed>`) throttled every `5s` + on `beforeunload` / structure build / chest close!
  - Add a clean **"Reset Local World"** option in Settings/Title Screen so solo testers can start fresh whenever desired.

---

## 7. Acceptance Criteria & Verification Tests

### Unit & Integration Tests (`@dc2d/engine` & `@dc2d/game-server`)
1. **Tool Gating & Ore Smelting Loop**: Non-pickaxe hits on `CopperVein`/`IronVein` return `0` dmg + ricochet/hint; Pickaxe harvests ore -> Campfire smelts `copper-ingot`/`iron-ingot` -> Workbench crafts `copper-pickaxe` (`harvestPower >= 40`) & `iron-greatsword`.
2. **Workbench Proximity Craft Rule**: Attempting to craft a `requiresWorkbench: true` recipe without a placed `Workbench` within `2.8` tiles fails cleanly; placing one and standing near it succeeds and consumes ingredients.
3. **Placement Validation & 100% Dismantle Refund**: Placing structures checks elevation, water, distance, and collider clearance; dismantling an owner-placed `workbench` or `camp-bed` removes it from `cache` + `structures` and refunds exact crafting materials (while dismantling non-empty `wood-chest` is safely rejected).
4. **Bed Respawn, Map Marker & Buff Stacking**: Claiming `camp-bed` survives roundtrip `WorldPersistenceStore.saveNow()` -> `load()`, returns `respawnPointFor(player)` across simulated server restart, and surfaces bed coordinates to map snapshots; eating `cooked-meat` raises effective `maxHp` and isn't clobbered by shorter `berry` snacks.
5. **Client / Offline Persistence**: Offline simulation snapshot serialization/deserialization preserves depleted nodes, placed structures, chests, and bed bindings cleanly across reload.

### Playtest Sign-Off Checklist (PC & Mobile)
- [ ] Chopping trees & mining boulders/ore shakes nodes visibly, shows wear/HP progress, topples felled trees into stumps, and warns cleanly when hitting ore without a Pickaxe.
- [ ] Selecting any structure previews an accurate green/red placement ghost (with light/craft aura rings and `[R]` rotation on PC / drag-place on mobile), and placed structures can be dismantled cleanly for full refund.
- [ ] Standing by a Workbench, Campfire, Chest, or Bed surfaces unmistakable `[E]` / mobile tap prompts; Campfire unlocks cooking/smelting & `Rested`, Workbench unlocks Copper tools & Tier-2 weapons, and Bed pins a home marker on the `[M]` map.
- [ ] Placed bases, chest inventories, bed spawn points, and depleted nodes survive both `game-server` restarts AND offline browser `F5` refreshes.
