# Phase 12 — Co-op Polish, Adaptive Music, 3D Rig Polish & QA Benchmarks

> **Status**: 📋 Spec Locked (Ready for Implementation after Phase 11)
> **Dependencies**: Phase 6 ✅ (deferred swim clips), Phase 7 ✅ (deferred `Hero_Punch`), Phase 11 ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Primary Touchpoints**:
> `@dc2d/engine` (`src/net/partySchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/party/partyManager.ts`, `src/sim/combat/reviveSim.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/ui/hud/party/`, `src/audio/musicDirector.ts`, `src/audio/`, `src/render/world/playerSprite.ts`, `src/render/combat/entityAnimator.ts`, `src/ui/map/minimapOverlay.ts`),
> `tools/sprite-studio/` (`player_actions.py`, `quadruped_actions.py`, `humanoid_actions.py`, `arachnid_actions.py`, `export_player_layers.py`, `export_blend.py`),
> `e2e/` (`phase-12-coop.spec.ts`, `perf-benchmark.spec.ts`, `visual-regression.spec.ts`)
> **Folder-Size Guardrails**: `packages/client/src/ui/hud/` is saturated — place party UI under `packages/client/src/ui/hud/party/` and co-op server logic under `packages/game-server/src/sim/party/`.

---

## 1. Scope & Player Experience

