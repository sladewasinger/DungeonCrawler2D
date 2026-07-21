// Builds/destroys one chunk's terrain, BAKED: tiles draw once into transient
// containers which are flattened into static RenderTextures (one base sheet +
// one strip per occluder row), then destroyed. A chunk costs a handful of
// textures instead of thousands of live GameObjects — the difference between
// 9 fps and a real frame rate at 20k tiles resident.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { BASE_TERRAIN_DEPTH, depthForCapOccluder, depthForOccluder } from "../entities/depthSort.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { drawTile, type OccluderFor } from "./drawTile.js";
import type { CapOccluderFor } from "./occluderBand.js";
import { buildStructureMap, drawDoor } from "./structures.js";
import { computeLightField, type DynamicLightSeed } from "./tileLight.js";
import { viewChunkWorldOrigin, viewWorld } from "./viewWorld.js";

const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

/**
 * One pending occluder strip: a face column bakes its dynamic rows (see
 * occluderBand.ts) into the strip of its ground-adjacent row, so `overhangTiles`
 * records the tallest such row and the bake covers exactly [wy - overhang, wy + 1].
 * Per-frame strip cost scales with baked height — a fixed MAX_FACE_ROWS-tall
 * strip (the 3 -> 16 pivot) made every visible wall row blit ~16 tiles of mostly
 * transparent pixels each frame, which is the measured e2e keystroke regression.
 */
interface OccluderRow {
  readonly container: Phaser.GameObjects.Container;
  overhangTiles: number;
}

export interface ChunkVisual {
  readonly cx: number;
  readonly cy: number;
  readonly below: Phaser.GameObjects.RenderTexture;
  readonly occluders: readonly Phaser.GameObjects.RenderTexture[];
}

/** Builds the occluderFor accessor: lazily creates one container per occluder row,
 * tracking the tallest overhang any caller has asked that row to bake. */
function makeOccluderFor(scene: Phaser.Scene, rows: Map<number, OccluderRow>): OccluderFor {
  return (wy: number, overhangTiles = 0): Phaser.GameObjects.Container => {
    let row = rows.get(wy);
    if (!row) {
      row = { container: scene.add.container(0, 0), overhangTiles: 0 };
      rows.set(wy, row);
    }
    row.overhangTiles = Math.max(row.overhangTiles, overhangTiles);
    return row.container;
  };
}

/**
 * A cell's shifted CAP strip, keyed to its OWN raw row `vy` (never a foot row —
 * a cap's own row is itself walkable ground, unlike a face band's wall cell).
 * Overhangs grow independently: a positive height only ever bleeds up, a
 * negative one only ever bleeds down.
 */
interface CapRow {
  readonly container: Phaser.GameObjects.Container;
  overhangAbove: number;
  overhangBelow: number;
}

/** Builds the capOccluderFor accessor (docs/ELEVATION-PROJECTION.md section 2):
 * a SEPARATE row-map from the face-band `rows` above — a cap's depth formula
 * differs from a band's (see bakeCapRows), so sharing one map would conflate
 * two different depth intents under the same row key. */
function makeCapOccluderFor(scene: Phaser.Scene, rows: Map<number, CapRow>): CapOccluderFor {
  return (vy: number, overhangAbove = 0, overhangBelow = 0): Phaser.GameObjects.Container => {
    let row = rows.get(vy);
    if (!row) {
      row = { container: scene.add.container(0, 0), overhangAbove: 0, overhangBelow: 0 };
      rows.set(vy, row);
    }
    row.overhangAbove = Math.max(row.overhangAbove, overhangAbove);
    row.overhangBelow = Math.max(row.overhangBelow, overhangBelow);
    return row.container;
  };
}

/** Flattens `container` (children at absolute world positions) into a static RT anchored at (originX, originY). */
function bake(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  originX: number,
  originY: number,
  width: number,
  height: number,
  depth: number,
): Phaser.GameObjects.RenderTexture {
  const rt = scene.add.renderTexture(originX, originY, width, height).setOrigin(0, 0).setDepth(depth);
  container.setPosition(-originX, -originY);
  rt.draw(container);
  container.destroy(true);
  return rt;
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
  const bakedBelow = bake(scene, below, originX, baseVY * SCREEN_TILE_PX, CHUNK_PX, CHUNK_PX, BASE_TERRAIN_DEPTH);
  const occluders = [...bakeRows(scene, rows, originX), ...bakeCapRows(scene, capRows, originX)];
  return { cx, cy, below: bakedBelow, occluders };
}

/** Bakes each non-empty occluder row into a strip RT exactly tall enough for its own content. */
function bakeRows(
  scene: Phaser.Scene,
  rows: ReadonlyMap<number, OccluderRow>,
  originX: number,
): Phaser.GameObjects.RenderTexture[] {
  const baked: Phaser.GameObjects.RenderTexture[] = [];
  for (const [wy, row] of rows) {
    if (row.container.list.length === 0) {
      row.container.destroy(true);
      continue;
    }
    const stripTop = (wy - row.overhangTiles) * SCREEN_TILE_PX;
    const stripHeight = (row.overhangTiles + 1) * SCREEN_TILE_PX;
    baked.push(bake(scene, row.container, originX, stripTop, CHUNK_PX, stripHeight, depthForOccluder(wy + 1)));
  }
  return baked;
}

/**
 * Bakes each non-empty CAP strip. Depth uses depthForCapOccluder(vy), NOT a
 * band's foot-row depthForOccluder formula: a cap's own row `vy` is walkable —
 * an entity standing anywhere on it (feetWorldY >= vy) must draw IN FRONT of
 * its own cap, while an entity at ANY fractional feet position strictly north
 * (feetWorldY < vy) must be occluded BY it. The previous
 * depthForOccluder(vy - 1) key only cleared feet at exactly vy - 1 (the row
 * boundary), so a body standing MID-row north of a raised south neighbor drew
 * over the cap that should hide its feet — the cliff-drop occlusion of
 * docs/ELEVATION-PROJECTION.md acceptance shot 1 never happened.
 */
function bakeCapRows(
  scene: Phaser.Scene,
  rows: ReadonlyMap<number, CapRow>,
  originX: number,
): Phaser.GameObjects.RenderTexture[] {
  const baked: Phaser.GameObjects.RenderTexture[] = [];
  for (const [vy, row] of rows) {
    if (row.container.list.length === 0) {
      row.container.destroy(true);
      continue;
    }
    const stripTop = (vy - row.overhangAbove) * SCREEN_TILE_PX;
    const stripHeight = (row.overhangAbove + 1 + row.overhangBelow) * SCREEN_TILE_PX;
    baked.push(bake(scene, row.container, originX, stripTop, CHUNK_PX, stripHeight, depthForCapOccluder(vy)));
  }
  return baked;
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy();
  for (const row of visual.occluders) row.destroy();
}
