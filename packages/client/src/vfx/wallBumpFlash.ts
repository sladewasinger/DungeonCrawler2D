// Wall-bump edge flash: a faint flash at the contact point when sustained blocked
// movement crosses the throttle in input/wallBump.ts (panel round 3b item 4) — the deny
// cue's visible half (wallBumpNudge.ts is the sprite-nudge half). One reused Graphics
// object since only ever one bump is active for the self player at a time.
import type Phaser from "phaser";
import { worldToScreen } from "../render/entities/worldToScreen.js";
import { wallBumpFlashAlpha } from "./wallBumpFlashMotion.js";

const FLASH_COLOR = 0xe8e8e8;
const FLASH_RADIUS_PX = 10;
const FLASH_DEPTH = 400_000;
/** Roughly a body-radius ahead of the player, toward the wall — the flash reads as
 * "at the contact point" rather than centered on the player's own feet. */
const CONTACT_OFFSET_TILES = 0.6;

export class WallBumpFlashPool {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private triggeredAtMs = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(FLASH_DEPTH).setVisible(false);
  }

  /** (Re)draws the flash at (worldX, worldY) offset toward (dirX, dirY) — the direction
   * the player was pushing into the wall. */
  spawn(worldX: number, worldY: number, dirX: number, dirY: number, nowMs: number): void {
    const len = Math.hypot(dirX, dirY);
    const nx = len > 0 ? dirX / len : 0;
    const ny = len > 0 ? dirY / len : 0;
    const screen = worldToScreen(worldX + nx * CONTACT_OFFSET_TILES, worldY + ny * CONTACT_OFFSET_TILES);
    this.gfx.clear();
    this.gfx.fillStyle(FLASH_COLOR, 1);
    this.gfx.fillCircle(screen.x, screen.y, FLASH_RADIUS_PX);
    this.gfx.setVisible(true).setAlpha(wallBumpFlashAlpha(0));
    this.triggeredAtMs = nowMs;
  }

  update(nowMs: number): void {
    const alpha = wallBumpFlashAlpha(nowMs - this.triggeredAtMs);
    this.gfx.setAlpha(alpha).setVisible(alpha > 0);
  }

  dispose(): void {
    this.gfx.destroy();
  }
}
