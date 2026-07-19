// Screen-shake budget: own hits/deaths only, small and rate-limited so repeated hits
// don't stack into nausea — VISUAL_DIRECTION's "never from others' actions, multiplayer
// courtesy" rule.
import type Phaser from "phaser";

const HIT_SHAKE_MS = 90;
const HIT_SHAKE_INTENSITY = 0.006;
const DEATH_SHAKE_MS = 220;
const DEATH_SHAKE_INTENSITY = 0.012;
const MIN_INTERVAL_MS = 120;

export class ScreenShakeBudget {
  private lastTriggerMs = -Infinity;

  constructor(private readonly camera: Phaser.Cameras.Scene2D.Camera) {}

  /** Small shake for the local player's own landed hit — a no-op if too soon after the last trigger. */
  onOwnHit(nowMs: number): void {
    this.trigger(nowMs, HIT_SHAKE_MS, HIT_SHAKE_INTENSITY);
  }

  /** Slightly larger shake for the local player's own death. */
  onOwnDeath(nowMs: number): void {
    this.trigger(nowMs, DEATH_SHAKE_MS, DEATH_SHAKE_INTENSITY);
  }

  private trigger(nowMs: number, durationMs: number, intensity: number): void {
    if (nowMs - this.lastTriggerMs < MIN_INTERVAL_MS) return;
    this.lastTriggerMs = nowMs;
    this.camera.shake(durationMs, intensity);
  }
}
