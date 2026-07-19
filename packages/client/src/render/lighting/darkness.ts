// Darkness overlay: one full-screen ambient-dark rectangle. Lights do NOT punch
// holes in it — the additive glow pool renders ABOVE this rect, so lit areas are
// warm additive pools over dark stone. No RenderTextures, no masks: the two
// techniques tried before (per-frame RT erase, inverted BitmapMask) both proved
// fragile alongside many baked-terrain RTs, and this one cannot fail.
import Phaser from "phaser";

const DARKNESS_DEPTH = 300_000;
/** The doc's near-black void hex. */
const DARKNESS_COLOR = 0x14141c;
/** Ambient ≈ 1 - this alpha, landing in VISUAL_DIRECTION's 15-25% band. */
const DARKNESS_ALPHA = 0.78;

export class DarknessOverlay {
  private readonly rect: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.rect = scene.add
      .rectangle(0, 0, cam.width, cam.height, DARKNESS_COLOR, DARKNESS_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DARKNESS_DEPTH);
  }

  /** Tracks viewport size; the glow pool (above this rect) owns everything light-shaped. */
  redraw(): void {
    const cam = this.scene.cameras.main;
    if (this.rect.width !== cam.width || this.rect.height !== cam.height) {
      this.rect.setSize(cam.width, cam.height);
    }
  }

  dispose(): void {
    this.rect.destroy();
  }
}
