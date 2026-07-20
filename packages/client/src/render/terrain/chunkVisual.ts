// Builds/destroys one chunk's terrain, BAKED: tiles draw once into transient
// containers which are flattened into static RenderTextures (one base sheet +
// one strip per occluder row), then destroyed. A chunk costs a handful of
// textures instead of thousands of live GameObjects — the difference between
// 9 fps and a real frame rate at 20k tiles resident.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { BASE_TERRAIN_DEPTH, depthForOccluder } from "../entities/depthSort.js";
import { drawTile } from "./drawTile.js";
import { buildStructureMap, drawDoor } from "./structures.js";
import { computeLightField, type DynamicLightSeed } from "./tileLight.js";

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
 * Generates chunk (cx, cy), draws every tile + structure, and bakes the result into
 * static textures. `dynamicLights` seeds live placed-torch sources into this bake —
 * pass the caller's current set every time (including plain re-streams), so a chunk
 * that streams in after a torch is already placed nearby bakes lit on first load.
 */
export function buildChunkVisual(
  scene: Phaser.Scene,
  world: TerrainWorld,
  cx: number,
  cy: number,
  dynamicLights: readonly DynamicLightSeed[] = [],
): ChunkVisual {
  const below = scene.add.container(0, 0);
  const rows = new Map<number, OccluderRow>();
  const occluderFor = (wy: number, overhangTiles = 0): Phaser.GameObjects.Container => {
    let row = rows.get(wy);
    if (!row) {
      row = { container: scene.add.container(0, 0), overhangTiles: 0 };
      rows.set(wy, row);
    }
    row.overhangTiles = Math.max(row.overhangTiles, overhangTiles);
    return row.container;
  };
  const baseX = cx * CHUNK_SIZE;
  const baseY = cy * CHUNK_SIZE;
  const structures = buildStructureMap(
    (wx, wy) => world.tileAt(wx, wy),
    baseX,
    baseY,
    baseX + CHUNK_SIZE,
    baseY + CHUNK_SIZE,
  );
  // Light is baked with the tiles: deterministic sources + BFS, so every client
  // bakes identical lighting and the per-frame cost is zero.
  const light = computeLightField(world, baseX, baseY, CHUNK_SIZE, dynamicLights);
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wy = baseY + ly;
      drawTile(scene, world, baseX + lx, wy, below, occluderFor, structures, light);
    }
  }
  for (const door of structures.doors) drawDoor(scene, occluderFor(door.wy), door);

  const originX = baseX * SCREEN_TILE_PX;
  const bakedBelow = bake(scene, below, originX, baseY * SCREEN_TILE_PX, CHUNK_PX, CHUNK_PX, BASE_TERRAIN_DEPTH);
  return { cx, cy, below: bakedBelow, occluders: bakeRows(scene, rows, originX) };
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

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy();
  for (const row of visual.occluders) row.destroy();
}
