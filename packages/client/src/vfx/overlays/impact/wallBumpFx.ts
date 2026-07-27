// Owns the wall-contact flash. The earlier player-position nudge was removed because
// its repeated push-and-return looked exactly like prediction reconciliation jitter.
import type Phaser from "phaser";
import { WallBumpFlashPool } from "./wallBumpFlash.js";
import type { WallBumpVfxInput } from "../../system/vfxSystemTypes.js";

export class WallBumpFx {
  private readonly flash: WallBumpFlashPool;

  constructor(scene: Phaser.Scene) {
    this.flash = new WallBumpFlashPool(scene);
  }

  /** Fires feedback at the contact point without moving the player presentation. */
  trigger(input: WallBumpVfxInput): void {
    this.flash.spawn(input);
  }

  update(nowMs: number): void {
    this.flash.update(nowMs);
  }

  dispose(): void {
    this.flash.dispose();
  }
}
