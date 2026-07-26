import type Phaser from "phaser";
import { TERRAIN_DISPLAY_SCALE, terrainBakePxToDisplay } from "./terrainMetrics.js";

export function createTerrainPageImage(
  scene: Phaser.Scene,
  xBakePx: number,
  yBakePx: number,
  page: Phaser.Textures.DynamicTexture,
  depth: number,
  name: string,
  frame?: string,
): Phaser.GameObjects.Image {
  return scene.add.image(
    terrainBakePxToDisplay(xBakePx),
    terrainBakePxToDisplay(yBakePx),
    page,
    frame,
  ).setOrigin(0, 0)
    .setScale(TERRAIN_DISPLAY_SCALE)
    .setDepth(depth)
    .setName(name)
    .setVisible(false);
}
