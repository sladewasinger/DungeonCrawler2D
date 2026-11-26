# HUD Buff Icon Tray (`packages/client/src/ui/hud/buffs/`)

- **`buffIcons.ts`**: Safe static SVG icon definitions via `parseStaticSvg` for `well-fed`, `invigorated`, `rested`, `salve`, shrine buffs (`swiftness`, `vigor`, `shadow`), and combat status badges.
- **`buffStyles.ts`**: Isolated CSS for `28x28` icon badges, countdown rings, accessible tooltips, `Warming` campfire progress bar, placement ghost badges, and 3-tier crafting station headers.
- **`buffTray.ts`**: `BuffTray` component embedded in `VitalsBar` rendering icon badges with radial countdown rings and hover/tap tooltips.
