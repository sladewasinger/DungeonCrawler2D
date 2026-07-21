// Occluder-strip atlas planning (pure math): instead of one RenderTexture per
// occluder row (~50 framebuffer-backed textures per chunk, ~580 resident in one
// probe view — the RT-pipeline pressure item in docs/ROADMAP.md), every strip in
// a chunk bakes into a shared per-chunk DynamicTexture page, and a plain Image
// per strip (frame = the strip's band in the page) carries the strip's original
// screen position and depth. Painter ordering is untouched — each strip keeps
// its exact depth key — so the pixels are identical while the resident
// framebuffer count drops by an order of magnitude (also directly shrinking the
// WebKit framebuffer-pressure risk surface from the judge-panel report).
export interface StripSpec {
  /** Screen-space y of the strip's top edge, px. */
  readonly stripTop: number;
  /** Strip height, px. */
  readonly stripHeight: number;
  /** Phaser depth the strip's image must render at (depthSort.ts). */
  readonly depth: number;
}

export interface PackedStrip {
  /** Index into AtlasPlan.pageHeights. */
  readonly page: number;
  /** Y offset of this strip's band inside its page, px. */
  readonly bandY: number;
}

export interface AtlasPlan {
  /** Height of each page texture, px (always even — DynamicTexture rounds odd sizes). */
  readonly pageHeights: readonly number[];
  /** One entry per input strip, same order. */
  readonly strips: readonly PackedStrip[];
}

/**
 * Blank rows between bands. Strip content never leaves its band today (every
 * draw is tile-cell-confined — the per-strip RTs would clip anything that did),
 * so the pad only exists to keep a hypothetical stray pixel from landing in a
 * neighbor band; the frame excludes it, reproducing the old RT-edge clipping.
 */
export const STRIP_PAD_PX = 2;

/**
 * Page height cap, chosen well under the 4096 minimum GL max-texture-size of
 * the mobile-WebKit target. Measured on the SwiftShader harness: very tall
 * pages (2048) made teleport-burst load/unload frames ~3x worse — allocation
 * and deletion of one huge texture stalls the GL pipeline harder than a few
 * medium ones. A single strip taller than the cap (impossible today: tallest =
 * 17 tiles = 816px) would get a page of its own height.
 */
export const MAX_PAGE_HEIGHT_PX = 512;

const even = (n: number): number => (n % 2 === 0 ? n : n + 1);

/**
 * First-fit sequential packing of strips into page bands, top to bottom in
 * input order. Hand-derivable: strip i's band starts where strip i-1's band
 * (plus pad) ended, unless that would cross `maxPageHeight` — then a new page
 * starts at 0.
 */
export function planStripAtlas(
  stripHeights: readonly number[],
  maxPageHeight: number = MAX_PAGE_HEIGHT_PX,
  pad: number = STRIP_PAD_PX,
): AtlasPlan {
  const pageHeights: number[] = [];
  const strips: PackedStrip[] = [];
  let page = -1;
  let cursor = 0;
  for (const h of stripHeights) {
    if (page < 0 || (cursor > 0 && cursor + h > maxPageHeight)) {
      page++;
      cursor = 0;
    }
    strips.push({ page, bandY: cursor });
    cursor += h + pad;
    pageHeights[page] = even(cursor - pad);
  }
  return { pageHeights, strips };
}
