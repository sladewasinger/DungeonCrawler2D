import type Phaser from "phaser";
import type { ChunkVisual } from "./chunkVisualTypes.js";
import { releasePage } from "./terrainPages.js";

export function cancelChunkVisualBuild(
  baseImage: Phaser.GameObjects.Image | null,
  images: readonly Phaser.GameObjects.Image[],
  overlays: readonly Phaser.GameObjects.Text[],
  rowContainers: readonly Phaser.GameObjects.Container[],
  basePage: Phaser.Textures.DynamicTexture | null,
  pages: readonly Phaser.Textures.DynamicTexture[],
): void {
  baseImage?.destroy();
  for (const image of images) image.destroy();
  for (const overlay of overlays) overlay.destroy();
  for (const container of rowContainers) if (container.active) container.destroy(true);
  if (basePage) releasePage(basePage, "base");
  for (const page of pages) releasePage(page, "strip");
}

export function finishChunkVisual(
  cx: number,
  cy: number,
  below: Phaser.GameObjects.Image,
  belowPage: Phaser.Textures.DynamicTexture,
  occluders: readonly Phaser.GameObjects.Image[],
  overlays: readonly Phaser.GameObjects.Text[],
  atlasPages: readonly Phaser.Textures.DynamicTexture[],
): ChunkVisual {
  below.setVisible(true);
  for (const image of occluders) image.setVisible(true);
  for (const overlay of overlays) overlay.setVisible(true);
  return { cx, cy, below, belowPage, occluders, overlays, atlasPages };
}
