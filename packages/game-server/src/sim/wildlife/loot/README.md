# Wildlife & Chest Loot (`packages/game-server/src/sim/wildlife/loot`)

Authoritative chest storage, ground loot drops, and DangerTier enemy/chest scaling:

- `lootManager.ts`: `LootManager` managing 27-slot POI/player chests and magnetic ground loot drops.
- `eliteScaling.ts`: DangerTier stat multipliers, biome rosters, elite titles, and seeded POI chest population.
- `lootTypes.ts`: Shared chest/ground-loot snapshot builders and storage records.
