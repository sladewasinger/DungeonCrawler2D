/** Generates crisp 16x16 pixel-art SVG data URLs for items and armor slot silhouettes. */
import type { ArmorSlot } from "@dc2d/engine";
import {
  ARMOR_SLOT_SILHOUETTES,
  ITEM_ICON_SHAPES,
  type PixelRect,
} from "./itemIconShapes.js";

const iconUrlCache = new Map<string, string>();
const silhouetteUrlCache = new Map<string, string>();

const FALLBACK_SHAPE: readonly PixelRect[] = [
  [4, 4, 8, 8, "#94a3b8"],
  [5, 5, 6, 6, "#cbd5e1"],
];

function rectsToSvgDataUrl(rects: readonly PixelRect[], opacity = 1): string {
  const body = rects
    .map(
      ([x, y, w, h, fill]) =>
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" fill-opacity="${opacity}"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${body}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function itemIconDataUrl(itemId: string): string {
  const cached = iconUrlCache.get(itemId);
  if (cached) return cached;
  const rects = ITEM_ICON_SHAPES[itemId] ?? FALLBACK_SHAPE;
  const url = rectsToSvgDataUrl(rects);
  iconUrlCache.set(itemId, url);
  return url;
}

export function armorSlotSilhouetteDataUrl(slot: ArmorSlot): string {
  const cached = silhouetteUrlCache.get(slot);
  if (cached) return cached;
  const rects = ARMOR_SLOT_SILHOUETTES[slot] ?? FALLBACK_SHAPE;
  const url = rectsToSvgDataUrl(rects, 0.45);
  silhouetteUrlCache.set(slot, url);
  return url;
}
