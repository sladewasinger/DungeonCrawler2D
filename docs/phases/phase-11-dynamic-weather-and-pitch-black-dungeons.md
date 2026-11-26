# Phase 11 — Dynamic Weather & Pitch-Black Multi-Zone Dungeons

> **Status**: 📋 Spec Locked (Ready for Implementation after Phase 10)
> **Dependencies**: Phase 10 ✅, Frontier Overhaul (`Phase 8A` 5 Biomes) ✅, [Verification Gate](../VERIFICATION-GATE.md)
> **Primary Touchpoints**:
> `@dc2d/content` (`src/dungeons/dungeonThemes.ts`, `src/weather/weatherCatalog.ts`),
> `@dc2d/engine` (`src/weather/weatherRules.ts`, `src/world/dungeons/dungeonGenerator.ts`, `src/world/dungeons/trapRules.ts`, `src/net/zoneSchemas.ts`, `src/net/protocol.ts`),
> `@dc2d/game-server` (`src/sim/weather/weatherSim.ts`, `src/sim/zones/zoneRegistry.ts`, `src/sim/zones/zoneTransition.ts`, `src/sim/bosses/deeperBossAi.ts`, `src/sim/worldSim.ts`, `src/net/snapshotFilter.ts`),
> `@dc2d/client` (`src/render/world/weather/`, `src/render/world/dungeons/`, `src/render/shaders/lightingSystem.ts`, `src/render/textures/dungeons/`, `src/audio/weatherAudio.ts`)
> **Folder-Size Guardrails**: `packages/engine/src/world/`, `packages/game-server/src/sim/wildlife/`, `packages/client/src/render/textures/`, and `packages/client/src/render/world/` are saturated — place all new modules strictly in subfolders (`world/dungeons/`, `sim/zones/`, `sim/weather/`, `render/world/weather/`, `render/world/dungeons/`, `render/textures/dungeons/`).

---

## 1. Scope & Player Experience

Frontier Overhaul already delivered all 5 outdoor overworld biomes (`Verdant Forest`, `Autumn Woods`, `Misty Bog`, `Craggy Highlands`, `Cursed Ruinlands`) with their 17-row terrain atlas and biome wildlife. Phase 11 delivers **Dynamic Weather** and **Multi-Zone Pitch-Black Dungeons & Deeper Floors**:
- **Server-Synced Dynamic Weather**: Overworld zones cycle smoothly through `clear`, `overcast`, `rain`, and `thunderstorm` with angled GLSL rain streaks, animated puddle splash ripples, wet specular terrain sheen, and lightning flashes casting brief crisp shadows + delayed thunder SFX. Rain dampens footsteps by `-20%` and accelerates extinguishing `burnTimer`.
- **Multi-Zone Server Architecture (`zoneId`)**: Partitions `WorldSim` cleanly by zone (`"floor-1-overworld"`, `"dungeon:<poiId>"`, `"floor-2-catacombs"`, `"floor-3-abyss"`) so players can explore isolated pocket dungeons OR descend deeper floors simultaneously in multiplayer without entity/chat/lighting leakage.
- **Pitch-Black Pocket Dungeons & Floors 2–3**: Overworld **Cave Arches** and **Ruin Hatches** enter finite `64×64`–`96×96` procedural dungeons locked to pitch-black darkness (`ambient <= 0.04`) lit strictly by carried Torches/Lanterns, Radiant gear, ignitable wall sconces, and lava/crystal glow—complete with dart/spike traps. Descending Floor Stairwells transitions into **Floor 2 (Pitch-Black Catacombs)** and **Floor 3 (Abyssal Depths)** with unique Floor Bosses.

---

## 2. Data Contracts, Wire Protocol & Persistence

### 2.1 `@dc2d/engine` (`weather/weatherRules.ts`, `net/zoneSchemas.ts`, `net/protocol.ts`)
- **Weather Protocol**:
  - `WeatherKind`: `"clear" | "overcast" | "rain" | "thunderstorm"`.
  - `WeatherSnapshotSchema`: `{ kind: WeatherKind, intensity: z.number().min(0).max(1), windAngleRad: z.number(), lightningSeed?: z.number().int() }`.
  - Add `weather?: WeatherSnapshot` to `ServerSnapshotSchema`, and `"lightningFlash"` / `"trapTrigger"` / `"zoneEnter"` to `WORLD_EVENT_KINDS`.
  - Admin command `/weather <clear|overcast|rain|thunderstorm>` gated by `session.isAdmin`.
