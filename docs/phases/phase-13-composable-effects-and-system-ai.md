# Phase 13 — Composable Effects Engine, System-AI Crafting & DCC Reward Boxes

> **Status**: 📋 Spec Locked (Final Release Gate after Phase 12)
> **Dependencies**: Phase 12 ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Primary Touchpoints**:
> `@dc2d/content` (`src/effects/elementalItems.ts`, `src/achievements/achievementCatalog.ts`, `src/rewards/rewardBoxTables.ts`),
> `@dc2d/engine` (`src/effects/effectSchemas.ts`, `src/effects/effectValidator.ts`, `src/effects/reactionRules.ts`, `src/effects/runtimeRegistry.ts`, `src/net/systemAiSchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/effects/effectExecutor.ts`, `src/sim/effects/areaManager.ts`, `src/sim/systemAi/synthesizer.ts`, `src/sim/systemAi/llmAdapter.ts`, `src/sim/systemAi/achievementTracker.ts`, `src/sim/survival/persistenceStore.ts`),
> `@dc2d/client` (`src/render/world/effects/areaVfxLayer.ts`, `src/ui/rewards/`, `src/ui/icons/dynamicItemIcon.ts`)
> **Folder-Size Guardrails**: `packages/client/src/ui/hud/` and `packages/client/src/render/world/` are saturated — place new modules strictly in subfolders (`ui/rewards/`, `render/world/effects/`, `sim/effects/`, `sim/systemAi/`, `engine/src/effects/`).

---

## 1. Scope & Player Experience

