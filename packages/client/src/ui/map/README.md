# Map & Navigation UI (`packages/client/src/ui/map/`)

Large centered Overworld Map overlay and persistent navigation coordinates:
- **`compassBadge.ts`**: Compact top-right Compass icon displaying live integer `(X, Y)` tile coordinates and current frontier Biome/Danger Tier.
- **`fogOverlay.ts`**: Cached offscreen dark-parchment Fog-of-War shroud (`rgba(15, 19, 28, 0.92)` over unexplored `8×8`-tile cells) plus persistent Sanctuary Hub & Stairwell pins drawn cleanly above fog.
- **`mapPinRenderer.ts`, `minimapTileCache.ts`, & `minimapOverlay.ts`**: Centered `480×480` parchment Overworld Map (`[M]` hotkey toggle, `Overworld Map` hotbar item, or `Escape` / `[✕]` button) with `MinimapTileCache` (`32×32` 1px/tile cached chunk bitmaps), `2× / 3× / 4×` zoom cycling, cardinal compass legend, 5-biome terrain shading, category-colored POI pins, blue Shield Safe-Room hubs, Waystone `?` beacons, discovery counter (`X / 21 Landmarks`), campfires, chests, revealed creatures/remote players, Home Bed pin, and local facing arrow.
