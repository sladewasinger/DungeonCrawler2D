// Registers every tile-pack sheet from the catalog as a Phaser spritesheet, so scenes
// can reference frames via tilePackSheetKey() without touching the Loader directly.
import type Phaser from "phaser";
import { bootTileCatalog, tilePackSheetSpecs } from "./tilePackManifest.js";

/** Call from a scene's `preload()`, alongside the atlas/animations loads in
 * PreloadScene — one call, no per-pack special cases as new packs are added. */
export function preloadTilePacks(loader: Phaser.Loader.LoaderPlugin): void {
  for (const spec of tilePackSheetSpecs(bootTileCatalog)) {
    loader.spritesheet(spec.key, spec.path, {
      frameWidth: spec.frameWidth,
      frameHeight: spec.frameHeight,
    });
  }
}
