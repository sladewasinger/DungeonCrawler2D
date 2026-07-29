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
| Dynamic lighting | `packages/client/src/render/lighting/lightingVisualStyle.json` | Ground light, torch/portal/personal halos, flicker, pooling, fade, colors, and radii |
| Spawn-room intercom | `packages/game-server/src/sim/announcer/spawnRoom/spawnRoomAnnouncements.json` | Speaker label, announcement text, display duration, initial delay, and pauses |
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
