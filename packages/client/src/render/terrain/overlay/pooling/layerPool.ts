import type Phaser from "phaser";

const OVERLAY_DEPTH_BIAS: Readonly<Record<string, number>> = {
  surface: 0.01,
  ao: 0.02,
  "cliff-rim": 0.03,
};

/** Shares one Graphics object per terrain depth across overlay renderers. */
export class TerrainOverlayLayerPool {
  private readonly layers = new Map<string, Phaser.GameObjects.Graphics>();
  private readonly active = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  beginFrame(): void {
    this.active.clear();
    for (const layer of this.layers.values()) layer.clear().setVisible(false);
  }

  acquire(namespace: string, depth: number, visible: boolean): Phaser.GameObjects.Graphics {
    const key = `${namespace}:${depth}`;
    const layer = this.layers.get(key) ?? this.create(key, depth);
    this.active.add(key);
    layer.setVisible(visible);
    return layer;
  }

  endFrame(): void {
    for (const [depth, layer] of this.layers) {
      if (this.active.has(depth)) continue;
      layer.destroy();
      this.layers.delete(depth);
    }
  }

  setVisible(visible: boolean): void {
    for (const [depth, layer] of this.layers) {
      layer.setVisible(visible && this.active.has(depth));
    }
  }

  activeKeys(): readonly string[] {
    return [...this.active].sort();
  }

  destroy(): void {
    for (const layer of this.layers.values()) layer.destroy();
    this.layers.clear();
    this.active.clear();
  }

  private create(key: string, depth: number): Phaser.GameObjects.Graphics {
    const namespace = key.slice(0, key.indexOf(":"));
    const layer = this.scene.add.graphics().setDepth(
      depth + (OVERLAY_DEPTH_BIAS[namespace] ?? 0),
    );
    this.layers.set(key, layer);
    return layer;
  }
}
