// Builds/destroys one chunk's terrain, BAKED: tiles draw once into transient
// containers which are flattened into static POOLED textures (one full-chunk
// base page + a few shared strip-atlas pages holding every occluder row as a
// frame, each displayed by a cheap Image at its own depth — stripAtlas.ts plans
// the packing, terrainPages.ts pools the pages), then destroyed. A chunk costs
// a handful of framebuffer-backed textures instead of dozens — the fix for the
// ~580-resident-RT pipeline pressure (docs/ROADMAP.md), proven pixel-identical
// to the retired one-RT-per-strip model by the A/B camera-sweep capture.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { BASE_TERRAIN_DEPTH } from "../entities/depthSort.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { drawTile } from "./drawTile.js";
import { planStripAtlas } from "./stripAtlas.js";
import { acquireStripPage, pagePoolFor, releasePage } from "./terrainPages.js";
import {
  collectCapStrips,
  collectFaceStrips,
  makeCapOccluderFor,
  makeOccluderFor,
  type CapRow,
  type OccluderRow,
  type PendingStrip,
} from "./stripRows.js";
import { buildStructureMap, drawDoor } from "./structures.js";
import { computeLightField, type DynamicLightSeed } from "./tileLight.js";
import { viewChunkWorldOrigin, viewWorld } from "./viewWorld.js";

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

export interface ChunkVisual {
  readonly cx: number;
  readonly cy: number;
  /** The flat base sheet's display Image (backed by a pooled full-chunk page). */
  readonly below: Phaser.GameObjects.Image;
  /** The pooled full-chunk page `below` draws from — released with the chunk. */
  readonly belowPage: Phaser.Textures.DynamicTexture;
  /** One Image per occluder strip, positioned/depth-keyed exactly like the old per-strip RTs. */
  readonly occluders: readonly Phaser.GameObjects.Image[];
  /** The shared strip-atlas pages the occluder images draw from — released with the chunk. */
  readonly atlasPages: readonly Phaser.Textures.DynamicTexture[];
}

/** Flattens `container` (children at absolute world positions) into a pooled
 * full-chunk page displayed by an Image at (originX, originY) — the base-sheet
 * counterpart of bakeStripAtlas, sharing the same churn-avoiding pool. */
function bakeBase(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  originX: number,
  originY: number,
): { image: Phaser.GameObjects.Image; page: Phaser.Textures.DynamicTexture } {
  const page = pagePoolFor(scene.textures, "base").acquire();
  container.setPosition(-originX, -originY);
  page.draw(container);
  container.destroy(true);
  const image = scene.add
    .image(originX, originY, page)
    .setOrigin(0, 0)
    .setDepth(BASE_TERRAIN_DEPTH)
    .setName("terrain-base");
  return { image, page };
}

/**
 * Generates VIEW-space chunk (cx, cy) — its baked screen position is fixed at this
 * orientation, per the chunk cache policy in docs/ASSUMPTIONS.md — draws every tile +
 * structure, and bakes the result into static textures. `dynamicLights` seeds live
 * placed-torch sources into this bake — pass the caller's current set every time
 * (including plain re-streams), so a chunk that streams in after a torch is already
 * placed nearby bakes lit on first load.
 *
 * `(cx, cy)` name a VIEW chunk (streaming.ts's desiredChunks already runs purely off the
 * camera's on-screen rect, which is itself in view-pixel space once worldToScreen routes
 * through the seam — see worldToScreen.ts — so it needs no changes of its own). Every
 * per-tile face/edge/autotile decision reads the view-space proxy (viewWorld.ts) so it's
 * automatically screen-relative; the one genuinely world-space read — baked lighting's
 * BFS flood — needs this chunk's REAL world footprint, found via viewChunkWorldOrigin.
 */
