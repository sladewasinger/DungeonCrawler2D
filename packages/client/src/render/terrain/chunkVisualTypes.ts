/** Defines the GPU-backed resources owned by one completed terrain chunk visual. */
import type Phaser from "phaser";

export interface ChunkVisual {
  readonly cx: number;
  readonly cy: number;
  readonly below: Phaser.GameObjects.Image;
  readonly belowPage: Phaser.Textures.DynamicTexture;
  readonly occluders: readonly Phaser.GameObjects.Image[];
  readonly atlasPages: readonly Phaser.Textures.DynamicTexture[];
}

export interface ChunkVisualBuilder {
  readonly cx: number;
  readonly cy: number;
  step(): ChunkVisual | null;
  cancel(): void;
}
