// Loads the monogram pixel font (title-screen flavor only, see VISUAL_DIRECTION.md
// §UI) via @font-face, and hands out Text styles: a crisp integer-scaled pixel style
// for title flavor text, and a plain system-sans style for everything else — HUD
// widgets, nameplates, damage numbers — which reads legibly at any size without the
// blur monogram showed at 2x hudScale on high-density displays.
//
// `uiTextStyle`'s `scale` param matters more than it looks: a widget's Text is created
// at its logical fontSize, then the whole widget container is stretched by
// `layout.scale` (hudScale x the widget's own scale, see ui/widgets/layout.ts) via a
// Phaser GPU transform. Text's own `resolution` only bakes sharpness relative to its
// own local size — if the container's later scale isn't folded in here too, the glyph
// bitmap is baked below the density it's finally displayed at and gets blurrily
// upscaled by that transform. That was the real bug behind "HUD text is blurry", not
// the typeface: resolution was already pinned to devicePixelRatio, just not to the
// widget scale stacked on top of it. Screen-anchored entity text that lives outside any
// scaled container (nameplate.ts, damageNumbers.ts) instead pre-multiplies its fontSize
// by HUD_SCALE directly and passes no `scale` here — same fix, applied the other way,
// because there's no ancestor transform to account for.
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

/** 600 for emphasis (readouts, section titles, active state); 400 (unset — the
 * system stack's own regular weight) for everyday labels and body text. */
export type UiTextWeight = "normal" | "emphasis";

/**
 * The everyday UI Text style — HUD widgets, nameplates, damage numbers. Plain
 * system sans, pinned to the device pixel ratio (times any ancestor container
 * scale — see this file's header comment) for crisp glyphs at any zoom; no
 * asset/network dependency and no integer-size rounding requirement, unlike
 * the pixel font it replaces for these surfaces.
 *
 * @param scale Extra multiplier this Text will be stretched by after creation —
 *   pass a widget's `layout.scale` when building Text inside a container that
 *   gets `setScale(layout.scale)`; leave at 1 for text with no such ancestor
 *   (nameplates/damage numbers, which already bake HUD_SCALE into `sizePx`).
 */
export function uiTextStyle(
  sizePx: number,
  color = "#e8e8e8",
  scale = 1,
  weight: UiTextWeight = "normal",
): Phaser.Types.GameObjects.Text.TextStyle {
  const resolution = Math.max(1, (window.devicePixelRatio || 1) * scale);
  return {
    fontFamily: UI_FONT_STACK,
    fontSize: `${sizePx}px`,
    fontStyle: weight === "emphasis" ? "600" : "400",
    color,
    resolution,
  };
}
