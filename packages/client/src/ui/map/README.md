# Map & Navigation UI (`packages/client/src/ui/map/`)

Large centered Overworld Map overlay and persistent navigation coordinates:
- **`compassBadge.ts`**: Compact top-right Compass icon displaying live integer `(X, Y)` tile coordinates (`0, 0` at spawn, campfire at `(2, -2)`) for multiplayer navigation & callouts.
- **`minimapOverlay.ts`**: Centered `360×360` parchment Overworld Map (`[M]` hotkey toggle, `Overworld Map` hotbar item, or `Escape` / `[✕]` button) with `1× / 2× / 3×` zoom cycling, cardinal compass legend, terrain biomes + cliff elevation shading, campfires, chests, creatures, remote players, and local facing arrow — rendered with non-blocking pointer layout so WASD movement stays active while reading the map.
