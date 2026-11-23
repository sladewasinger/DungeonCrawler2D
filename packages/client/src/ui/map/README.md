# Map & Navigation UI (`packages/client/src/ui/map/`)

Minecraft-style held Overworld Map and persistent navigation coordinates:
- **`compassBadge.ts`**: Compact top-right Compass icon displaying live integer `(X, Y)` tile coordinates (`0, 0` at spawn, campfire at `(2, -2)`) for multiplayer navigation & callouts.
- **`minimapOverlay.ts`**: Player-centered live canvas minimap rendered when the `"map"` hotbar item (`Overworld Map`) is held (`1×` / `2×` zoom toggle, terrain biomes + cliff elevation shading, orange campfire dots, gold chest markers, red active enemy/wildlife dots, purple remote player dots, and local facing arrow).
