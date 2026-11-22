# Client Renderer (`packages/client/src/render`)

Isolated PixiJS v8 rendering subsystems:
- `textures/`: `32×32` pixel-art terrain painters (`TERRAIN_TEX_PX = 32`) packed into one extruded `136×306` GPU tileset atlas (`1px` gutter padding), foliage/campfire/torch sprites, `spriteManifest.ts` (`64×64` PNG preloader with `scaleMode: "nearest"` from `/assets/sprite-manifest.json`), and 1px outline helpers.
- `shaders/`: WebGL2 GLSL GPU tilemap shader (`tilemapMesh.ts` + `glsl/tilemapGlsl.ts`) sampling the shared tileset atlas from `4 KB`/chunk `RGBA8` lookup maps (`BufferImageSource`), plus water, foliage wind, lighting filters, directional cast shadows, and pooled GPU particles.
- `world/`: `32×32` GPU tilemap chunk setup (`tileBuilder.ts`), elevated `3/4` cliff plateau strips at `32px/tile` (`cliffStrips.ts`), chunk streaming, canopy alpha fade, and camera orchestration.