Phase 12 finishes every co-op, audio, 3D animation polish, and performance benchmark commitment before the final Composable Effects & System-AI phase:
- **Co-op Party, Downed Revive & Shared Descent**: Up to `4` players form parties via invite/accept, see live party HP/zone/direction HUD frames and emerald `[M]` map pins, enter a `20s` **Downed** state (`Hero_Downed` clip) when party mates share the zone so allies can hold `[E]` / `REVIVE` for `2.5s` to restore them at `40%` HP, and coordinate Floor Stairwell readiness (`2/3 Party at Stairwell`).
- **6-State Adaptive Music & Phase 8–11 Audio Audit**: Multi-stem Web Audio `MusicDirector` smoothly crossfades (`2.0s` equal-power fade) across `sanctuary`, `exploration-day`, `exploration-night`, `stealth-tension`, `combat-boss`, and `pitch-black-dungeon`, paired with a verified SFX audit across all Phase 8–11 mechanics.
- **Deferred 3D Blender Animation Polish**: Replaces the Phase 6/7 temporary fallbacks with genuine Blender-baked `Hero_Punch` bare-fist combo clips (keeping mobile WebGL2 atlases strictly `<= 1536×1536`) and dedicated enemy deep-water **swim animations** across swimming species (`wolf`, `bear`, `boar`, `goblin`, `orc`, `spider`).
- **QA Performance & Visual Regression Suite**: Automated multi-preset Playwright benchmarks (`High`, `Balanced`, `Performance`) on Desktop and Mobile asserting frame-time budgets, WebGL VRAM/texture caps (`<= 2048px`), visual regression diffs (`<= 1.5%`), and full 2-client co-op playthroughs.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` (`net/partySchemas.ts`, `net/protocol.ts`)
- **Party Protocol**:
  - `PartyMemberSnapshot`: `{ id, name, hp, maxHp, x, y, zoneId, downed, bleedoutRemainingSec? }`.
  - `ServerSnapshotSchema`: add `selfParty?: { partyId: string; leaderId: string; members: PartyMemberSnapshot[]; stairwellReadyCount: number }`.
  - `ClientPartySchema`: `{ t: "party", action: "invite" | "accept" | "decline" | "leave" | "kick", targetPlayerId?: string, partyId?: string }`.
- **Downed & Revive State**:
  - `PlayerSnapshotSchema`: add `downed: z.boolean().optional()`, `bleedoutRemainingSec: z.number().optional()`, `reviveProgress: z.number().min(0).max(1).optional()`.
  - `ClientInputSchema`: add `revive: z.boolean().optional()`.
  - `WORLD_EVENT_KINDS`: add `"playerDowned"`, `"playerRevived"`.

### 2.2 `tools/sprite-studio/` Rig Manifests
- `player-rig.json`: add `"punch1"` and `"punch2"` 8-directional clips (`Hero_Punch_1`, `Hero_Punch_2`) packed cleanly inside the secondary lazy atlas tier (`<= 1536×1536` max texture dimension per `docs/LESSONS.md`).
- `sprite-manifest.json`: add `"swim"` 8-directional clip for `wolf`, `bear`, `boar`, `goblin`, `orc`, and `spider`.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Co-op Party, Downed Bleed-Out & Hold-to-Revive
- **Party Lifecycle (`partyManager.ts`)**: Any player can invite nearby/connected players (`maxPartySize = 4`); accepting forms/joins the party, renders compact left-side party frames (`Name`, HP bar, zone badge, off-screen directional arrow), and highlights teammates as emerald pins on `[M]` map. Friendly fire between party members is always disabled.
- **Downed State & Hold-to-Revive (`reviveSim.ts`)**:
  - Dropping to `0 HP` when `>= 1` alive party member is in the same `zoneId` enters `downed: true` with `bleedoutRemainingSec = 20.0`, immobile (`Hero_Downed` clip), and an audible distress ping + pulsing map cross.
  - A party mate within `2.2` tiles holding `[E]` (desktop) or `REVIVE` (mobile) increments `reviveProgress` linearly over `2.5s` (`0.4/s`); completing revives the ally at `40%` `maxHp`, `1.5s` invulnerability (`invulnTimer`), and `playerRevived` chime.
  - Solo players or parties with zero remaining standing allies in-zone skip `downed` and trigger normal respawn immediately.
- **Shared Stairwell Readiness**: Approaching an unlocked Stairwell in a party broadcasts readiness (`X/N Party Ready`), syncing Floor Countdown timers across party instances cleanly.

### 3.2 Adaptive Music Director & Phase 8–11 SFX Audit
- **`MusicDirector` (`packages/client/src/audio/musicDirector.ts`)**:
  - Selects highest-priority active state every `0.5s`: `combat-boss` > `pitch-black-dungeon` > `stealth-tension` (when crouched near alert/investigating foes) > `sanctuary` > `exploration-night` > `exploration-day`.
  - Executes `2.0s` equal-power Web Audio gain crossfades between stems with zero clicks, respects Settings `Music` volume & `Mute All` immediately, and exposes deterministic current-state telemetry for testing.
- **Phase 8–11 SFX Audit**: Verifies valid non-zero audio triggers for every Phase 8–11 event (`harvestHit`, `harvestBreak`, `dismantleStructure`, `bedSet`, Gold chime, Perk Draft, Collapse warning/storm, Rain/Thunder, `trapTrigger`, `playerDowned`/`playerRevived`).

### 3.3 Deferred 3D Blender Animations (`Hero_Punch` & Creature Swim)
- **Player `Hero_Punch` (`player_actions.py` + `playerSprite.ts`)**:
  - Bake 8-directional `punch1` (left jab + torso twist) and `punch2` (right cross + shoulder follow-through) clips for bare body and sleeves (`npm run player:bake`), mapped in `playerSprite.ts` whenever `weaponArchetype === "unarmed"`.
  - Enforce tight-packed atlas size `<= 1536×1536` across all tiers (`player3dRig.test.ts` + mobile WebGL telemetry).
- **Creature Swim Clips (`quadruped_actions.py`, `humanoid_actions.py`, `arachnid_actions.py`, `entityAnimator.ts`)**:
  - Bake 8-directional `swim` cycles for `wolf`, `bear`, `boar`, `goblin`, `orc`, and `spider` (`npm run sprite:bake`) and play `"swim"` automatically in `entityAnimator.ts` whenever `inDeepWater === true` alongside the waterline meniscus mask.

### 3.4 Automated QA Performance, WebGL & Visual Regression Gate
- **Multi-Preset Frame-Time Benchmark (`e2e/perf-benchmark.spec.ts`)**:
  - Drives scripted `15s` active gameplay + combat + map-open + storm/weather passes across `High`, `Balanced`, and `Performance` presets on Desktop (`1280×720`) and Mobile (`390×844`):
    - Desktop `High`: `p95 frame time <= 22.0ms` (`>= 45 FPS`), `Balanced`/`Performance`: `p95 <= 16.7ms` on hardware GPUs (with proportional no-cliff ratio under headless SwiftShader).
    - Mobile WebGL2 Audit: `0` uploaded WebGL textures exceeding `2048×2048` and estimated GPU texture memory `< 128 MiB`.
- **Visual Regression Baselines (`e2e/visual-regression.spec.ts`)**:
  - Captures deterministic seeded screenshots of `8` canonical scenes (`Title Screen`, `Sanctuary Hub`, `Overworld Combat`, `Stealth Night`, `Placement Ghost`, `Fog-of-War Map`, `Thunderstorm`, and `Pitch-Black Dungeon`), verifying `<= 1.5%` pixel drift against approved baselines and non-blank entropy.
- **2-Client Co-op End-to-End Test (`e2e/phase-12-coop.spec.ts`)**:
  - Launches two isolated Playwright browser contexts connected to `preview-prod`: Client A invites Client B -> both enter a pocket dungeon -> Client B drops to `0 HP` and enters `downed` -> Client A holds `[E]` `2.5s` to revive Client B -> both defeat boss and descend unlocked Stairwell cleanly with `0` console/WebGL errors.

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Revive Interruption**: Moving `> 2.2` tiles away or taking melee damage mid-revive cancels `reviveProgress` cleanly without soft-locking either player.
- **Bleed-Out Expiration**: If `bleedoutRemainingSec` reaches `0` without revive completion, the downed player transitions cleanly to death/respawn (or Softcore/Hardcore collapse rules if in collapse).
- **Party Disconnect**: Disconnecting removes or marks the member offline cleanly; if leader leaves, leadership transfers automatically to the longest-connected party member.
- **Atlas Size Guard**: Adding `Hero_Punch` must never push any player texture atlas above `1536×1536` (enforced by automated unit test and mobile E2E WebGL hook).

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P12-01` | Party Lifecycle | `partyManager` enforces `maxPartySize = 4`, supports invite/accept/decline/leave/kick, disables friendly fire, and promotes a new leader on disconnect. | `unit`, `sim`, `e2e-desktop` | `packages/game-server/src/sim/party/partySim.test.ts`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-02` | Party HUD/Map | Connected party members render live HUD frames (HP, zone, direction arrow) and emerald `[M]` map pins on Desktop and Mobile. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-03` | Downed & Revive | `0 HP` with a same-zone ally enters `20s` `downed` state; holding `[E]`/`REVIVE` within `2.2` tiles for `2.5s` revives at `40%` HP + `1.5s` i-frames; interruption resets progress cleanly. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/party/partySim.test.ts`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-04` | Shared Descent | Party Stairwell readiness broadcasts `X/N` count and coordinates shared floor descent & countdown sync across party clients. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/party/partySim.test.ts`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-05` | Adaptive Music | `MusicDirector` transitions across all `6` stems by strict priority with `2.0s` equal-power fade and honors Settings `Music` volume / `Mute All`. | `unit`, `e2e-desktop` | `packages/client/src/audio/musicDirector.test.ts`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-06` | Audio SFX Audit | Every Phase 8–11 event resolves to a non-null audio synthesizer call with peak amplitude `<= 1.0` and zero Web Audio errors. | `unit`, `e2e-desktop` | `packages/client/src/audio/proceduralSynth.test.ts`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-07` | Hero Punch 3D | `player-rig.json` contains 8-dir `punch1`/`punch2` clips; `playerSprite.ts` plays them on unarmed attacks; all packed player atlases stay `<= 1536×1536`. | `unit`, `static`, `e2e-desktop`, `visual` | `packages/client/src/render/world/player3dRig.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-08` | Creature Swim | `sprite-manifest.json` includes 8-dir `swim` clips for `wolf`, `bear`, `boar`, `goblin`, `orc`, `spider`; `entityAnimator.ts` plays `"swim"` when `inDeepWater === true`. | `unit`, `static`, `visual` | `packages/client/src/render/combat/creatureSwim.test.ts`, `scripts/verify/content-integrity.mjs`, `e2e/visual-regression.spec.ts` |
| `REQ-P12-09` | Perf Desktop | Automated Playwright benchmark passes frame-time budgets (`High` / `Balanced` / `Performance`) at `1280×720` with `0` console/WebGL errors. | `e2e-desktop` | `e2e/perf-benchmark.spec.ts` |
| `REQ-P12-10` | Perf Mobile | Automated Playwright benchmark at `390×844` verifies `0` WebGL textures `> 2048px`, estimated texture VRAM `< 128 MiB`, and `0` WebGL errors. | `e2e-mobile` | `e2e/perf-benchmark.spec.ts` |
| `REQ-P12-11` | Visual Gate | `8` canonical seeded screenshots (`Title`, `Sanctuary`, `Combat`, `Stealth`, `Placement`, `FogMap`, `Thunderstorm`, `Dungeon`) pass `<= 1.5%` pixel drift and non-blank entropy checks. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/visual-regression.spec.ts` |
| `REQ-P12-12` | Full Co-op E2E | 2-client Playwright playthrough verifies party invite -> pocket dungeon -> downed revive -> boss kill -> unlocked Stairwell descent end-to-end. | `e2e-desktop` | `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-13` | Offline Audio/Rig | Solo offline preview runs `MusicDirector` state shifts, `Hero_Punch`, and creature swim clips cleanly with `0` console errors. | `e2e-desktop` | `e2e/phase-12-coop.spec.ts` |
| `REQ-P12-14` | Gate Rollup | All prior phases (`phase-8`..`phase-12`) and `npm run verify:content` + `typecheck` + `lint` + `build` pass simultaneously with zero skipped requirements. | `static`, `unit`, `sim`, `e2e-desktop`, `e2e-mobile`, `visual` | `scripts/verify/spec-coverage.mjs` |

---

## 6. Phase Exit Gate

Phase 12 may be marked `✅ Complete` only when `npm run verify:phase -- phase-12` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `14` requirements (`REQ-P12-01`..`REQ-P12-14`) passing.
