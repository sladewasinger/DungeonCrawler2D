// Pooled DynamicTexture pages for the baked-terrain pipeline (chunkVisual.ts):
// creating/destroying framebuffer-backed textures per chunk load/unload is what
// stalled the GL pipeline (measured ~480ms teleport-burst frames on the
// SwiftShader harness; ~150ms with reuse), so pages park in bounded per-class
// spare lists (pagePool.ts) and the next bake recycles instead of allocating.
//
// Pages in a class are all the SAME fixed size, so any spare fits any bake:
// frames only ever cover the planned bands, and recycle() re-blanks the pixels
// and purges old strip frames while preserving Phaser's required base frame, so
// reuse is visually indistinguishable from a fresh texture.
import { CHUNK_SIZE } from "@dc2d/engine";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { PagePool } from "./pagePool.js";
import { MAX_PAGE_HEIGHT_PX } from "./stripAtlas.js";

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

/** Monotonic texture-key source: a rebaking chunk must never reuse a key an in-flight destroy still owns. */
let pageGeneration = 0;

/**
 * Two pooled size classes, both full chunk width: "strip" pages hold occluder
 * bands, "base" pages hold one whole flat base sheet. Spare caps are sized so a
 * camera-rotation invalidate (which releases EVERY resident page, then reacquires
 * them in the same-frame drain) cycles entirely through the pool — otherwise
 * rotation pays fresh GL allocations anyway.
 */
const PAGE_CLASSES = {
  strip: { height: MAX_PAGE_HEIGHT_PX, maxSpare: 96 },
  base: { height: CHUNK_PX, maxSpare: 24 },
} as const;
export type PageClass = keyof typeof PAGE_CLASSES;

/** One pool set per TextureManager (textures are game-global, scenes share them). */
const pagePools = new WeakMap<Phaser.Textures.TextureManager, Record<PageClass, PagePool<Phaser.Textures.DynamicTexture>>>();

function createPage(textures: Phaser.Textures.TextureManager, height: number): Phaser.Textures.DynamicTexture {
  const page = textures.addDynamicTexture(`terrain-page:${pageGeneration++}`, CHUNK_PX, height);
  if (!page) throw new Error("terrain page texture key collision"); // impossible: keys are monotonic
  return page;
}

function makePool(textures: Phaser.Textures.TextureManager, cls: PageClass): PagePool<Phaser.Textures.DynamicTexture> {
  return new PagePool({
    create: () => createPage(textures, PAGE_CLASSES[cls].height),
    recycle: (page) => {
      for (const name of page.getFrameNames()) {
        if (name !== "__BASE") page.remove(name);
      }
      page.clear();
    },
    destroy: (page) => {
      textures.remove(page);
    },
    maxSpare: PAGE_CLASSES[cls].maxSpare,
  });
}

export function pagePoolFor(textures: Phaser.Textures.TextureManager, cls: PageClass): PagePool<Phaser.Textures.DynamicTexture> {
  let pools = pagePools.get(textures);
  if (!pools) {
    pools = { strip: makePool(textures, "strip"), base: makePool(textures, "base") };
    pagePools.set(textures, pools);
  }
  return pools[cls];
}

/** A strip page for one planned page-height: pooled fixed-size normally; a dedicated
 * content-sized texture for the (today impossible) oversized-strip case. */
export function acquireStripPage(textures: Phaser.Textures.TextureManager, height: number): Phaser.Textures.DynamicTexture {
  if (height <= MAX_PAGE_HEIGHT_PX) return pagePoolFor(textures, "strip").acquire();
  return createPage(textures, height);
}

/** Returns a page to its pool — or really removes a dedicated oversized strip page. */
export function releasePage(page: Phaser.Textures.DynamicTexture, cls: PageClass): void {
  if (cls === "strip" && page.height > MAX_PAGE_HEIGHT_PX) {
    page.manager.remove(page);
    return;
  }
  pagePoolFor(page.manager, cls).release(page);
}
