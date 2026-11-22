# Forest Atmosphere Suite (`packages/client/src/render/terrain/runtime/atmosphere`)

Parent client docs: [../../../../README.md](../../../../README.md)

## Modules

- [`terrainAtmosphere.ts`](terrainAtmosphere.ts) — Coordinates world-space cloud
  shadows and active prop animation from `TerrainRenderer`.
- [`cloudShadows.ts`](cloudShadows.ts) — Pooled world-space soft radial cloud
  shadows drifting seamlessly across the camera viewport.
- [`forestPropAnimation.ts`](forestPropAnimation.ts) — Wind sway on trees/bushes
  and time-driven shimmer on river water sprites.
- [`ambientMotes.ts`](ambientMotes.ts) — Pooled camera-space drifting sun-motes
  and falling forest leaves driven by `DungeonScene`.
