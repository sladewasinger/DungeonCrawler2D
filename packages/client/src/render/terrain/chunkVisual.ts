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

/** Rows above an occluder row its sprites may overhang (caps at wy-1, lintels/pillars up to wy-2). */
const ROW_OVERHANG_TILES = 2;
const CHUNK_PX = CHUNK_SIZE * SCREEN_TILE_PX;

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

/** Generates chunk (cx, cy), draws every tile + structure, and bakes the result into static textures. */
export function buildChunkVisual(scene: Phaser.Scene, world: TerrainWorld, cx: number, cy: number): ChunkVisual {
  const below = scene.add.container(0, 0);
  const rows = new Map<number, Phaser.GameObjects.Container>();
  const occluderFor = (wy: number): Phaser.GameObjects.Container => {
    let row = rows.get(wy);
    if (!row) {
      row = scene.add.container(0, 0);
      rows.set(wy, row);
    }
    return row;
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
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wy = baseY + ly;
      drawTile(scene, world, baseX + lx, wy, below, occluderFor(wy), structures);
    }
  }
  for (const door of structures.doors) drawDoor(scene, occluderFor(door.wy), door);

  const originX = baseX * SCREEN_TILE_PX;
  const bakedBelow = bake(scene, below, originX, baseY * SCREEN_TILE_PX, CHUNK_PX, CHUNK_PX, BASE_TERRAIN_DEPTH);
  return { cx, cy, below: bakedBelow, occluders: bakeRows(scene, rows, originX) };
}

/** Bakes each non-empty occluder row into a strip RT tall enough for its sprite overhang. */
function bakeRows(
  scene: Phaser.Scene,
  rows: ReadonlyMap<number, Phaser.GameObjects.Container>,
  originX: number,
): Phaser.GameObjects.RenderTexture[] {
  const baked: Phaser.GameObjects.RenderTexture[] = [];
  for (const [wy, row] of rows) {
    if (row.list.length === 0) {
      row.destroy(true);
      continue;
    }
    const stripTop = (wy - ROW_OVERHANG_TILES) * SCREEN_TILE_PX;
    const stripHeight = (ROW_OVERHANG_TILES + 1) * SCREEN_TILE_PX;
    baked.push(bake(scene, row, originX, stripTop, CHUNK_PX, stripHeight, depthForOccluder(wy + 1)));
  }
  return baked;
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy();
  for (const row of visual.occluders) row.destroy();
}
