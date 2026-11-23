# Server Gathering, Building & World Persistence (`packages/game-server/src/sim/survival/`)

Authoritative 20 Hz survival simulation and disk persistence coordinator:

- **`resourceHarvester.ts`**: Tracks remaining prop HP per chunk node, dispatches tool-gated harvest hits (`harvestHit` / `arrowRicochet`), converts felled trees to stumps or clears boulders/veins/bushes (`harvestBreak`) via `WorldChunkCache.setDepletedProp`, scatters magnetic drops, and steps regrowth timers.
- **`campStructures.ts`**: Validates and places camp structures via held kits or explicit `placeStructure` client messages, auto-registers 27-slot `player-chest` containers in `LootManager`, and binds per-player Camp Bed respawn coordinates.
- **`playerSurvivalState.ts`**: Ticks `wellFedTimer`, `restedTimer`, and hearth warm-up accumulation near campfires, applying `computeSurvivalRegen` bonuses without punishing idle starvation deaths.
- **`persistenceStore.ts` & `worldPersistenceSync.ts`**: Debounced (`10s`) and shutdown atomic `.tmp` JSON persistence storing world deltas (`depleted`, `structures`, `beds`), chest contents, and player profiles keyed by normalized player name (active only when `filePath` is configured).
