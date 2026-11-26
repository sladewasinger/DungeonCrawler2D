# Frontier Discovery, POIs & Slash Commands (`packages/game-server/src/sim/frontier`)

Server-side progression for biome discovery, shrines, waystones, brazier puzzles, and authenticated admin chat commands:

- `poiInteractions.ts`: Interactive handlers for Swiftness/Vigor/Shadow Shrines, Ancient Waystones, Lore Signs, Gravestones, Brazier Vaults, and Runic Forges.
- `discoveryTracker.ts`: Per-player discovered biome/POI sets, XP/milestone notifications, and Waystone reveal beacons.
- `adminSlashCommands.ts`: Authenticated server chat slash commands (`/god`, `/give`, `/fillbag`, `/clearbag`, `/tp`, `/biome`, `/poi`).
