// Floor-entry banner: big "FLOOR N" + the announcer's line beneath it, camera-fixed,
// 3s fade — driven by floorBannerMotion.ts's pure curve. Mirrors levelUpFlourish.ts's
// structure (trigger/update/dispose), styled as a title card rather than a flash.
import type Phaser from "phaser";
import { pixelTextStyle } from "../ui/font.js";
import { floorBannerAlpha, floorBannerScale, isFloorBannerExpired } from "./floorBannerMotion.js";

const TITLE_DEPTH = 500_000;
const LINE_DEPTH = 500_001;
const TITLE_SIZE_PX = 36;
const LINE_SIZE_PX = 16;
const LINE_GAP_PX = 34;

export class FloorBanner {
  private readonly title: Phaser.GameObjects.Text;
  private readonly line: Phaser.GameObjects.Text;
  private spawnMs = -Infinity;

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.title = scene.add
      .text(width / 2, height / 2 - LINE_GAP_PX, "", pixelTextStyle(TITLE_SIZE_PX, "#e8e8e8"))
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(TITLE_DEPTH);
    this.line = scene.add
      .text(width / 2, height / 2 + LINE_GAP_PX / 2, "", pixelTextStyle(LINE_SIZE_PX, "#9a9aae"))
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setAlpha(0)
      .setDepth(LINE_DEPTH);
  }

  /** Starts (or restarts) the banner for the given floor and announcer line. */
  trigger(floor: number, line: string, nowMs: number): void {
    this.title.setText(`FLOOR ${floor}`);
    this.line.setText(line);
    this.spawnMs = nowMs;
  }

  update(nowMs: number): void {
    this.resize(this.scene.scale.width, this.scene.scale.height);
    const elapsed = nowMs - this.spawnMs;
    if (isFloorBannerExpired(elapsed)) {
      this.title.setAlpha(0);
      this.line.setAlpha(0);
      return;
    }
    const alpha = floorBannerAlpha(elapsed);
    this.title.setAlpha(alpha).setScale(floorBannerScale(elapsed));
    this.line.setAlpha(alpha);
  }

  private resize(width: number, height: number): void {
    this.title.setPosition(width / 2, height / 2 - LINE_GAP_PX);
    this.line.setPosition(width / 2, height / 2 + LINE_GAP_PX / 2);
  }

  dispose(): void {
    this.title.destroy();
    this.line.destroy();
  }
}
