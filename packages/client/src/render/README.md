# Client Renderer (`packages/client/src/render`)

Isolated PixiJS v8 WebGL2 rendering subsystems:

| Directory | Covers |
| --- | --- |
| [`textures/`](./textures/README.md) | `32×32` terrain tiles/normals, `48 px/tile` HD props/foliage (`biomes/`, `pois/`), WebP `sprite-manifest.json` loader |
| [`shaders/`](./shaders/README.md) | WebGL2 GPU tilemap shader (`17`-row), water, canopy wind, composite lighting, cast shadows, ambient particles |
| [`world/`](./world/README.md) | `32×32` chunk streaming, 3/4 cliff strips, `PlayerView` sprites, lever foliage sway, and camera orchestration |
| [`character/`](./character/README.md) | 2-tier mobile-safe GPU player atlas packer, recoloring, 3D held gear/bow overlay, and grip sockets |
| [`combat/`](./combat/README.md) | Melee smears, combat VFX, dynamic spring-cloth webs, composable gore decals, AI indicators, POI chests |
| [`poseTuning/`](./poseTuning/README.md) | Live 8-dir arm/weapon pose table shared by gameplay and Sandbox Pose Tuner |
| [`survival/`](./survival/README.md) | Camp prop textures, harvest shake/crack VFX, and snapped camp placement ghost layer |