export function buildChunkVisual(
  scene: Phaser.Scene,
  world: TerrainWorld,
  cx: number,
  cy: number,
  orientation: ViewOrientation,
  dynamicLights: readonly DynamicLightSeed[] = [],
): ChunkVisual {
  const below = scene.add.container(0, 0);
  const rows = new Map<number, OccluderRow>();
  const occluderFor = makeOccluderFor(scene, rows);
  const capRows = new Map<number, CapRow>();
  const capOccluderFor = makeCapOccluderFor(scene, capRows);
  const vw = viewWorld(world, orientation);
  const baseVX = cx * CHUNK_SIZE;
  const baseVY = cy * CHUNK_SIZE;
  const structures = buildStructureMap(
    (vx, vy) => vw.tileAt(vx, vy),
    baseVX,
    baseVY,
    baseVX + CHUNK_SIZE,
    baseVY + CHUNK_SIZE,
  );
  // Light is baked with the tiles: deterministic sources + BFS over the REAL world, so
  // every client bakes identical lighting and the per-frame cost is zero.
  const realOrigin = viewChunkWorldOrigin(baseVX, baseVY, CHUNK_SIZE, orientation);
  const light = computeLightField(world, realOrigin.x, realOrigin.y, CHUNK_SIZE, dynamicLights);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const vy = baseVY + ly;
      drawTile(scene, vw, baseVX + lx, vy, below, occluderFor, capOccluderFor, structures, light);
    }
  }
  for (const door of structures.doors) drawDoor(scene, occluderFor(door.wy), door);

  const originX = baseVX * SCREEN_TILE_PX;
  const base = bakeBase(scene, below, originX, baseVY * SCREEN_TILE_PX);
  const { images, pages } = bakeStripAtlas(scene, [...collectFaceStrips(rows), ...collectCapStrips(capRows)], originX);
  return { cx, cy, below: base.image, belowPage: base.page, occluders: images, atlasPages: pages };
}

/**
 * Bakes every pending strip into shared per-chunk DynamicTexture pages
 * (stripAtlas.ts's plan) and returns one Image per strip at the strip's exact
 * old screen position and depth — the pixels and painter ordering of the
 * retired one-RT-per-strip model at a fraction of the framebuffer count.
 */
function bakeStripAtlas(
  scene: Phaser.Scene,
  strips: readonly PendingStrip[],
  originX: number,
): { images: Phaser.GameObjects.Image[]; pages: Phaser.Textures.DynamicTexture[] } {
  const plan = planStripAtlas(strips.map((s) => s.stripHeight));
  const pages = plan.pageHeights.map((height) => acquireStripPage(scene.textures, height));
  // Same-length arrays by construction (planStripAtlas returns one entry per
  // input strip, and every packed.page indexes an allocated page).
  const placed = strips.map((strip, i) => ({ strip, packed: plan.strips[i]!, page: pages[plan.strips[i]!.page]! }));
  // One beginDraw/endDraw pass per PAGE, not per strip: every strip stamp inside
  // a single framebuffer bind (batchDraw), instead of ~25 bind+flush cycles per
  // page — the per-strip draw() overhead was measurable on the harness.
  pages.forEach((page) => {
    page.beginDraw();
    for (const { strip, packed, page: own } of placed) {
      if (own !== page) continue;
      strip.container.setPosition(-originX, packed.bandY - strip.stripTop);
      page.batchDraw(strip.container);
    }
    page.endDraw();
  });
  const images = placed.map(({ strip, packed, page }, i) => {
    strip.container.destroy(true);
    page.add(`s${i}`, 0, 0, packed.bandY, CHUNK_PX, strip.stripHeight);
    return scene.add
      .image(originX, strip.stripTop, page, `s${i}`)
      .setOrigin(0, 0)
      .setDepth(strip.depth)
      .setName("terrain-strip");
  });
  return { images, pages };
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy();
  for (const row of visual.occluders) row.destroy();
  // Images first (above), then their backing pages: pooled fixed-size pages park
  // for the next bake; a dedicated oversized strip page really leaves the manager
  // (releasePage's own discriminator).
  releasePage(visual.belowPage, "base");
  for (const page of visual.atlasPages) releasePage(page, "strip");
}
