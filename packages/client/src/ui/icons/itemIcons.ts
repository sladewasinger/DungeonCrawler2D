/** Cached 16x16 pixel-art item icons (DOM data URLs) and nearest-filtered Pixi textures. */
import { Texture } from "pixi.js";
import {
  canvasToNearestTexture,
  createPixelCanvas,
  drawRects,
  stampDarkOutline,
  type PixelRect,
} from "../../render/textures/pixelCanvas.js";
import { ITEM_ICON_SPECS } from "./itemIconSpecs.js";

const FALLBACK_RECTS: readonly PixelRect[] = [[5, 5, 6, 6, "#f59e0b"]];
const ICON_SIZE = { w: 16, h: 16 } as const;
const OUTLINE_RGB = [18, 14, 22] as const;

const iconUrlCache = new Map<string, string>();
const heldTexCache = new Map<string, Texture>();

function buildItemCanvas(itemId: string): HTMLCanvasElement {
  const { canvas, ctx } = createPixelCanvas(ICON_SIZE.w, ICON_SIZE.h);
  drawRects(ctx, ITEM_ICON_SPECS[itemId] ?? FALLBACK_RECTS);
  stampDarkOutline(ctx, ICON_SIZE, OUTLINE_RGB);
  return canvas;
}

export function getItemIconUrl(itemId: string): string {
  const cached = iconUrlCache.get(itemId);
  if (cached) return cached;
  const url = buildItemCanvas(itemId).toDataURL();
  iconUrlCache.set(itemId, url);
  return url;
}

export function getItemHeldTexture(itemId: string | null | undefined): Texture | null {
  if (!itemId) return null;
  const cached = heldTexCache.get(itemId);
  if (cached) return cached;
  const tex = canvasToNearestTexture(buildItemCanvas(itemId));
  heldTexCache.set(itemId, tex);
  return tex;
}