- **Zone Protocol (`zoneSchemas.ts`)**:
  - `ZoneKind`: `"overworld" | "pocket-dungeon" | "catacombs" | "abyss"`.
  - `ZoneMeta`: `{ zoneId: string; kind: ZoneKind; floorNumber: number; ambientLightCap: number; weatherEnabled: boolean; bounds?: { width: number; height: number } }`.
  - `PlayerSnapshotSchema`: add `zoneId: z.string().optional()` and `wetTimer: z.number().optional()`.
  - `ServerSnapshotSchema`: add `zoneMeta: ZoneMeta` so client switches chunk generator, darkness cap, and weather rendering atomically.
  - `PropKind`: add `CaveArch`, `RuinHatch`, `DungeonExitPortal`, `WallSconceUnlit`, `WallSconceLit`, `DartTrap`, `SpikeGrate`, `LavaVent`.
  - `ENTITY_KINDS`: add `"catacomb-warden"`, `"obsidian-sovereign"`.

### 2.2 Persistence (`persistenceStore.ts`)
- `PersistedWorldFile`: store per-zone `zones: Record<string, PersistedZoneDelta>` (depleted props, lit sconces, opened dungeon chests, dungeon boss killed).
- `PersistedPlayerRecord`: store `zoneId`, `returnPortal?: { zoneId: string; x: number; y: number; elevation: number }` so reconnecting inside a pocket dungeon preserves safe exit coordinates.

---

## 3. Detailed Functional, Visual & Audio Requirements

### 3.1 Server-Synced Dynamic Weather (`weatherSim.ts`, `render/world/weather/`)
- **Authoritative Weather Cycle**: Transitions deterministically every `180–360s` (`clear` -> `overcast` -> `rain` -> `thunderstorm` weighted by biome, e.g., higher rain chance in `Misty Bog`), synced to all outdoor players.
- **Visual Pipeline (`WeatherOverlay`)**:
  - `overcast`: desaturates sun intensity (`0.72×`) and shifts ambient slightly cooler.
  - `rain`: angled GLSL rain streaks (`windAngleRad`), animated concentric puddle splash ripples on flat ground tiles, wet specular terrain sheen (`uWetness`), and spatial rain loop SFX (`weatherAudio.ts`).
  - `thunderstorm`: intensifies rain + emits synchronized `lightningFlash` events spiking directional sun/shadow intensity to `1.8×` for `0.18s` followed `0.35s–1.1s` later by deep stereo thunder SFX.
- **Gameplay Integration (`weatherRules.ts`)**:
  - Active `rain` / `thunderstorm` sets `wetTimer = 2.0s` on outdoor players/entities (exiting indoors/cover clears after `2.0s`), extinguishing `burnTimer` `2.5×` faster, dimming outdoor torches slightly (`0.88×` light radius), and reducing outdoor movement noise radius by **`-20%`**.
  - Interior dungeon zones (`weatherEnabled: false`) suppress rain/thunder rendering and SFX automatically.

### 3.2 Multi-Zone Isolation & Client Transitions (`zoneRegistry.ts`, `zoneTransition.ts`)
- **Strict Zone Partitioning**: `WorldSim` routes chunks, collision, lighting queries, entities, projectiles, spiderwebs, ground loot, chests, and proximity chat strictly through `ZoneInstance` keyed by `zoneId`.
- **Zero Cross-Zone Leakage**: `snapshotFilter.ts` excludes players, entities, chests, loot, events, and chat messages from any other `zoneId`.
- **Clean Zone Transitions**: Interacting (`[E]` / tap) with a `CaveArch`, `RuinHatch`, `DungeonExitPortal`, or `StairwellOpen` fades screen (`<= 300ms`), switches `zoneMeta` and chunk source cleanly, clears stale render caches (`ChunkRenderer.clearAll()`), and places the player safely on the target spawn/return pad.

