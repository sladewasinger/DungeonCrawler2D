# Pre-Title Loading Screen (`packages/client/src/ui/loading/`)

Loads and pre-bakes world, creature, item, and hero assets before revealing the Title Screen:

- **`loadingScreen.ts` & `loadingStyles.ts` (`index.html` `#ow-boot-loading`)**: `packages/client/index.html` renders the initial dark-gold loading popup with a CSS shimmer bar on first byte before JS downloads; `LoadingScreen` adopts that existing `#ow-boot-loading` DOM seamlessly on boot (or builds a fallback copy dynamically), switches cleanly from indeterminate shimmer to monotonic deterministic progress (`0% -> 100%`), and fades out once the first background scene frame renders.
- **`bootPreloader.ts`**: Coordinates parallel sprite-manifest + full 3D player layer preloading (`preloadCoreGameAssets`), combat gore/gear/item icon baking, saved-hero 3D spritesheet baking, and portrait pre-warming (`warmGameplayTexturesAndHero`) with frame yields so progress paints smoothly.
