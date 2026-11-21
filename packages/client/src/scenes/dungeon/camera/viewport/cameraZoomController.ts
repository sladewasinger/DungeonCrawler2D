import type Phaser from "phaser";
import {
  boundedGameplayCameraViewport,
  responsiveGameplayCameraZoom,
} from "./responsiveCameraScale.js";

export interface CameraZoomEffectPort {
  setKillPunchMultiplier(multiplier: number): void;
}

/** The sole owner of responsive baseline zoom and transient combat zoom effects. */
export class DungeonCameraZoomController implements CameraZoomEffectPort {
  private baselineZoom = 1;
  private killPunchMultiplier = 1;

  constructor(private readonly scene: Phaser.Scene) {}

  syncPresentation(presentationZoom = 1, mobile = false): void {
    const viewport = { width: this.scene.scale.width, height: this.scene.scale.height };
    const bounded = boundedGameplayCameraViewport(viewport);
    this.scene.cameras.main.setViewport(bounded.x, bounded.y, bounded.width, bounded.height);
    this.baselineZoom = responsiveGameplayCameraZoom(viewport, presentationZoom, mobile);
    this.applyZoom();
  }

  setKillPunchMultiplier(multiplier: number): void {
    this.killPunchMultiplier = multiplier;
    this.applyZoom();
  }

  private applyZoom(): void {
    this.scene.cameras.main.setZoom(this.baselineZoom * this.killPunchMultiplier);
  }
}