### 3.3 Finite Pitch-Black Dungeons & Deeper Floors (`dungeonGenerator.ts`)
- **Procedural Dungeon Layout (`64×64` to `96×96`)**:
  - Seeded room-and-corridor layout (`entrance room` -> `4–7 combat/puzzle/treasure rooms` -> `boss sanctum`) with **guaranteed walkable BFS/A* path** from entrance to boss room and exit portal (verified invariant!).
  - Overworld `CaveArch` (Highlands/Forest) and `RuinHatch` (Ancient Ruins/Cursed Ruinlands) stamp deterministically at eligible POIs.
- **True Pitch-Black Lighting (`ambientLightCap <= 0.04`)**:
  - Interior `lightingSystem.ts` clamps ambient base light to `<= 0.04` regardless of outdoor `dayPhase`, making unlit corridors genuinely pitch-black outside light pools.
  - Carried Torch/Lantern, `glowRadiusBonus` gear, ignitable `WallSconceUnlit -> WallSconceLit` (lit via Torch/Burn strike or `[E]` while holding Torch), `CursedCrystal`, and `LavaVent` glow carve crisp warm visibility pools; stealth exposure inside dungeons reads interior light pools directly.
- **Dungeon Traps**:
  - `SpikeGrate`: cyclic `2.4s` warn glint (`0.7s`) -> `0.6s` spikes up dealing `18` damage + `0.25s` hitstop.
  - `DartTrap`: pressure plate fires a visible `arrow`/`dart` projectile down the corridor (`16` damage, dodgeable/blockable).
- **Floor 2 & Floor 3 Progression**:
  - Floor 1 Stairwell descends to `"floor-2-catacombs"` (**Floor 2 — Pitch-Black Catacombs**, crypt tiles, `skeleton` / `spider` / `goblin` packs, guarded by **The Catacomb Warden**).
  - Floor 2 Stairwell descends to `"floor-3-abyss"` (**Floor 3 — Abyssal Depths**, obsidian & `LavaVent` caverns, `golem` / `orc` / `skeleton` packs, guarded by **The Obsidian Sovereign**).

---

## 4. Negative, Edge-Case & Multiplayer Parity Rules

- **Zone Disconnect Safety**: Disconnecting inside a pocket dungeon or Floor 2 restores the player at their saved `zoneId` and coordinates (or safely at the overworld return portal if a temporary pocket instance was reset).
- **Empty Pocket Dungeon Cleanup**: Idle pocket dungeons with `0` players remain cached for `60s` before unloading cleanly without leaking timers or memory.
- **Co-op Zone Independence**: Player A descending to Floor 2 does not force-teleport Player B out of Floor 1 (Floor 1 and Floor 2 ticks advance cleanly in parallel until party/countdown rules apply).
- **Dungeon Pathing Invariant**: Generator retries/repairs corridors deterministically if any room or exit portal is disconnected, guaranteeing `100%` reachability across seeds.

---

## 5. Requirement Traceability Table

