// Floating "+N XP" number pool: same rise/fade curve as damageNumbers.ts
// (damageNumberMotion.ts, reused rather than duplicated) but gold-accented and
// screen-anchored above the self player, since a kill's XP gain has no landed-hit
// world position to spawn from — only the self snapshot's cumulative xp changed.
import type Phaser from "phaser";
import { uiTextStyle } from "../ui/font.js";
import { HUD_SCALE } from "../ui/hudScale.js";
import { damageNumberPose, isExpired } from "./damageNumberMotion.js";

const XP_COLOR = "#ffd23d";
const FONT_SIZE_PX = 16 * HUD_SCALE;
const DEPTH = 400_001;

interface FloatingXpNumber {
  readonly text: Phaser.GameObjects.Text;
  readonly startX: number;
  readonly startY: number;
  readonly spawnMs: number;
}

export class XpNumberPool {
  private readonly active: FloatingXpNumber[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(screenX: number, screenY: number, amount: number, nowMs: number): void {
    const text = this.scene.add
      .text(screenX, screenY, `+${Math.round(amount)} XP`, uiTextStyle(FONT_SIZE_PX, XP_COLOR, 1, "emphasis"))
      .setOrigin(0.5, 1)
      .setDepth(DEPTH);
    this.active.push({ text, startX: screenX, startY: screenY, spawnMs: nowMs });
  }

  update(nowMs: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      if (!entry) continue;
      const elapsed = nowMs - entry.spawnMs;
      if (isExpired(elapsed)) {
        entry.text.destroy();
        this.active.splice(i, 1);
        continue;
      }
      const pose = damageNumberPose(elapsed);
      entry.text.setPosition(entry.startX, entry.startY + pose.offsetY);
      entry.text.setAlpha(pose.alpha);
    }
  }

  dispose(): void {
    for (const entry of this.active) entry.text.destroy();
    this.active.length = 0;
  }
}
