# Multi-Zone Simulation (`packages/game-server/src/sim/zones`)

Zone isolation layer supporting the overworld (`overworld`), Safe Room Hubs, and multi-floor dungeons:

- `zoneInstance.ts`: `ZoneInstance` wrapping an isolated `WorldChunkCache`, `CombatWorld`, floor metadata, and attached player map.
- `zoneManager.ts`: `ZoneManager` routing active players across zones, transferring instances cleanly, and stepping only active zones.
