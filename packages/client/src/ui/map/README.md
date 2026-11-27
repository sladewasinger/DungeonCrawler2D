# Map & Navigation UI (`packages/client/src/ui/map/`)

Large centered Overworld Map overlay and persistent navigation coordinates:
- **`compassBadge.ts`**: Compact top-right Compass icon displaying live integer `(X, Y)` tile coordinates and current frontier Biome/Danger Tier.
- **`mapPinRenderer.ts`, `minimapTileCache.ts`, & `minimapOverlay.ts`**: Centered `480×480` parchment Overworld Map (`[M]` hotkey toggle, `Overworld Map` hotbar item, or `Escape` / `[✕]` button) with `MinimapTileCache` (`32×32` 1px/tile cached chunk bitmaps), `2× / 3× / 4×` zoom cycling, cardinal compass legend, 5-biome terrain shading, category-colored POI pins (Shrines, Lairs, Puzzle Vaults, Friendly Camps, Micro-Scenes), Waystone `?` beacons, discovery counter (`X / 20 Landmarks`), campfires, chests, creatures, remote players, and local facing arrow.
