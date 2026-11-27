# Client Shaders (`packages/client/src/render/shaders`)

WebGL2 shader filters and pooled atmosphere passes running inside PixiJS v8:
- `tilemapMesh.ts` + `glsl/tilemapGlsl.ts`: Custom `17`-row GPU terrain tilemap shader mesh & batch sampler.
- `waterFilter.ts` + `glsl/waterGlsl.ts`: World-locked animated water ripples, caustics, shoreline foam, and sun/moon sparkles.
- `foliageWindFilter.ts` + `glsl/foliageWindGlsl.ts`: Coherent world-space foliage gust displacement across canopies and tall grass.
- `lightingSystem.ts` + `glsl/lightingCompositeGlsl.ts`: Offscreen screen-space lightmap + directional relief rim lighting, selective warm bloom, diagonal canopy sunbeams/god-rays, drifting cloud shadows, valley ground mist, and filmic vignette.
- `castShadows.ts`: Directional cast shadow sprites beneath trees, boulders, bushes, and players synchronized with the solar angle.
- `ambientParticles.ts`: Pooled GPU sprites supporting biome & gameplay atmospheric modes (`mote`, `leaf`, `firefly`, `ember`, `flame`, `ripple`, `smoke`, `spore`, `ash`, `wisp`).
- `shaderDiag.ts`: WebGL2 `GlProgram` compile/link diagnostics feeding `window.__dc2dDiag`.
