import type Phaser from "phaser";
import { LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import { ensureFogTexture } from "./fogTexture.js";

const FOG = LIGHTING_VISUAL_STYLE.fog;

export interface FogLayerFrame {
  readonly enabled: boolean;
  readonly depth: number;
  readonly nowMs: number;
  readonly reducedMotion: boolean;
}

/** Two camera-fixed TileSprites, never a shader or a cloud of individual sprites. */
export class FogLayers {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private width = 0;
  private height = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    layerCount: number,
  ) {
    const texture = ensureFogTexture(scene);
    for (let index = 0; index < layerCount; index += 1) {
      this.layers.push(scene.add.tileSprite(0, 0, 2, 2, texture)
        .setOrigin(0)
        .setScrollFactor(0));
    }
  }

  update(frame: FogLayerFrame): void {
    this.resizeIfNeeded();
    for (let index = 0; index < this.layers.length; index += 1) {
      this.updateLayer(this.layers[index], index, frame);
    }
  }

  dispose(): void {
    for (const layer of this.layers) layer.destroy();
    this.layers.length = 0;
  }

  private resizeIfNeeded(): void {
    const { width, height } = this.scene.cameras.main;
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    for (const layer of this.layers) layer.setSize(width, height);
  }

  private updateLayer(
    layer: Phaser.GameObjects.TileSprite | undefined,
    index: number,
    frame: FogLayerFrame,
  ): void {
    if (!layer) return;
    const speed = frame.reducedMotion ? 0 : FOG.speedPxPerSecond[index] ?? 0;
    const scale = FOG.scale[index] ?? 1;
    layer.setPosition(0, 0)
      .setDepth(frame.depth + 0.02 + index * 0.001)
      .setScale(scale)
      .setAlpha(FOG.alpha[index] ?? 0)
      .setVisible(frame.enabled);
    layer.setTilePosition(frame.nowMs * speed / 1000, frame.nowMs * speed / 1700);
  }
}
