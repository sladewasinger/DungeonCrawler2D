/**
 * Radial hold-progress ring over the fistbump target (Epic 7.10): while F (or the
 * touch interact button) is held with a player in range, a gold arc sweeps 0..360°
 * over the target; it vanishes on release/fire. One pooled Graphics object, redrawn
 * only while visible — zero cost when idle.
 */
import type Phaser from "phaser";
import { SELECTION_ACCENT } from "../../ui/panel.js";
import { HUD_SCALE } from "../../ui/hudScale.js";

const RADIUS_PX = 14 * HUD_SCALE;
const THICKNESS_PX = 3;
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
    this.graphics.clear();
    // Faint full track, then the sweep from 12 o'clock.
    this.graphics.lineStyle(THICKNESS_PX, SELECTION_ACCENT, 0.25);
    this.graphics.strokeCircle(state.x, state.y, RADIUS_PX);
    this.graphics.lineStyle(THICKNESS_PX, SELECTION_ACCENT, 0.95);
    this.graphics.beginPath();
    this.graphics.arc(state.x, state.y, RADIUS_PX, -Math.PI / 2, -Math.PI / 2 + state.progress * Math.PI * 2);
    this.graphics.strokePath();
  }

  dispose(): void {
    this.graphics.destroy();
  }
}
