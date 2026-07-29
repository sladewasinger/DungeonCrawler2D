import type Phaser from "phaser";
import { HIT_STOP_DURATION_MS, HIT_STOP_ZOOM } from "../hitStop.js";

/** A kill can retrigger mid-tween, so every punch anchors to one resting zoom. */
export class KillZoomPunch {
  private readonly restingZoom: number;
  private activePunch = 0;

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {
    this.restingZoom = camera.zoom;
  }

  trigger(): void {
    const punch = ++this.activePunch;
    const halfDuration = HIT_STOP_DURATION_MS / 2;
    this.camera.zoomTo(this.restingZoom * HIT_STOP_ZOOM, halfDuration, "Sine.easeOut", true, (_camera, progress) => {
      if (progress >= 1 && punch === this.activePunch) {
        this.camera.zoomTo(this.restingZoom, halfDuration, "Sine.easeIn");
      }
    });
  }
}
