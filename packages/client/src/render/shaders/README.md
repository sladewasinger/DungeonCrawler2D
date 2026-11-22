# Client Shaders (`packages/client/src/render/shaders`)

WebGL2 shader filters and pooled atmosphere passes running inside PixiJS v8:
- `waterFilter.ts` + `glsl/waterGlsl.ts`: World-locked animated water ripples, caustics, shoreline foam, and sun/moon sparkles.
- `foliageWindFilter.ts` + `glsl/foliageWindGlsl.ts`: Coherent world-space foliage gust displacement across canopies and tall grass.
- `lightingSystem.ts` + `glsl/lightingCompositeGlsl.ts`: Offscreen screen-space lightmap + directional relief rim lighting, selective warm bloom, diagonal canopy sunbeams/god-rays, drifting cloud shadows, valley ground mist, and filmic vignette.
- `castShadows.ts`: Directional cast shadow sprites beneath trees, boulders, bushes, and players synchronized with the solar angle.
- `ambientParticles.ts`: Pooled GPU sprites for sun-motes, leaves, fireflies, embers, and shallow-water ripples.
