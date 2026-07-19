// Darkness overlay: one camera-sized RenderTexture, refilled to near-black ambient each
// frame and punched with soft holes at every active light — VISUAL_DIRECTION's "darkness
// is the canvas" rule made literal. Erase positions are screen-space (viewport-fixed
// overlay), so it never needs to track the camera's own scroll transform itself.
import type Phaser from "phaser";
import { ASSET_KEYS, SCREEN_TILE_PX } from "../../boot/assetManifest.js";
import { flickerScale, type LightSource } from "./lightSource.js";

const DARKNESS_DEPTH = 300_000;
/** The doc's near-black void hex. */
const DARKNESS_COLOR = 0x14141c;
/** Ambient ≈ 1 - this alpha, landing in VISUAL_DIRECTION's 15-25% band. */
const DARKNESS_ALPHA = 0.78;
const LIGHT_FRAME = "light_soft";
const LIGHT_SOURCE_PX = 64;

export class DarknessOverlay {
  private readonly texture: Phaser.GameObjects.RenderTexture;
  private readonly brush: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    const cam = scene.cameras.main;
    this.texture = scene.add
      .renderTexture(0, 0, cam.width, cam.height)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DARKNESS_DEPTH);
    this.brush = scene.make.image({ key: ASSET_KEYS.atlas, frame: LIGHT_FRAME, add: false });
  }

  /** Refills the overlay to ambient darkness, then erases a soft hole per light at its current screen position. */
  redraw(lights: readonly LightSource[], nowMs: number): void {
    const cam = this.scene.cameras.main;
    if (this.texture.width !== cam.width || this.texture.height !== cam.height) {
      this.texture.setSize(cam.width, cam.height);
    }
    this.texture.clear();
    this.texture.fill(DARKNESS_COLOR, DARKNESS_ALPHA);
    for (const light of lights) this.eraseHole(light, cam, nowMs);
  }

  /** World -> overlay-screen-space, honoring zoom (worldView is already the zoom-adjusted visible rect). */
  private eraseHole(light: LightSource, cam: Phaser.Cameras.Scene2D.Camera, nowMs: number): void {
    const screenX = (light.x * SCREEN_TILE_PX - cam.worldView.x) * cam.zoom;
    const screenY = (light.y * SCREEN_TILE_PX - cam.worldView.y) * cam.zoom;
    const scale = ((light.radiusTiles * 2 * SCREEN_TILE_PX) / LIGHT_SOURCE_PX) * flickerScale(nowMs, light.seed) * cam.zoom;
    this.brush.setScale(scale);
    this.texture.erase(this.brush, screenX, screenY);
  }

  dispose(): void {
    this.texture.destroy();
    this.brush.destroy();
  }
}
