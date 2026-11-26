# Phase 10 — Crawler Progression, Floor Bosses & DCC Collapse Countdown

> **Status**: 📋 Spec Locked (Ready for Implementation after Phase 9)
> **Dependencies**: Phase 9 ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Primary Touchpoints**:
> `@dc2d/content` (`src/progression/perks.ts`, `src/progression/masteries.ts`, `src/progression/bossSpecs.ts`),
> `@dc2d/engine` (`src/progression/xpRules.ts`, `src/progression/floorClock.ts`, `src/world/pois/stairwellLayout.ts`, `src/net/progressionSchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/progression/xpTracker.ts`, `src/sim/progression/floorTimerSim.ts`, `src/sim/bosses/floorBossAi.ts`, `src/sim/frontier/adminSlashCommands.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/ui/progression/`, `src/ui/hud/boss/bossHealthBar.ts`, `src/ui/hud/collapseTimerHud.ts`, `src/render/world/effects/collapseStormLayer.ts`, `src/render/textures/pois/stairwellTextures.ts`)
> **Folder-Size Guardrails**: `packages/engine/src/world/`, `packages/game-server/src/sim/wildlife/`, and `packages/client/src/ui/hud/` are saturated — place new modules strictly in subfolders (`world/pois/`, `sim/bosses/`, `sim/progression/`, `ui/progression/`, `ui/hud/boss/`, `render/world/effects/`).

---

## 1. Scope & Player Experience

