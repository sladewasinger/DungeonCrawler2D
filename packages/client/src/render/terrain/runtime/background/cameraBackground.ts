import type Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../../boot/assetManifest.js";
import type { ViewOrientation } from "../../../view/orientation/viewOrientation.js";
import type { ViewRect } from "../../../terrain/streaming/streaming.js";
import { viewToWorld } from "../../../view/transform/viewTransform.js";
import { terrainCameraBackground } from "../renderSupport.js";
import { roomTerrainPresentation } from "../roomPresentation.js";

/** Keeps the uncovered room exterior distinct without changing dungeon color. */
export class TerrainCameraBackground {
  private color: string | null = null;

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  sync(
    view: ViewRect,
    orientation: ViewOrientation,
    overrideColor?: string,
  ): void {
    const centerView = {
      x: (view.x + view.width / 2) / SCREEN_TILE_PX,
      y: (view.y + view.height / 2) / SCREEN_TILE_PX,
    };
    const centerWorld = viewToWorld(centerView, orientation);
    const mode = roomTerrainPresentation(centerWorld.y).mode;
    const color = overrideColor ?? terrainCameraBackground(mode);
    if (color === this.color) return;
    this.camera.setBackgroundColor(color);
    this.color = color;
  }
}
