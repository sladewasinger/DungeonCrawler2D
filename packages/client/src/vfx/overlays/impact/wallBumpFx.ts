// Owns the wall-contact flash. The earlier player-position nudge was removed because
// its repeated push-and-return looked exactly like prediction reconciliation jitter.
import type Phaser from "phaser";
import { WallBumpFlashPool } from "./wallBumpFlash.js";
import type { WallBumpVfxInput } from "../../system/vfxSystemTypes.js";

// Retained for a possible future contact cue, but intentionally disabled while
// the movement/collision feedback is being reworked.
const WALL_BUMP_FLASH_ENABLED = false;

export class WallBumpFx {
  private readonly flash: WallBumpFlashPool;

  constructor(scene: Phaser.Scene) {
    this.flash = new WallBumpFlashPool(scene);
  }

  /** Fires feedback at the contact point without moving the player presentation. */
  trigger(input: WallBumpVfxInput): void {
    if (!WALL_BUMP_FLASH_ENABLED) return;
    this.flash.spawn(input);
  }

  update(nowMs: number): void {
    this.flash.update(nowMs);
  }

  dispose(): void {
    this.flash.dispose();
  }
}
