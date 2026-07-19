// Builds/destroys one chunk's terrain: scans composed structures first (their
// footprints suppress tile art), draws every tile, then draws each structure
// assembly last so it sits over the wall it is punched into.
import { CHUNK_SIZE, type World } from "@dc2d/engine";
import type Phaser from "phaser";
import { drawTile } from "./drawTile.js";
import { buildStructureMap, drawDoor } from "./structures.js";

export interface ChunkVisual {
  readonly cx: number;
  readonly cy: number;
  readonly below: Phaser.GameObjects.Container;
  readonly above: Phaser.GameObjects.Container;
}

/** Generates chunk (cx, cy) and draws every tile + structure into a fresh pair of containers. */
export function buildChunkVisual(scene: Phaser.Scene, world: World, cx: number, cy: number): ChunkVisual {
  const below = scene.add.container(0, 0);
  const above = scene.add.container(0, 0);
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
      drawTile(scene, world, baseX + lx, baseY + ly, below, above, structures);
    }
  }
  for (const door of structures.doors) drawDoor(scene, below, door);
  return { cx, cy, below, above };
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy(true);
  visual.above.destroy(true);
}