| ID | Domain | Measurable Requirement & Pass Criteria | Verification Layer(s) | Automated Test Target |
| :--- | :--- | :--- | :--- | :--- |
| `REQ-P11-01` | Weather Sync | Server `WeatherSim` cycles `clear -> overcast -> rain -> thunderstorm` and replicates `WeatherSnapshot`; admin `/weather <kind>` switches weather within `1` tick. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/weather/weatherRules.test.ts`, `packages/game-server/src/sim/weather/weatherSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-02` | Rain Gameplay | Active `rain`/`thunderstorm` sets `wetTimer`, reduces outdoor movement noise radius by `20%`, and extinguishes `burnTimer` `2.5×` faster. | `unit`, `sim` | `packages/engine/src/weather/weatherRules.test.ts`, `packages/game-server/src/sim/weather/weatherSim.test.ts` |
| `REQ-P11-03` | Weather VFX/SFX | `rain` and `thunderstorm` render angled GLSL rain streaks, puddle splash ripples, and wet terrain sheen; `thunderstorm` fires `lightningFlash` + thunder SFX; all suppressed inside dungeons. | `e2e-desktop`, `e2e-mobile`, `visual` | `e2e/phase-11.spec.ts` |
| `REQ-P11-04` | Zone Isolation | `WorldSim` partitions entities, chests, loot, projectiles, webs, and proximity chat strictly by `zoneId`; zero cross-zone leakage in `snapshotFilter`. | `sim` | `packages/game-server/src/sim/zones/zoneSim.test.ts` |
| `REQ-P11-05` | Zone Transition | Entering `CaveArch` / `RuinHatch` transitions client to `"dungeon:<poiId>"` in `<= 300ms`, clears stale chunks, and `DungeonExitPortal` returns player to exact exterior coordinates. | `sim`, `e2e-desktop`, `e2e-mobile` | `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-06` | Dungeon Gen | `generatePocketDungeon` produces finite `64×64`–`96×96` maps across seeds with `>= 4` rooms and `100%` BFS walkable reachability from entrance to boss room & exit. | `unit` | `packages/engine/src/world/dungeons/dungeonGenerator.test.ts` |
| `REQ-P11-07` | Pitch-Black | Dungeon zones enforce `ambientLightCap <= 0.04` regardless of `dayPhase`; carried torch/lantern and `glowRadiusBonus` illuminate surroundings cleanly without blank-canvas blackouts. | `unit`, `e2e-desktop`, `e2e-mobile`, `visual` | `packages/client/src/render/world/dungeons/dungeonLighting.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-08` | Wall Sconces | Unlit `WallSconceUnlit` props ignite to `WallSconceLit` via Torch/Burn strike or `[E]` with Torch, spawning persistent point light and raising local stealth exposure. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-09` | Dungeon Traps | `SpikeGrate` cycles warn (`0.7s`) -> active (`0.6s`, `18` dmg); `DartTrap` fires dodgeable/blockable corridor projectiles (`16` dmg) on trigger. | `unit`, `sim`, `e2e-desktop` | `packages/engine/src/world/dungeons/trapRules.test.ts`, `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-10` | Floor 2 Zone | Descending Floor 1's unlocked Stairwell transitions into `"floor-2-catacombs"` (`ambient <= 0.04`) containing Floor 2 boss `catacomb-warden` and Floor 2 Stairwell. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-11` | Floor 3 Zone | Defeating `catacomb-warden` unlocks Floor 2 Stairwell; descending enters `"floor-3-abyss"` with `LavaVent` lights and Floor 3 boss `obsidian-sovereign`. | `sim`, `e2e-desktop`, `visual` | `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-12` | Zone Persistence | Reloading browser or restarting server while inside a dungeon or Floor 2 preserves `zoneId`, lit sconces, cleared traps/chests, and safe return portal. | `sim`, `e2e-desktop` | `packages/game-server/src/sim/zones/zoneSim.test.ts`, `e2e/phase-11.spec.ts` |
| `REQ-P11-13` | Asset Audit | All dungeon `PropKind`s (`cave-arch`, `ruin-hatch`, `wall-sconce-*`, `spike-grate`, `dart-trap`, `lava-vent`) and bosses (`catacomb-warden`, `obsidian-sovereign`) pass static asset & bounds checks. | `static`, `unit` | `scripts/verify/content-integrity.mjs`, `packages/client/src/render/textures/dungeons/dungeonTextures.test.ts` |
| `REQ-P11-14` | Co-op Independence | Two players in separate zones (`floor-1-overworld` vs `dungeon:*`) receive isolated snapshots and can fight/loot independently without errors. | `sim` | `packages/game-server/src/sim/zones/zoneSim.test.ts` |
| `REQ-P11-15` | Dungeon FPS | Pitch-black dungeon lightmap + wall sconces + weather overlay maintain `>= 45 FPS` median on Desktop without WebGL errors. | `e2e-desktop`, `e2e-mobile` | `e2e/phase-11.spec.ts` |
| `REQ-P11-16` | Offline Parity | Solo offline preview supports Overworld weather cycles, entering `CaveArch` pocket dungeon, lighting sconces, and exiting cleanly. | `e2e-desktop` | `e2e/phase-11.spec.ts` |

---

## 6. Phase Exit Gate

Phase 11 may be marked `✅ Complete` only when `npm run verify:phase -- phase-11` exits `0` per [VERIFICATION-GATE.md](../VERIFICATION-GATE.md) with all `16` requirements (`REQ-P11-01`..`REQ-P11-16`) passing.
