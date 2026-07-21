// Combines the wall-bump sprite-nudge state and contact-point flash pool behind one
// object (panel round 3b item 4) so VfxSystem's own facade only needs one field/one
// constructor line for the whole deny cue, instead of two of each.
import type Phaser from "phaser";
import { WallBumpFlashPool } from "./wallBumpFlash.js";
import { WallBumpNudge } from "./wallBumpNudge.js";

export class WallBumpFx {
  private readonly nudge = new WallBumpNudge();
  private readonly flash: WallBumpFlashPool;

  constructor(scene: Phaser.Scene) {
    this.flash = new WallBumpFlashPool(scene);
  }

  /** Fires the contact-point flash and starts the sprite-nudge window. */
  trigger(worldX: number, worldY: number, dirX: number, dirY: number, nowMs: number): void {
    this.flash.spawn(worldX, worldY, dirX, dirY, nowMs);
    this.nudge.trigger(dirX, dirY, nowMs);
  }

  /** This frame's sprite-nudge offset, world tiles. */
  offset(nowMs: number): { x: number; y: number } {
    return this.nudge.offset(nowMs);
  }

  update(nowMs: number): void {
    this.flash.update(nowMs);
  }

  dispose(): void {
    this.flash.dispose();
  }
}
