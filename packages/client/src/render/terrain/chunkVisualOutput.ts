import type Phaser from "phaser";
import { CHUNK_BAKE_PX } from "./chunkBuildPolicy.js";
import type { PackedStrip } from "./stripAtlas.js";
import type { PendingStrip } from "./stripRows.js";
import { createDoorLabel, type StructureMap } from "./structures.js";
import { createTerrainPageImage } from "./terrainPageImage.js";

export function createStructureOverlays(
  scene: Phaser.Scene,
  structures: StructureMap,
): Phaser.GameObjects.Text[] {
  const overlays: Phaser.GameObjects.Text[] = [];
  for (const door of structures.doors) {
    const label = createDoorLabel(scene, door);
    if (label) overlays.push(label);
  }
  return overlays;
}

export function createStripPageImage(
  scene: Phaser.Scene,
  originBakeX: number,
  strip: PendingStrip,
  packed: PackedStrip,
  page: Phaser.Textures.DynamicTexture,
  index: number,
): Phaser.GameObjects.Image {
  strip.container.destroy(true);
  page.add(`s${index}`, 0, 0, packed.bandY, CHUNK_BAKE_PX, strip.stripHeightBakePx);
  return createTerrainPageImage(
    scene,
    originBakeX,
    strip.stripTopBakePx,
    page,
    strip.depth,
    "terrain-strip",
    `s${index}`,
  );
}
