import Phaser from "phaser";
import { TOON_LIGHTING_TUNING } from "./toonLightingTuning.js";
import type { ToonVisibilityField } from "./toonVisibilityField.js";

interface CameraTransformSignature {
  readonly x: number;
  readonly y: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly zoom: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Phaser 4's WebGL Mask filter captures exactly one Graphics object. The graphics
 * remains in the world/view seam, and the filter is refreshed only when that camera
 * seam moves or when the cached LOS field itself changes.
 */
export class ToonVisibilityMask {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private filter: Phaser.Filters.Mask | null = null;
  private lastField: ToonVisibilityField | null = null;
  private lastCamera: CameraTransformSignature | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    scene.cameras.main.ignore(this.graphics);
  }

  sync(field: ToonVisibilityField): void {
    const changed = field !== this.lastField;
    if (changed) this.drawField(field);
    this.ensureFilter();
    if (changed || cameraTransformChanged(this.lastCamera, this.scene.cameras.main)) {
      this.requestFilterRefresh();
    }
    this.lastField = field;
    this.lastCamera = cameraTransform(this.scene.cameras.main);
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

function cameraTransform(
  camera: Phaser.Cameras.Scene2D.Camera,
): CameraTransformSignature {
  return {
    x: camera.x,
    y: camera.y,
    scrollX: camera.scrollX,
    scrollY: camera.scrollY,
    zoom: camera.zoom,
    width: camera.width,
    height: camera.height,
  };
}

function cameraTransformChanged(
  previous: CameraTransformSignature | null,
  camera: Phaser.Cameras.Scene2D.Camera,
): boolean {
  if (!previous) return true;
  const next = cameraTransform(camera);
  return CAMERA_TRANSFORM_FIELDS.some((field) => previous[field] !== next[field]);
}

const CAMERA_TRANSFORM_FIELDS: readonly (keyof CameraTransformSignature)[] = [
  "x",
  "y",
  "scrollX",
  "scrollY",
  "zoom",
  "width",
  "height",
];
