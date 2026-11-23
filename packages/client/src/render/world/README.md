# World Scene (`packages/client/src/render/world`)

PixiJS v8 world rendering layer:
- `tileBuilder.ts`: Bakes `512×512` lower ground & water textures with ambient-occlusion cliff shadows and rounded shoreline masks.
- `cliffStrips.ts`: Bakes Y-sorted 3/4 lifted plateau row strips (`10px` per tier) with bevel rims, vertical cliff strata, and sloped staircases for smooth player occlusion.
- `playerSprite.ts`, `playerPoseHelpers.ts`, and `playerHeldLayout.ts`: Render the 8-directional 3D Hero (`scale = 0.3333`) using baked 3D arms & armor sleeves across all poses (including the 3-frame `bow` draw clip) + per-frame `handSockets` for sword/tool/torch/shield and upright bow placement (subtly tilted within each octant to track cursor/thumb aim), plus `swim` clips, waterline `waterMask` clipping (`visible = swimming`), concentric `waterRing` ripples, and distance-driven `GaitClock` stride syncing.
- `chunkRenderer.ts` & `chunkProps.ts`: Stream `32×32` chunks, mount `3×` HD-pixel props (`HD_PROP_SCALE = 1 / 3`), animate campfires & torches, fade tree canopies overhead, and drive base-anchored `(0.5, 0.94)` lever-arc grass/wildflower wind gusts + player push bending.
- `worldScene.ts` & `sceneHelpers.ts`: Orchestrate Option A integer-aligned zoom stops (`1.5, 2.25, 3.0, 4.5, 6.0`, default `3.0×`), camera follow, multi-pass WebGL2 shaders (`grassWindStrength = 0`), cast shadows, torch/campfire particles, `playerLeave` smoke clouds, stone clash sparks, and multi-actor water ripples.
