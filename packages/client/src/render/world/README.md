# World Scene (`packages/client/src/render/world`)

PixiJS v8 world rendering layer:
- `tileBuilder.ts`: Bakes `512×512` lower ground & water textures with ambient-occlusion cliff shadows and rounded shoreline masks.
- `cliffStrips.ts`: Bakes Y-sorted 3/4 lifted plateau row strips (`10px` per tier) with bevel rims, vertical cliff strata, and sloped staircases for smooth player occlusion.
- `playerSprite.ts`, `playerArmIk.ts` & `playerPoseHelpers.ts`: Render the 8-directional (`resolveFacingDir8`) 3D Hero (`scale = 0.3333`) with baked Blender shoulder sockets (`sampleShoulderSockets`), two-pass seamless capsule IK arms with split front/back slotting (`solveTwoBoneIk`, `PlayerArmRigView`), configurable per-body 8-dir arm/sword/lantern/bow offsets from `../poseTuning/`, shared `GaitClock` distance-driven walk/run frames & held-gear bob (synced 1:1 with `AudioEngine` footsteps), full-arm `dodge`/`downed` clips, `48 px/m` 2px-outlined gear & drawn bow, HiDPI nameplates, and smooth stair/elevation lift (falling back cleanly to legacy 2D sprites in headless tests).
- `chunkRenderer.ts`: Streams visible chunks, Y-sorts props/cliffs/actors, animates campfires/torches, rustles tall grass, and smoothly fades canopies when walking behind trees.
- `worldScene.ts`: Orchestrates camera zoom/follow, multi-pass WebGL2 shaders, cast shadows, and ambient particles.
