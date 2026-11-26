# Spec 06 — Discovery Banners, POI Toasts, Map Pins & Exploration Log

> **Touchpoints**:
> `@dc2d/engine` (`src/net/discoverySchemas.ts`, `src/net/protocol.ts`, `src/net/worldEventSchemas.ts`),
> `@dc2d/game-server` (`src/sim/frontier/discoveryTracker.ts`, `src/sim/survival/persistenceStore.ts`, `src/sim/worldSim.ts`),
> `@dc2d/client` (`src/ui/discovery/discoveryOverlay.ts`, `src/ui/discovery/discoveryStyles.ts`, `src/ui/map/minimapOverlay.ts`, `src/ui/map/mapPinRenderer.ts`, `src/ui/map/compassBadge.ts`).

---

## 1. Biome Entry Banners

- As the player walks across macro-biome borders, the client detects biome changes (debounced with a `6s` cooldown per biome so border jitter never flickers).
- Displays a sleek translucent top-center **Biome Banner** for `3.2s`:
  - Title: Biome display name (e.g., `Misty Bog`) tinted with the biome's signature accent color.
  - Subtitle: `Danger Tier II · Spore-Shrouded Marshes`.
- `CompassBadge` also shows a compact biome/tier indicator when hovering or right beside coordinates cleanly on desktop.

---

## 2. POI Discovery Toasts & Persistence

- On the server (`DiscoveryTracker`), when a player enters within `Math.max(poi.radiusX, poi.radiusY) + 4.5` tiles of a `ChunkPoi` for the first time:
  - Records `poi.id` in the player's `discoveredPoiIds` and `poi.kind` in `discoveredPoiKinds` (persisted in `PersistedPlayerRecord` across reconnects and restarts).
  - Emits a `poiDiscover` `WorldEvent` carrying the POI display name and category.
  - Client plays a warm crystalline discovery chime (`synthSfx`) and slides in a crisp **Discovery Toast** (`✦ Discovered: Fallen Knight's Grave` + short flavor line).
- Interactive prompts also fire clean toast feedback on Shrine activation, Waystone attunement (`Revealed 3 nearby landmarks on [M] Map!`), Lore Sign reading, and Brazier Vault unlocking.

---

## 3. `[M]` Overworld Map Pins & Waystone Beacons

`MinimapOverlay` (`minimapOverlay.ts` + `mapPinRenderer.ts`) upgrades from plain generic chest dots to a true explorer's atlas:

| Category | Pin Shape & Color | Notes |
| --- | --- | --- |
| Shrines & Waystones | Cyan / Sky Diamond (`#38bdf8`) | Marks visited altars & attunement stones |
| Elite Lairs | Crimson Star / Diamond (`#ef4444`) | Highlights dangerous mini-boss arenas |
| Puzzle Vaults | Gold Square (`#fbbf24`) | Shows sealed vs unlocked state |
| Friendly Camps | Emerald Cross (`#4ade80`) | Marks safe sanctuaries & workbenches |
| Micro-Scenes | Teal Dot (`#2dd4bf`) | Marks discovered graves, carts, boats, rings |
| Bandit Camps / Ruins | Orange / Slate Badge | Classic camp & ruin markers |
| Waystone-Revealed (`?`) | Pulsing Cyan `?` Beacon | Shown for unvisited landmarks revealed by an Ancient Waystone |

- **Map Footer**: Displays `Discovered: X / 19 Landmark Types` plus current Biome & Danger Tier.
