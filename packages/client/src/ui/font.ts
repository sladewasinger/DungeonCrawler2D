// Loads the monogram pixel font (title-screen flavor only, see VISUAL_DIRECTION.md
// §UI) via @font-face, and hands out Text styles: a crisp integer-scaled pixel style
// for title flavor text, and a plain system-sans style for everything else — HUD
// widgets, nameplates, damage numbers — which reads legibly at any size without the
// blur monogram showed at 2x hudScale on high-density displays.
import type Phaser from "phaser";
import { ASSET_PATHS } from "../boot/assetManifest.js";

export const PIXEL_FONT_FAMILY = "monogram";
/** System font stack: zero network/asset cost, sharp at any size on any display. */
const UI_FONT_STACK = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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
 * The monogram pixel-font Text style — title-screen flavor headers only
 * (docs/VISUAL_DIRECTION.md §UI). `resolution` is pinned to the device pixel
 * ratio so glyphs stay sharp under Phaser's canvas texture scaling.
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

/**
 * The everyday UI Text style — HUD widgets, nameplates, damage numbers. Plain
 * system sans, pinned to the device pixel ratio for crisp glyphs; no
 * asset/network dependency and no integer-size rounding requirement, unlike
 * the pixel font it replaces for these surfaces.
 */
export function uiTextStyle(
  sizePx: number,
  color = "#e8e8e8",
): Phaser.Types.GameObjects.Text.TextStyle {
  const resolution = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  return {
    fontFamily: UI_FONT_STACK,
    fontSize: `${sizePx}px`,
    color,
    resolution,
  };
}
