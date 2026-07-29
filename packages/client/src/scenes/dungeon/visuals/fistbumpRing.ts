/**
 * Radial hold-progress ring over the fistbump target (Epic 7.10): while F (or the
 * touch interact button) is held with a player in range, a gold arc sweeps 0..360°
 * over the target; it vanishes on release/fire. One pooled Graphics object, redrawn
 * only while visible — zero cost when idle.
 */
import type Phaser from "phaser";
import { drawHoldProgressRing } from "../../../render/entities/presentation/holdProgressRing.js";

/** Above every entity sprite (world depth-sorts are y-based and far smaller). */
const RING_DEPTH = 100000;

export class FistbumpRing {
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(RING_DEPTH).setVisible(false);
  }

  /** Draws the ring at a screen-space (world camera) position with progress 0..1; null hides it. */
  update(state: { x: number; y: number; progress: number } | null): void {
    if (!state) {
      this.graphics.setVisible(false);
      return;
    }
    this.graphics.setVisible(true);
    drawHoldProgressRing({
      graphics: this.graphics,
      x: state.x,
      y: state.y,
      progress: state.progress,
    });
  }

  dispose(): void {
    this.graphics.destroy();
  }
}
