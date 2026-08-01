# Developer configuration

Developer-facing tuning is grouped by the system that owns the behavior. JSON
is used for data that can be edited independently of an algorithm; the small
adjacent TypeScript modules provide stable imports and derived values.

## Primary tuning files

| Domain | Editable source | Controls |
| --- | --- | --- |
| Procedural dungeon generation | `packages/engine/src/world/generate/worldGenerationTuning.json` | BSP rooms, corridor and hallway widths, room flavors, elevation frequency, landmarks, loot, fixed structures, and boss arenas |
| Reserved room templates | `packages/engine/src/world/features/rooms/roomConfiguration/roomTuning.json` | Personal, party, safe, and spawn room dimensions; wall height; exit hallway length; room spacing; spawn slots |
| Terrain presentation | `packages/client/src/render/terrain/terrainVisualStyle.json` | Camera backgrounds, void/floor ledges, ambient occlusion, and fallback terrain colors |
| Terrain runtime, camera, and mobile HUD cadence | `packages/client/src/render/terrain/terrainRuntimeTuning.json` | Chunk-plan cache, prewarmed orientation-root memory limits, shared 2D camera settings, non-interactive compass/telemetry cadence, and bounded local diagnostic capture retention |
| Dynamic lighting | `packages/client/src/render/lighting/lightingVisualStyle.json` | Ground light, torch/portal/personal halos, flicker, pooling, fade, colors, and radii |
| Spawn-room intercom | `packages/game-server/src/sim/announcer/spawnRoom/spawnRoomAnnouncements.json` | Speaker label, announcement text, display duration, initial delay, and pauses |
| Combat Sandbox layout | `packages/engine/src/world/combatSandbox/combatSandboxLayout.json` | Arena dimensions, wall and obstacle heights, player/fixture rows, and training-target positions |
| Combat hurtboxes | `packages/engine/src/combat/geometry/combatHurtboxTuning.json` and enemy entries in `packages/content/src/data/enemies.json` | Default player/enemy receiver dimensions plus sprite-specific enemy hurtboxes |
| Melee hitbox timing | `packages/game-server/src/sim/actions/melee/meleeHitboxTuning.json` | Active lifetime shared by player swings and sword Training Dummy hitboxes |
| Enemy simulation and training attacks | `packages/game-server/src/sim/enemies/configuration/enemySimulationTuning.json` and training-target entries in `packages/content/src/data/enemies.json` | Enemy perception/animation timing and each training target's health, respawn delay, weapon, and attack cadence |
| Items, effects, recipes, and enemies | `packages/content/src/data/` | Data-driven gameplay content |

Colors remain CSS hex strings so VS Code and similar editors expose their color
pickers. Spawn announcement templates may use `{name}` for the current crawler's
uppercased name.

## Values intentionally kept in TypeScript

Some values are not ordinary tuning and remain close to their implementation:

- `CHUNK_SIZE`, protocol enums, and runtime-plane layouts define persisted or
  networked structure.
- Deterministic hash salts preserve an existing world's generated layout.
- Numeric tolerances, iteration guards, and pool bookkeeping protect algorithms
  rather than shape game content.
- Physics constants in `packages/engine/src/core/constants.ts` are coupled
  constraints and should be changed with their movement/combat tests.

Changing generation JSON affects newly generated deterministic chunks for the
same seed. Treat those edits as world-generation changes, not live save-safe
cosmetics.

## Responsive 2D camera

Edit `packages/client/src/render/terrain/terrainRuntimeTuning.json` under
`cameraPresentation`. `referenceViewport` and `baseZoom` define the normal
100% world view. `minimumAspectRatio` and `maximumAspectRatio` define the
full-world camera range; extra browser area becomes centered black bars.
`spectator.minimumZoom`, `maximumZoom`, and `zoomStep` control the admin/live
spectator buttons as multipliers of that normal view. The client validates all
values at startup. A small minimum scale remains in TypeScript solely as a
technical safety floor for near-zero browser dimensions; it can only reduce
world coverage and is not a presentation tuning value.

## Mobile performance capture

Append `?mobilePerf=1` to a 2D game URL to enable a local-only mobile capture.
It displays a **Copy mobile perf** button and retains the latest 120 one-second
samples (configured by `mobilePerformance` in the terrain runtime JSON). The
report contains frame-time percentiles, long-task count when supported, canvas
CSS/backing dimensions, renderer/device/profile information, transport metrics,
visible entity buckets, and terrain submission counts. It does not log
continuously or transmit data. Copy the result from the phone and share it with
the team; reload without the query to remove the control.
