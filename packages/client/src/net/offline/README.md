# Offline World Simulation Helpers (`packages/client/src/net/offline/`)

- **`offlineWorldController.ts`**: Stateful coordinator handling `localStorage` snapshot hydration/flushing, placement/dismantle mutations, bed bindings, consumables, admin item grants, Fog steps, and resets.
- **`offlineWorldSim.ts`**: Pure client-side offline preview parity handlers matching `@dc2d/game-server` rules (`isNearOfflinePropKind`, `hydrateOfflineWorld`, `placeOfflineStructure`, `dismantleOfflineStructure`, `applyOfflineConsumableUse`, `stepOfflineSurvival`, `resetOfflineDefaults`).
- **`offlineHubs.ts`**: Offline preview simulation parity for Fog-of-War (`stepOfflineFog`, `encodeFogMask`/`decodeFogMask`), Merchant Buy/Sell, Blacksmith Reforge/Upgrade, Sanctuary Stash quick transfers, Bounties, Floor Guide Quests, and Gold grants.
