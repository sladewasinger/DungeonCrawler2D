# Offline World Simulation Helpers (`packages/client/src/net/offline/`)

- **`offlineWorldController.ts`**: Stateful coordinator handling `localStorage` snapshot hydration/flushing, placement/dismantle mutations, bed bindings, consumables, admin item grants, and resets.
- **`offlineWorldSim.ts`**: Pure client-side offline preview parity handlers matching `@dc2d/game-server` rules (`isNearOfflinePropKind`, `hydrateOfflineWorld`, `placeOfflineStructure`, `dismantleOfflineStructure`, `applyOfflineConsumableUse`, `stepOfflineSurvival`, `resetOfflineDefaults`).
