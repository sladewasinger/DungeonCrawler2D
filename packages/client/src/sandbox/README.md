# Visual Asset & Terrain Diorama Sandbox (`packages/client/src/sandbox`)

Localhost-only interactive `96×32` asset gallery, terrain biome diorama, and combat arena (`/?sandbox=1`), linked directly from the Title Screen footer when running on `localhost` / `127.0.0.1`.

## Layout (`96×32` Tiles)
- **Left Half — Asset Gallery (`x = 0..47`)**:
  1. **Terrain Swatches (`y = 2`)**: All `GroundKind` variants plus cliff & stair faces.
  2. **Nature Props (`y = 8`)**: Trees, bushes, tall grass, flowers, boulders, stumps, and animated campfires/torches.
  3. **POI Structures & Chests (`y = 13`)**: Unified `0.50×` `18c` palisade wall segments, bandit tent, ruin pillar, and 4 interactive `WorldChestSnapshot` wood/stone chests (`[E]` opens the bidirectional `ChestModal`).
  4. **Held Gear Rack (`y = 17.5`)**: Weapons, shield, torch, pickaxe, and held `Overworld Map`.
  5. **Enemies & Dummies Lineup (`y = 22.4`)**: All 9 unified `0.50×` `18`-color PNG enemies (`wolf`, `bear`, `spider`, `boar`, `slime`, `goblin`, `orc`, `skeleton`, and `80×80` `golem`) plus the 3 procedural dummies.
- **Right Half — Live Terrain Diorama (`x = 48..95`)**:
  Curated biome slice rendered with real `buildChunkTilemapMeshes`, `bakeElevatedChunkRows`, `WaterSurfaceEffect`, `FoliageWindEffect`, `CastShadowLayer`, `LightingSystem`, and `resolveMovement` physics: winding river with shallow ford & sandy shoreline, wildflower meadow with campfire, oak/pine tree cluster with boulders & stumps, and a raised `elevation = 1` stone cliff plateau with working stairs (`[E]` ruin chest on top).

## Controls & Modes
- Walk with `WASD` / Arrows (swim barrier, shallow wade, walk behind trees, climb stairs), attack (`LMB`), block (`RMB`), dodge (`Space`), select hotbar (`1–9`, `9` shows live minimap), open chests (`E`).
- Live top-right `FpsCounter` + `CompassBadge`, quick **Gallery** / **Terrain** jump buttons, and AI/Pose/Direction/Time controls (`AI: Frozen / Live`, `Wake Nearest`, `Spawn Wolf Pack`, `Pose`, `Dir: Auto / S / E / W / N`, `Time`, zoom, `Reset Arena`).
