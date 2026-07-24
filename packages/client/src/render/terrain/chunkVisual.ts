/** Exposes synchronous and incremental terrain-chunk builds plus completed-visual disposal. */
import type Phaser from "phaser";
import type { TerrainWorld } from "./terrainWorld.js";
import type { ViewOrientation } from "../view/viewOrientation.js";
import { IncrementalChunkVisualBuilder } from "./chunkVisualBuilder.js";
import type { DynamicLightSeed } from "./tileLight.js";
import { releasePage } from "./terrainPages.js";
import type { ChunkVisual, ChunkVisualBuilder } from "./chunkVisualTypes.js";

export type { ChunkVisual } from "./chunkVisualTypes.js";
export type { ChunkVisualBuilder } from "./chunkVisualTypes.js";

export function createChunkVisualBuilder(
  scene: Phaser.Scene,
  world: TerrainWorld,
  cx: number,
  cy: number,
  orientation: ViewOrientation,
  dynamicLights: readonly DynamicLightSeed[] = [],
): ChunkVisualBuilder {
  return new IncrementalChunkVisualBuilder(scene, world, cx, cy, orientation, dynamicLights);
}

export function buildChunkVisual(
  scene: Phaser.Scene,
  world: TerrainWorld,
  cx: number,
  cy: number,
  orientation: ViewOrientation,
  dynamicLights: readonly DynamicLightSeed[] = [],
): ChunkVisual {
  const builder = createChunkVisualBuilder(scene, world, cx, cy, orientation, dynamicLights);
  while (true) {
    const visual = builder.step();
    if (visual) return visual;
  }
}

export function destroyChunkVisual(visual: ChunkVisual): void {
  visual.below.destroy();
  for (const row of visual.occluders) row.destroy();
  releasePage(visual.belowPage, "base");
  for (const page of visual.atlasPages) releasePage(page, "strip");
}
