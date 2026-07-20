// Small canvas swatches cropped straight from a tile pack's sheet PNG — the palette's
// "real sprites" requirement, independent of the Phaser renderer pipeline (this runs
// in plain DOM, image per sheet loaded lazily and cached across every swatch).
import type { TileRef } from "@dc2d/content";
import { bootTileCatalog, tilePackSheetKey, tilePackSheetSpecs } from "../../../../boot/tilePackManifest.js";

const SHEET_SPECS = new Map(tilePackSheetSpecs(bootTileCatalog).map((s) => [s.key, s]));
const imageCache = new Map<string, HTMLImageElement>();

function loadSheetImage(path: string): HTMLImageElement {
  let img = imageCache.get(path);
  if (!img) {
    img = new Image();
    img.src = path;
    imageCache.set(path, img);
  }
  return img;
}

/** A `size`x`size` canvas showing `ref`'s top-left cell from packId/ref.sheet's sheet —
 * draws once the (cached) sheet image finishes loading; blank dark tile until then. */
export function spriteSwatch(packId: string, ref: TileRef, size = 32): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  canvas.style.cssText = "border-radius:3px;background:#101018;display:block";
  const spec = SHEET_SPECS.get(tilePackSheetKey(packId, ref.sheet));
  if (!spec) return canvas;
  const img = loadSheetImage(spec.path);
  const draw = (): void => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      img,
      ref.col * spec.frameWidth,
      ref.row * spec.frameHeight,
      spec.frameWidth,
      spec.frameHeight,
      0,
      0,
      size,
      size,
    );
  };
  if (img.complete && img.naturalWidth > 0) draw();
  else img.addEventListener("load", draw, { once: true });
  return canvas;
}
