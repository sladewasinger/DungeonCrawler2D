// Builds/destroys one chunk's base terrain and per-row occluder containers.
import { CHUNK_SIZE } from "@dc2d/engine";
import type { TerrainWorld } from "./terrainWorld.js";
import type Phaser from "phaser";
import { BASE_TERRAIN_DEPTH, depthForOccluder } from "../entities/depthSort.js";
import { drawTile } from "./drawTile.js";
import { buildStructureMap, drawDoor } from "./structures.js";

export interface ChunkVisual {
  readonly cx: number;
  readonly cy: number;
  readonly below: Phaser.GameObjects.Container;
  readonly occluders: readonly Phaser.GameObjects.Container[];
}

/** Generates one base container plus row-sorted wall/structure containers. */
export function buildChunkVisual(scene: Phaser.Scene, world: TerrainWorld, cx: number, cy: number): ChunkVisual {
  const below = scene.add.container(0, 0).setDepth(BASE_TERRAIN_DEPTH);
  const occluders = new Map<number, Phaser.GameObjects.Container>();
  const occluderFor = (wy: number): Phaser.GameObjects.Container => {
    let row = occluders.get(wy);
    if (!row) {
      row = scene.add.container(0, 0).setDepth(depthForOccluder(wy + 1));
      occluders.set(wy, row);
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
  return { cx, cy, below, occluders: [...occluders.values()] };
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy(true);
  for (const row of visual.occluders) row.destroy(true);
}