Phase 13 caps the game with DungeonCrawler 2D's signature composable effects engine & DCC System-AI loop safely inside `@dc2d/engine`:
- **Composable Effects & Elemental Reactions**: A strict Zod-validated `EffectGraph` executes composable primitives (`modify_health`, `modify_stat`, `apply_status`, `remove_status`, `spawn_area`, `spawn_projectile`, `knockback`, `emit_vfx`) across combat/consumable triggers. Players craft **Fire**, **Frost**, **Poison**, and **Shock** arrows and trigger `5` deterministic elemental area reactions (`fire + wet`, `shock + wet`, `fire + poison`, `frost + wet`, `fire + web`).
- **System-AI Invention Bench**: Combining `2–3` catalyst items (+ Gold/`ancient-core`) at an **Invention Bench** asks the System-AI to synthesize a validated, novel item or recipe (running 100% deterministically offline/in CI via a seeded procedural synthesizer, with an optional async server LLM adapter gated by `SYSTEM_AI_API_KEY` through the exact same power-budget validator).
- **DCC Achievements & Sponsor Reward Boxes**: `>= 20` gameplay achievements fire snarky **System-AI Announcement Banners** and drop tiered **Sponsor Reward Boxes** (`bronze-box`..`celestial-box`) opening in an interactive crate reveal modal.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` (`effects/effectSchemas.ts`, `effects/effectValidator.ts`, `effects/runtimeRegistry.ts`)
- **Effect Primitives & Triggers**:
  - `EffectTrigger`: `"onHit" | "onCrit" | "onBackstab" | "onParry" | "onBlock" | "onConsume" | "onKill" | "onTick"`.
  - `ElementKind`: `"none" | "fire" | "frost" | "poison" | "shock" | "wet"`.
  - `EffectPrimitiveSchema`: discriminated union of:
    - `modify_health` (`amount: -100..100`, `target: "self"|"victim"`)
    - `modify_stat` (`stat`, `delta`, `durationSec: 1..120`)
    - `apply_status` (`status: "burn"|"frost"|"poison"|"shock"|"bleed"|"wet"|"freeze"`, `durationSec: 0.5..15`, `power: 1..12`)
    - `remove_status` (`status` or `"all_debuffs"`)
    - `spawn_area` (`element`, `radiusTiles: 0.8..3.5`, `durationSec: 1..8`, `tickIntervalSec: 0.5..1.5`, `power: 1..15`)
    - `spawn_projectile` (`kind`, `count: 1..3`, `spreadRad`, `damage: 2..30`)
    - `knockback` (`force: 1..10`)
    - `emit_vfx` (`style`, `colorHex`, `label?: string`)
  - `EffectGraphSchema`: `{ trigger: EffectTrigger, cooldownSec: number, primitives: EffectPrimitive[] }`, constrained by `maxTriggerDepth = 2`, `maxPrimitives = 5`, and rarity power-budget caps.
- **Runtime Content Sync (`systemAiSchemas.ts`)**:
  - `InventedItemDef`: extends `ItemDef` with `effectGraphs?: EffectGraph[]`, `aiLore: string`, `iconPalette: { primary: string; trim: string; glyph: string }`.
  - `ServerMessage`: add `runtimeContentSync` (`items: InventedItemDef[]`, `recipes: RecipeDef[]`) sent on join and whenever a new invention is forged.
  - `ClientMessage`: add `inventItem` (`catalystSlots: number[]`, `promptHint?: string`), `openRewardBox` (`slotIndex: number`).
  - `PlayerSnapshotSchema`: add `freezeTimer?: number`, `shockTimer?: number`.
  - `AchievementCatalog`: `>= 20` definitions `{ id, title, aiQuip, boxTier }`.

### 2.2 Persistence (`persistenceStore.ts` & `offlinePersistence.ts`)
- `PersistedWorldFile`: add `inventedItems: InventedItemDef[]`, `inventedRecipes: RecipeDef[]`.
- `PersistedPlayerRecord`: add `unlockedAchievements: string[]`.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Composable Effects Executor & 5 Elemental Reactions
- **Elemental Arrows (`elementalItems.ts`)**: Craftable `fire-arrow`, `frost-arrow`, `poison-arrow`, `shock-arrow` (`arrow + catalyst`) selectable via hotbar/ammo priority or quiver toggle; arrows apply their `ElementKind` on hit and spawn `1.5`-tile elemental ground zones when charged `>= 0.7`.
- **5 Deterministic Area Reactions (`reactionRules.ts`, `areaManager.ts`)**:
  1. `fire + wet` -> **Steam Cloud** (`radius: 2.6`, `4.0s`): extinguishes `burnTimer`, creates opaque mist reducing enemy sight visibility inside by `0.45×`.
  2. `shock + wet` -> **Chain Arc**: deals `+40%` bonus shock damage and arcs lightning to up to `3` wet/nearby targets within `3.0` tiles.
  3. `fire + poison` -> **Volatile Detonation**: consumes poison cloud in an instant `2.8`-tile blast dealing `22` AoE fire damage + camera shake.
  4. `frost + wet` -> **Freeze**: applies `1.5s` `freezeTimer` (immobilizes target + blue ice tint) and grants `+30%` **Shatter** bonus on the next melee strike.
  5. `fire + web` -> **Web Burn**: ignites spiderweb strands via the unified `EffectExecutor` pipeline.

### 3.2 Power-Budget Validator & Runtime Registry
- **Strict Validator (`validateInventedEffectGraph`)**:
  - Rejects graphs exceeding `maxPrimitives = 5`, `maxTriggerDepth = 2`, invalid enum values, or power score exceeding target rarity cap (`common: 20`, `uncommon: 35`, `rare: 55`, `epic: 80`, `legendary: 110`).
  - Returns `{ ok: true, graph, powerScore }` or `{ ok: false, violations: string[] }`.
- **Runtime Registration**: Validated items register immediately in `RuntimeItemRegistry`, render procedural tinted pixel icons via `dynamicItemIcon.ts` (falling back gracefully with zero missing-icon errors), show full stats/effect descriptions in `ItemCardPopover`, persist in `world-save.json`, and broadcast to all connected clients via `runtimeContentSync`.

### 3.3 Deterministic System-AI Synthesizer + Optional LLM Adapter
- **Invention Bench (`PropKind.InventionBench`, craftable or in Sanctuary Hub)**:
  - Placing `2–3` catalyst items (+ Gold/`ancient-core`) and clicking **Synthesize** calls `synthesizer.ts`:
    - **Deterministic Core (Default / Offline / CI)**: Hashes catalyst IDs + world seed + optional prompt hint to assemble balanced `EffectGraph`s, thematic names, and snarky DCC System-AI flavor lines with zero external network dependencies.
    - **Optional LLM Adapter (`SYSTEM_AI_API_KEY`)**: Async non-blocking HTTP request (`4_000ms` timeout) asking for structured JSON matching `InventedItemProposalSchema`. Any timeout, HTTP failure, or `validateInventedEffectGraph` rejection falls back cleanly to the deterministic synthesizer so the 20 Hz simulation tick is **never** blocked.

### 3.4 Achievements, Reward Boxes & Audio/Visual Parity
- **20+ Achievements (`achievementCatalog.ts`)**: Tracks real gameplay milestones (e.g., first backstab, boar wall-stun parry, dark dungeon torch clear, elemental reaction trigger, Floor Boss kill, survive collapse storm).
- **System-AI Banner & Box Drops**: Unlocking an achievement triggers a stylized purple-gold **System-AI Announcement** (`NEW ACHIEVEMENT!`), plays the System-AI fanfare SFX, and grants the tier's Reward Box (`bronze-box`, `silver-box`, `gold-box`, `platinum-box`, `celestial-box`).
- **Reward Box Reveal Modal (`ui/rewards/rewardBoxModal.ts`)**: Using `[Use]` / clicking a Reward Box opens an animated box-opening modal (PC & Mobile responsive), rolls deterministic tier loot (`Gold`, prefixed gear, or a freshly synthesized System-AI artifact), places items cleanly into inventory (or ground drops if full), and adds the `RewardBox` scene to `e2e/visual-regression.spec.ts`.

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Loop Prevention**: `EffectExecutor` enforces `depth <= maxTriggerDepth (2)` and per-target `cooldownSec` so `onHit -> spawn_area -> onTick` can never recurse infinitely.
- **Malformed LLM Output Safety**: Invalid JSON, out-of-range damage (`damage: 9999`), or unpermitted primitive types from the optional LLM adapter are always caught by Zod + `validateInventedEffectGraph` and replaced with the deterministic fallback.
- **Full-Bag Reward Box**: Opening a Reward Box when inventory has `< 2` free slots either spills overflow drops safely at the player's feet (`dropLockActive`) or warns cleanly before opening so rewards are never lost.
- **Mid-Session Client Join**: Late-joining clients receive `runtimeContentSync` before their first `ServerSnapshot` so invented items held or dropped by other players render icons and tooltips immediately.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P13-01` | Effect Schema | `EffectGraphSchema` validates all `8` `EffectPrimitive`s and `8` `EffectTrigger`s and rejects malformed or negative-duration specs. | `unit` | `packages/engine/src/effects/effectValidator.test.ts` |
| `REQ-P13-02` | Power Cap | `validateInventedEffectGraph` enforces `maxPrimitives <= 5`, `maxTriggerDepth <= 2`, and rarity power caps (`20..110`), rejecting over-budget `999`-damage items. | `unit` | `packages/engine/src/effects/effectValidator.test.ts` |
| `REQ-P13-03` | Effect Loop Guard | `EffectExecutor` prevents infinite trigger recursion (`depth > 2` aborted) and enforces `cooldownSec` cleanly during 20 Hz ticks. | `sim` | `packages/game-server/src/sim/effects/effectExecutor.test.ts` |
| `REQ-P13-04` | Elemental Arrows | `fire-arrow`, `frost-arrow`, `poison-arrow`, and `shock-arrow` craft cleanly, fire with distinct projectile tint/trail, and apply matching elemental statuses on hit. | `unit`, `sim`, `static`, `e2e-desktop` | `packages/content/src/effects/elementalItems.test.ts`, `packages/game-server/src/sim/effects/effectExecutor.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/phase-13.spec.ts` |
| `REQ-P13-05` | Area Reactions | All `5` reactions (`fire+wet` Steam Cloud, `shock+wet` Chain Arc `<= 3.0` tiles `+40%`, `fire+poison` Detonation `22` dmg, `frost+wet` `1.5s` Freeze `+30%` shatter, `fire+web` burn) trigger deterministically. | `unit`, `sim`, `e2e-desktop`, `visual` | `packages/engine/src/effects/reactionRules.test.ts`, `packages/game-server/src/sim/effects/effectExecutor.test.ts`, `e2e/phase-13.spec.ts` |
| `REQ-P13-06` | Runtime Sync | `inventItem` registers new items into `RuntimeItemRegistry`, broadcasts `runtimeContentSync` to all clients, renders procedural `dynamicItemIcon`, and persists across server restart. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/systemAi/systemAiSim.test.ts`, `e2e/phase-13.spec.ts` |
| `REQ-P13-07` | Deterministic AI | Procedural System-AI synthesizer produces valid, unique items with lore and `EffectGraph`s from catalyst combinations with zero network/API keys required. | `unit`, `sim`, `e2e-desktop` | `packages/game-server/src/sim/systemAi/systemAiSim.test.ts`, `e2e/phase-13.spec.ts` |
| `REQ-P13-08` | LLM Fallback | Optional `llmAdapter` runs asynchronously off-tick, rejects invalid/over-budget LLM JSON, and falls back to deterministic synthesis within `4s` without stalling 20 Hz ticks. | `sim` | `packages/game-server/src/sim/systemAi/systemAiSim.test.ts` |
| `REQ-P13-09` | Invention UI | Invention Bench modal accepts `2–3` catalysts, previews power tier, displays synthesized `ItemCardPopover` on completion, and works on both `1280×720` and `390×844` touch viewports. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-13.spec.ts` |
| `REQ-P13-10` | Achievements | `ACHIEVEMENT_CATALOG` contains `>= 20` unique achievements; triggering conditions unlocks each once, fires System-AI banner + SFX, and persists `unlockedAchievements`. | `unit`, `sim`, `static`, `e2e-desktop` | `packages/content/src/achievements/achievementCatalog.test.ts`, `packages/game-server/src/sim/systemAi/achievementTracker.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/phase-13.spec.ts` |
| `REQ-P13-11` | Reward Boxes | Tiered boxes (`bronze-box`..`celestial-box`) open via `[Use]`/modal, grant guaranteed tier loot + Gold/AI item (spilling safely on full bag), consume the box atomically, and pass visual regression capture. | `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/game-server/src/sim/systemAi/achievementTracker.test.ts`, `e2e/phase-13.spec.ts` |
| `REQ-P13-12` | Offline & 1.0 Gate | Solo offline preview executes elemental arrows/reactions, deterministic Invention Bench synthesis, achievements, and Reward Box opening across `F5` reload; `npm run verify:phase -- all` exits `0`. | `e2e-desktop`, `static`, `unit`, `sim`, `e2e-mobile`, `visual` | `e2e/phase-13.spec.ts`, `scripts/verify/spec-coverage.mjs` |

---

## 6. Phase Exit Gate

Phase 13 (and full `1.0` readiness) may be marked `✅ Complete` only when `npm run verify:phase -- phase-13` and `npm run verify:phase -- all` exit `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `12` Phase 13 requirements (`REQ-P13-01`..`REQ-P13-12`) and all prior phases passing.
