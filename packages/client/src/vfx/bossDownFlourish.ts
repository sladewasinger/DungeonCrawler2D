// Boss-death celebration: full-screen dark-red flash + centered "<NAME> FALLS" splash,
// driven by bossDownFlourishMotion.ts's pure curve. Mirrors levelUpFlourish.ts's shape.
import type Phaser from "phaser";
import { pixelTextStyle } from "../ui/font.js";
import { bossDownFlashAlpha, bossDownTextAlpha, isBossDownExpired } from "./bossDownFlourishMotion.js";

const FLASH_COLOR = 0x9c1c2e;
const FLASH_DEPTH = 500_000;
const TEXT_DEPTH = 500_001;
const TEXT_SIZE_PX = 34;

export class BossDownFlourish {
  private readonly flash: Phaser.GameObjects.Rectangle;
  private readonly text: Phaser.GameObjects.Text;
  private spawnMs = -Infinity;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
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

  /** Starts (or restarts) the celebration for the given boss display name. */
  trigger(bossName: string, nowMs: number): void {
    this.text.setText(`${bossName.toUpperCase()} FALLS`);
    this.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    this.resize(this.scene.scale.width, this.scene.scale.height);
    const elapsed = nowMs - this.spawnMs;
    if (isBossDownExpired(elapsed)) {
      this.flash.setAlpha(0);
      this.text.setAlpha(0);
      return;
    }
    this.flash.setAlpha(bossDownFlashAlpha(elapsed) * 0.6);
    this.text.setAlpha(bossDownTextAlpha(elapsed));
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
