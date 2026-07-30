import Phaser from "phaser";
import { TOON_LIGHTING_TUNING } from "../toonLightingTuning.js";
import type { ToonVisibilityField } from "../toonVisibilityField.js";
import {
  toonCameraTransform,
  toonCameraTransformChanged,
  type ToonCameraTransform,
} from "./cameraTransform.js";

/**
 * Phaser 4's WebGL Mask filter captures exactly one Graphics object. The graphics
 * remains in the world/view seam, and the filter is refreshed only when that camera
 * seam moves or when the cached LOS field itself changes.
 */
export class ToonVisibilityMask {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private filter: Phaser.Filters.Mask | null = null;
  private lastField: ToonVisibilityField | null = null;
  private lastCamera: ToonCameraTransform | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    scene.cameras.main.ignore(this.graphics);
  }

  sync(field: ToonVisibilityField, cameraRotationRad: number): void {
    const changed = field !== this.lastField;
    if (changed) this.drawField(field);
    this.ensureFilter();
    if (changed ||
        toonCameraTransformChanged(
          this.lastCamera,
          this.scene.cameras.main,
          cameraRotationRad,
        )) {
      this.requestFilterRefresh();
    }
    this.lastField = field;
    this.lastCamera = toonCameraTransform(
      this.scene.cameras.main,
      cameraRotationRad,
    );
  }

  clear(): void {
    if (this.filter) this.scene.cameras.main.filters.external.remove(this.filter);
    this.filter = null;
    this.graphics.clear();
    this.lastField = null;
    this.lastCamera = null;
  }

  dispose(): void {
    this.clear();
    this.graphics.destroy();
  }

  maskObjectCount(): number {
    return this.filter ? TOON_LIGHTING_TUNING.maximumMaskObjects : 0;
  }

  private ensureFilter(): void {
    if (this.filter) return;
    const filter = this.scene.cameras.main.filters.external.addMask(
      this.graphics,
      false,
      this.scene.cameras.main,
      "world",
      TOON_LIGHTING_TUNING.maskScaleFactor,
    );
    filter.autoUpdate = false;
    this.filter = filter;
  }

  private drawField(field: ToonVisibilityField): void {
    this.graphics.clear();
    this.graphics.fillStyle(0xffffff, 1);
    for (const rect of field.maskRects) {
      this.graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  private requestFilterRefresh(): void {
    if (this.filter) this.filter.needsUpdate = true;
  }
}
