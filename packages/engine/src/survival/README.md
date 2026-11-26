# Survival, Gathering, Camp Building & Chunk Deltas (`@dc2d/engine`)

Shared pure mechanics and deterministic delta overlay for resource gathering, camp construction, light survival buffs, and chunk synchronization:

- **`harvestRules.ts`**: Harvestable prop definitions (`OakTree`, `PineTree`, `Stump`, `Boulder`, `CopperVein`, `IronVein`, `Bush`, `Wildflower`), tool-gated damage calculation (`computeHarvestDamage` — ore veins require `"stone"` pickaxe, trees/stumps reward `"wood"` axe), and loot drop rolls (`rollHarvestDrops`).
- **`campBuilding.ts`**: Data-driven `STRUCTURE_SPECS` for `campfire`, `torch`, `wood-chest`, `workbench`, `bed`, and `palisade`, plus placement validation (`canPlaceStructure` enforcing distance, water, elevation, obstacle, POI footprint, sanctuary exclusion, foreign-bed wards, and max 64 structures/owner) and `ChunkProp` / `PointLightSpec` adapters.
- **`survivalBuffs.ts`**: `SURVIVAL_BUFF_TUNING` and pure `computeSurvivalRegen` computing non-punitive Well-Fed and Rested HP/stamina regeneration bonuses.
- **`worldDeltas.ts`**: `WorldDeltaOverlay` storing depleted resource props (`cx`/`cy` indexed) and placed structures per chunk with revision counters (`chunkRevision`), integrated directly into `WorldChunkCache` so terrain, collision obstacles, and lighting update cleanly per chunk.
