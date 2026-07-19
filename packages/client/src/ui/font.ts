// Loads the monogram pixel font via @font-face and hands out crisp, integer-scaled Text styles.
import type Phaser from "phaser";
import { ASSET_PATHS } from "../boot/assetManifest.js";

export const PIXEL_FONT_FAMILY = "monogram";

let styleTagInjected = false;

/** Injects the @font-face rule once; safe to call repeatedly. */
export function injectPixelFontFace(): void {
  if (styleTagInjected) return;
  styleTagInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "${PIXEL_FONT_FAMILY}";
      src: url("/${ASSET_PATHS.fontFile}") format("truetype");
      font-display: block;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Injects the font-face and resolves once the browser has actually loaded a
 * glyph in it (WebFont-ready pattern) — call before creating any Text that
 * must render in the pixel font on the very first frame.
 */
export async function waitForPixelFontReady(): Promise<void> {
  injectPixelFontFace();
  if (typeof document === "undefined" || !("fonts" in document)) return;
  await document.fonts.load(`16px "${PIXEL_FONT_FAMILY}"`);
  await document.fonts.ready;
}

/**
 * A Phaser Text style using the pixel font at a crisp, integer pixel size.
 * `resolution` is pinned to the device pixel ratio so glyphs stay sharp
 * under Phaser's canvas texture scaling instead of blurring.
 */
export function pixelTextStyle(
  sizePx: number,
  color = "#e8e8e8",
): Phaser.Types.GameObjects.Text.TextStyle {
  const integerSize = Math.max(1, Math.round(sizePx));
  const resolution = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  return {
    fontFamily: PIXEL_FONT_FAMILY,
    fontSize: `${integerSize}px`,
    color,
    resolution,
  };
}
