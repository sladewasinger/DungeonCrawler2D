import Phaser from "phaser";
import { SCREEN_TILE_PX } from "../../../boot/assetManifest.js";
import type { GroundLightRevealCell } from "../ground/groundLightTypes.js";
import { lightingColor, LIGHTING_VISUAL_STYLE } from "../lightingVisualStyle.js";
import { ensureDarknessRevealBrush } from "./darknessRevealBrush.js";
import {
  darknessScreenSpaceTransform,
  darknessRevealStamp,
  sameDarknessRevealCamera,
  type DarknessRevealCamera,
  type DarknessRevealTextureScale,
} from "./darknessRevealProjection.js";

const DARKNESS = LIGHTING_VISUAL_STYLE.darkness;

export interface DarknessPassInput {
  readonly enabled: boolean;
  readonly downscale: number;
  readonly depth: number;
  readonly revealCells: readonly GroundLightRevealCell[];
  readonly revealChanged: boolean;
}

interface DarknessPaintContext {
  readonly camera: DarknessRevealCamera;
  readonly textureScale: DarknessRevealTextureScale;
}

/**
 * A low-resolution black surface with soft erased holes. It lives above the world,
 * so reveal restores the scene's natural pixels rather than drawing white over actors.
 */
export class DarknessPass {
  private readonly mask: Phaser.GameObjects.RenderTexture;
  private width = 0;
  private height = 0;
  private downscale = 0;
  private enabled = false;
  private paintedCamera: DarknessRevealCamera | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.mask = scene.add.renderTexture(0, 0, 2, 2)
      .setOrigin(0)
      .setScrollFactor(0);
    this.mask.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  update(input: DarknessPassInput): void {
    const resized = this.ensureTextureSize(input.downscale);
    const enabledChanged = this.enabled !== input.enabled;
    const camera = this.captureCamera();
    const cameraChanged = !sameDarknessRevealCamera(this.paintedCamera, camera);
    this.enabled = input.enabled;
    if (input.enabled && (resized || enabledChanged || input.revealChanged || cameraChanged)) {
      this.paintReveal(input.revealCells, camera);
      this.paintedCamera = camera;
    }
    const alpha = input.enabled
      ? DARKNESS.outsideAlpha
      : DARKNESS.insideAlpha;
    this.presentMask(camera, input.depth)
      .setAlpha(alpha)
      .setVisible(alpha > 0);
  }

  dispose(): void {
    this.mask.destroy();
  }

  private ensureTextureSize(downscale: number): boolean {
    const width = Math.max(2, Math.ceil(this.scene.cameras.main.width / downscale));
    const height = Math.max(2, Math.ceil(this.scene.cameras.main.height / downscale));
    if (this.width === width && this.height === height && this.downscale === downscale) {
      return false;
    }
    this.width = width;
    this.height = height;
    this.downscale = downscale;
    this.mask.resize(width, height);
    return true;
  }

  private paintReveal(
    cells: readonly GroundLightRevealCell[],
    camera: DarknessRevealCamera,
  ): void {
    const textureScale = this.textureScale(camera);
    const context = { camera, textureScale };
    this.mask.clear().fill(lightingColor(DARKNESS.color));
    for (const cell of cells) this.eraseCell(cell, context);
    this.mask.render();
  }

  private eraseCell(
    cell: GroundLightRevealCell,
    context: DarknessPaintContext,
  ): void {
    const { camera, textureScale } = context;
    const stamp = darknessRevealStamp(cell, camera, textureScale);
    const brush = ensureDarknessRevealBrush(
      this.scene,
      cell.brushRadiusTiles * SCREEN_TILE_PX * camera.zoom / textureScale.x,
      cell.brushAlpha * cell.strength,
    );
    this.mask.erase(brush, stamp.x, stamp.y);
  }

  private captureCamera(): DarknessRevealCamera {
    const camera = this.scene.cameras.main;
    return {
      centerX: camera.midPoint.x,
      centerY: camera.midPoint.y,
      rotation: camera.rotation,
      zoom: camera.zoom,
      viewportWidth: camera.width,
      viewportHeight: camera.height,
    };
  }

  private presentMask(
    camera: DarknessRevealCamera,
    depth: number,
  ): Phaser.GameObjects.RenderTexture {
    const transform = darknessScreenSpaceTransform(
      camera,
      this.textureScale(camera),
    );
    return this.mask
      .setPosition(transform.x, transform.y)
      .setRotation(transform.rotation)
      .setScale(transform.scaleX, transform.scaleY)
      .setDepth(depth);
  }

  private textureScale(
    camera: DarknessRevealCamera,
  ): DarknessRevealTextureScale {
    return {
      x: camera.viewportWidth / this.width,
      y: camera.viewportHeight / this.height,
    };
  }
}
