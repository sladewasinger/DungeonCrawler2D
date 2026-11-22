# `@dc2d/client`

Browser client built with Phaser 3, Vite, and TypeScript (`@dc2d/engine` +
`@dc2d/content`; never imports `@dc2d/game-server` or `ws`).

## Module Layout

- `boot/` — Preloading, asset manifests (`assetManifest.ts`), pet sprite
  frames, animations, service worker, and startup scenes.
- `scenes/` — Phaser scenes (`TitleScene`, `DungeonScene`, `HudScene`, editor
  preview).
- `render/terrain/` — Terrain geometry planning (`planning/`), quad/atlas
  mesh batching (`batch/`, `geometry/`), shading/rim/AO overlays (`overlay/`,
  `shading/`), chunk streaming (`streaming/`), prop sprite sync
  (`runtime/props.ts`, `runtime/forestPropTextures.ts`,
  `material/forestLandmarkTextures.ts`), and the forest atmosphere suite
  ([render/terrain/runtime/atmosphere/README.md](render/terrain/runtime/atmosphere/README.md)).
- `render/entities/` & `render/view/` — Depth-sorted entity sprites
  (`depthSort.ts`), camera orientation transforms, and picking.
- `render/lighting/` & `vfx/` — Dynamic lighting and combat/area particles.
- `input/` & `net/` — Keyboard/mouse/touch controls, client prediction, and
  WebSocket snapshot sync.
- `ui/` — HUD widgets, editable HUD layout, Minecraft-style real-item workspace
  ([ui/hud/inventory/README.md](ui/hud/inventory/README.md)), procedural
  `16×16` pixel-art item icons & outlined forest wildlife sprites
  (`ui/presentation/itemIcons.ts`, `ui/presentation/itemAtlasInstaller.ts`,
  `ui/presentation/atlas/pixelOutline.ts`), dual-grid stash/chest modal, chat,
  and menus.
- `admin/`, `spectator/`, `three/` — Operational admin portal, read-only live
  spectator view, and experimental Three.js viewport.
