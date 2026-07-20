// Fade-through-black transition: a full-screen black rectangle driven by
// teleportFadeMotion.ts's curve, triggered on any "teleported" wire event (doors and,
// once wired, stairway descend/ascend). Mirrors levelUpFlourish.ts's shape.
import type Phaser from "phaser";
import { isTeleportFadeExpired, teleportFadeAlpha } from "./teleportFadeMotion.js";

const FADE_DEPTH = 500_002;

export class TeleportFade {
  private readonly overlay: Phaser.GameObjects.Rectangle;
  private spawnMs = -Infinity;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.overlay = scene.add
      .rectangle(0, 0, width, height, 0x000000, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(FADE_DEPTH);
  }

  trigger(nowMs: number): void {
    this.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    this.overlay.setSize(this.scene.scale.width, this.scene.scale.height);
    const elapsed = nowMs - this.spawnMs;
    this.overlay.setAlpha(isTeleportFadeExpired(elapsed) ? 0 : teleportFadeAlpha(elapsed));
  }

  dispose(): void {
    this.overlay.destroy();
  }
}
