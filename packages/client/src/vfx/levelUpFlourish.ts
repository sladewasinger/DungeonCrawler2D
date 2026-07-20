// Level-up flourish: full-screen white flash + centered "LEVEL N" splash, driven by
// levelUpFlourishMotion.ts's pure curve. Camera-fixed (scrollFactor 0) so it reads
// the same regardless of where the player is standing.
import type Phaser from "phaser";
import { pixelTextStyle } from "../ui/font.js";
import {
  isLevelUpExpired,
  levelUpFlashAlpha,
  levelUpTextAlpha,
  levelUpTextScale,
} from "./levelUpFlourishMotion.js";

const FLASH_COLOR = 0xffffff;
const FLASH_DEPTH = 500_000;
const TEXT_DEPTH = 500_001;
const TEXT_SIZE_PX = 40;

export class LevelUpFlourish {
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private spawnMs = -Infinity;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    // Fill alpha 1 here, object alpha 0 — see lowHpOverlay.ts's constructor comment for
    // why the two must not be conflated (a 0 fill alpha makes every later setAlpha() a
    // no-op, which is exactly why this flash never showed).
    this.flash = scene.add
      .rectangle(0, 0, width, height, FLASH_COLOR, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(FLASH_DEPTH);
    this.text = scene.add
      .text(width / 2, height / 2, "", pixelTextStyle(TEXT_SIZE_PX, "#ffd23d"))
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(TEXT_DEPTH);
  }

  /** Starts (or restarts) the flourish for the given character level. */
  trigger(level: number, nowMs: number): void {
    this.text.setText(`LEVEL ${level}`);
    this.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    // Re-fits every call — cheap, and needs no external resize hook (mirrors
    // lowHpOverlay.ts's same self-resizing approach).
    this.resize(this.scene.scale.width, this.scene.scale.height);
    const elapsed = nowMs - this.spawnMs;
    if (isLevelUpExpired(elapsed)) {
      this.flash.setAlpha(0);
      this.text.setAlpha(0);
      return;
    }
    this.flash.setAlpha(levelUpFlashAlpha(elapsed) * 0.5);
    this.text.setAlpha(levelUpTextAlpha(elapsed)).setScale(levelUpTextScale(elapsed));
  }

  private resize(width: number, height: number): void {
    this.flash.setSize(width, height);
    this.text.setPosition(width / 2, height / 2);
  }

  dispose(): void {
    this.flash.destroy();
    this.text.destroy();
  }
}