Frontier Overhaul established 5 rarity tiers, 18 prefixes, 45+ items, and 4 biome Danger-Tier elites. Phase 10 adds the **Dungeon Crawler Carl (DCC) Floor Loop** and player progression depth:
- **Crawler XP & Milestone Perk Drafts**: Killing enemies, discovering POIs, completing bounties/quests, and defeating bosses earn Crawler XP (`Lv 1..20`). At milestone levels (`2, 4, 6, 8, 10, 12, 15, 18`), the System presents a **1-of-3 DCC Perk Draft** card choice alongside **4 lightweight passive Mastery counters** (`Combat`, `Stealth`, `Harvesting`, `Exploration`, `Lv 1..5`).
- **DCC Floor Collapse Countdown**: Every floor ticks down a configurable authoritative **Floor Timer** (`1440s` = `3` in-game days by default). Reaching `00:00` unleashes a **60-second Collapse Storm** closing around the Floor Stairwell before floor collapse forces respawn (Softcore keeps cosmetics, Sanctuary Stash, and unlocks while wiping unbanked floor loot; `HARDCORE_MODE=1` wipes character inventory & floor structures).
- **Floor Boss & Sealed Stairwell**: Each floor generates a guarded **Floor Stairwell** (`r = 140..220` tiles on Floor 1) sealed by arcane locks. Slaying the multi-phase **Floor Boss** (**The Ironbound Warden**) — or inserting `3` rare Floor Seal Keystones — unseals the Stairwell so players can `[E] Descend` before collapse.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` (`progression/xpRules.ts`, `progression/floorClock.ts`, `net/progressionSchemas.ts`, `net/protocol.ts`)
- **Crawler Progression State**:
  - `MasteryKind`: `"combat" | "stealth" | "harvesting" | "exploration"`.
  - `xpForNextLevel(level)` = `Math.round(100 * Math.pow(level, 1.45))` (caps at `level = 20`).
  - `PlayerProgressionSnapshot`: `{ level, xp, xpToNext, pendingDraftChoices?: readonly string[], chosenPerks: readonly string[], masteries: Record<MasteryKind, { level: number; xp: number }> }`.
- **Floor Clock State**:
  - `CollapsePhase`: `"active" | "warning" | "storm" | "collapsed"`.
  - `FloorClockSnapshot`: `{ floorNumber: number; remainingSec: number; stormRemainingSec: number; phase: CollapsePhase; hardcore: boolean; stairwellX: number; stairwellY: number; stairwellUnlocked: boolean }`.
  - Add `floorState?: FloorClockSnapshot` and `selfProgression?: PlayerProgressionSnapshot` to `ServerSnapshotSchema`.
  - Add `bossHud?: { id: string; name: string; hp: number; maxHp: number; phase: 1 | 2 }` to `ServerSnapshotSchema` when within `28` tiles of an active Floor Boss.
- **Client Messages**:
  - `ClientPickPerkSchema`: `{ t: "pickPerk", perkId: string, seq?: number }`
  - `ClientDescendStairwellSchema`: `{ t: "descendStairwell", seq?: number }`
  - Admin slash command `/floor set-timer <sec>` and `/floor trigger-collapse` gated strictly by `session.isAdmin` for deterministic QA/E2E testing.
- **Entity & Prop Additions**:
  - `ENTITY_KINDS`: add `"warden-boss"`.
  - `PropKind`: add `StairwellSealed`, `StairwellOpen`, `SealPedestal`.
  - `PoiKind`: add `"floor-stairwell"`.

### 2.2 Persistence (`persistenceStore.ts`)
- `PersistedWorldFile`: add `floorNumber: number`, `floorRemainingSec: number`, `stairwellUnlocked: boolean`, `stairwellPos: { x: number; y: number }`.
- `PersistedPlayerRecord`: add `progression: PlayerProgressionSnapshot` (preserved across Softcore collapses).

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Crawler XP, 1-of-3 Milestone Perk Drafts & 4 Masteries
- **Perk Catalog (`perks.ts`)**: Minimum `18` distinct non-stackable perks across combat, stealth, mobility, stamina, and scavenging (e.g., *Bloodletter*, *Shadow Step*, *Pack Mule*, *Iron Lungs*, *Crit Mastery*, *Pyromaniac*, *Scavenger's Eye*, *Second Wind*). Every perk wires into `computePlayerGearStats` / combat / stealth / harvest math.
- **Milestone Draft UX (`ui/progression/perkDraftModal.ts`)**:
  - Reaching levels `2, 4, 6, 8, 10, 12, 15, 18` queues a deterministic 3-card non-duplicate perk draft in `pendingDraftChoices`.
  - Non-blocking HUD badge (`[P] / Perk Draft Ready!`) opens a 3-card selector (touch-friendly on `390×844` mobile and keyboard `1/2/3` on desktop). Choosing a card sends `pickPerk`, applies stats immediately, and plays a chime.
- **4 Passive Mastery Tracks (`masteries.ts`)**:
  - `combat` (`+3%/lv` melee/bow damage), `stealth` (`-5%/lv` crouch noise & `+10%/lv` backstab bonus), `harvesting` (`+10%/lv` harvest tool power & `+5%/lv` double-drop chance), `exploration` (`+3%/lv` move speed & `+2` tiles/lv Fog-of-War reveal radius). Levels `1..5` displayed cleanly inside Inventory Stats / Character tab.

### 3.2 DCC Floor Collapse Countdown & Softcore/Hardcore Resolution
- **Timer & Warning Tiers (`floorTimerSim.ts`, `collapseTimerHud.ts`)**:
  - `FLOOR_DURATION_SEC` env var (default `1440s` = `3` days; minimum `30s` for tests).
  - Top-center HUD pill displays `FL 1 · MM:SS`. Transitions to amber + subtle screen tremor pulse at `<= 300s`, and crimson pulsing alert + heartbeat tick at `<= 60s`.
- **60-Second Collapse Storm (`00:00`)**:
  - Entering `"storm"` sets `stormRemainingSec = 60`. A visible crimson-violet shrinking storm boundary converges toward `(stairwellX, stairwellY)` (`radius = max(12, 260 * (stormRemainingSec / 60))`).
  - Players outside both the storm safe radius and any `inSanctuary` safe zone take `8` storm damage per second (`collapseStormLayer.ts` vignette + warning).
- **Collapse Resolution**:
  - When `stormRemainingSec === 0`: any player who did not descend through an unlocked Stairwell suffers collapse death.
  - **Softcore (Default, `HARDCORE_MODE !== "1"`)**: Respawns on Floor 1 Sanctuary Hub keeping `appearance`, `Sanctuary Stash`, `chosenPerks`, `masteries`, `crawlerLevel`, and `discoveredPoiKinds`, while clearing unbanked floor inventory (restoring starter kit) and resetting floor `gold = 0` and floor structures.
  - **Hardcore (`HARDCORE_MODE === "1"`)**: Full character inventory, gold, perks, level, stash-on-floor, and world structures reset cleanly to fresh Floor 1 state.

### 3.3 Floor Boss (**The Ironbound Warden**) & Sealed Stairwell
- **Stairwell Generation (`stairwellLayout.ts`)**: Deterministic arena (`radius = 12` tiles) stamped once per floor at `r = 140..220` tiles on Floor 1 (`stairwellUnlocked = false` initially). Waystones & the Floor Guide NPC point players toward the Stairwell quadrant.
- **2-Phase Boss AI (`floorBossAi.ts`)**:
  - **The Ironbound Warden** (`maxHp = 650 * floorNumber`, `isElite: true`, unique giant runic armor sprite):
    - *Phase 1 (`100%..50%` HP)*: Telegraphed wide sweep cleave (`1.0s` windup, locked facing) + seismic ground slam (`3.2`-tile shockwave).
    - *Phase 2 (`< 50%` HP)*: Enrage roar (`1.5s` stagger-immune transition), faster cadence (`0.78×` cooldowns), summons `2` `skeleton` acolytes once, and leaves fiery ground fissures.
  - Top-center **Boss Health Bar** (`bossHealthBar.ts`) renders Boss name, phase indicator, and smooth damage trail whenever within `28` tiles.
- **Unsealing & Descent**:
  - Defeating The Ironbound Warden (or placing `3` `floor-seal-keystone` drops into the `SealPedestal`s) flips `stairwellUnlocked = true`, swaps `StairwellSealed -> StairwellOpen` with golden fanfare banner, and spawns a Boss Relic Chest (`Epic+` guaranteed).
  - Approaching an unlocked Stairwell (`<= 2.4` tiles) shows `[E] Descend to Floor N+1`; activating `descendStairwell` cleanly advances `floorNumber + 1` (carrying inventory, Gold, perks, and resetting the Floor Clock cleanly; connects seamlessly into Phase 11's Floor 2/3 dungeon zones).

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Duplicate Perk Draft Prevention**: `pendingDraftChoices` never offers a perk already in `chosenPerks`, and `pickPerk` rejects any `perkId` not present in `pendingDraftChoices`.
- **Disconnect During Draft**: Unclaimed `pendingDraftChoices` persist in `PersistedPlayerRecord` across disconnects/restarts so players never lose milestone drafts.
- **Sanctuary Storm Shielding**: Players inside Sanctuary Hub during the 60s Collapse Storm avoid storm DoT until `stormRemainingSec === 0` collapse, preventing unfair hub camping damage while still enforcing final floor collapse.
- **Multiplayer Boss Sync**: Boss HP bar, Phase 2 transition, and `stairwellUnlocked` broadcast identically to all players on the floor; XP/Gold credit goes to all engaged participants within `24` tiles.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P10-01` | XP Curve | `xpForNextLevel` computes deterministic `1..20` curve; combat kills, POI discovery, and bounties grant XP and trigger level-up events cleanly. | `unit`, `sim` | `packages/engine/src/progression/xpRules.test.ts`, `packages/game-server/src/sim/progression/progressionSim.test.ts` |
| `REQ-P10-02` | Perk Catalog | `PERK_CATALOG` defines `>= 18` unique perks with non-empty descriptions and measurable stat/effect modifiers wired into `computePlayerGearStats` / combat math. | `unit`, `static` | `packages/content/src/progression/perks.test.ts`, `scripts/verify/content-integrity.mjs` |
| `REQ-P10-03` | Perk Draft UI | Milestone levels (`2,4,6,8,10,12,15,18`) enqueue `3` non-duplicate `pendingDraftChoices`; selecting `1` via Desktop or Mobile modal applies the perk and persists across reload. | `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/game-server/src/sim/progression/progressionSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-04` | Masteries | 4 passive masteries (`combat`, `stealth`, `harvesting`, `exploration`, `Lv 1..5`) advance from gameplay actions and apply exact passive bonuses. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/progression/xpRules.test.ts`, `packages/game-server/src/sim/progression/progressionSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-05` | Floor Clock | `FloorClock` ticks down deterministically from `FLOOR_DURATION_SEC`, displays `FL N · MM:SS` in HUD, turns amber at `<= 300s` and crimson at `<= 60s`. | `unit`, `sim`, `e2e-desktop`, `e2e-mobile` | `packages/engine/src/progression/floorClock.test.ts`, `packages/game-server/src/sim/progression/progressionSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-06` | Collapse Storm | Reaching `00:00` enters `storm` (`60s`), shrinks safe radius toward `(stairwellX, stairwellY)`, and deals `8` storm DoT/s outside safe zones. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/progression/progressionSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-07` | Softcore Wipe | Collapse at `stormRemainingSec === 0` in default Softcore mode keeps `Sanctuary Stash`, `chosenPerks`, `masteries`, and `level`, while clearing unbanked bag/floor `gold` and respawning at Floor 1. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/progression/progressionSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-08` | Hardcore Wipe | Collapse with `HARDCORE_MODE=1` wipes character level, perks, bag, gold, and floor structures cleanly back to Floor 1 starter state. | `sim` | `packages/game-server/src/sim/progression/progressionSim.test.ts` |
| `REQ-P10-09` | Stairwell POI | Deterministic `floor-stairwell` arena stamps at `r = 140..220` tiles on Floor 1 with `stairwellUnlocked: false` and blocks descent while sealed. | `unit`, `sim`, `static` | `packages/engine/src/world/pois/stairwellLayout.test.ts`, `packages/game-server/src/sim/bosses/floorBossSim.test.ts`, `scripts/verify/content-integrity.mjs` |
| `REQ-P10-10` | Boss Phase 1 | `warden-boss` spawns in the Stairwell arena, locks telegraph facing during cleave/slam windups, and renders the top-center `BossHealthBar` within `28` tiles. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/bosses/floorBossSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-11` | Boss Phase 2 | Dropping `warden-boss` below `50%` HP triggers Phase 2 enrage (`0.78×` cooldowns), summons `2` skeleton adds once, and updates boss HUD phase badge. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/bosses/floorBossSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-12` | Stairwell Unlock | Defeating `warden-boss` (or activating `3` `SealPedestal`s) sets `stairwellUnlocked: true`, swaps `StairwellSealed -> StairwellOpen`, and spawns an `Epic+` Boss Relic Chest. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/bosses/floorBossSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-13` | Floor Descent | Interacting `[E]`/tap at an unlocked Stairwell advances `floorNumber + 1`, preserves carried gear/Gold/perks, and resets the floor countdown cleanly. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/bosses/floorBossSim.test.ts`, `e2e/phase-10.spec.ts` |
| `REQ-P10-14` | Boss Integrity | `warden-boss` sprites/animations, `StairwellSealed`, `StairwellOpen`, `SealPedestal`, and `floor-seal-keystone` pass static asset & bounds checks. | `static`, `unit` | `scripts/verify/content-integrity.mjs`, `packages/client/src/render/textures/pois/stairwellTextures.test.ts` |
| `REQ-P10-15` | Admin Floor Cmds | `/floor set-timer <sec>` and `/floor trigger-collapse` work strictly for `session.isAdmin` and are rejected for non-admins. | `sim` | `packages/game-server/src/sim/progression/progressionSim.test.ts` |
| `REQ-P10-16` | Offline Parity | Solo offline preview runs Floor Clock, XP/Perk Drafts, Boss fight, and Stairwell descent identically without server crashes. | `e2e-desktop` | `e2e/phase-10.spec.ts` |

---

## 6. Phase Exit Gate

Phase 10 may be marked `✅ Complete` only when `npm run verify:phase -- phase-10` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `16` requirements (`REQ-P10-01`..`REQ-P10-16`) passing.
