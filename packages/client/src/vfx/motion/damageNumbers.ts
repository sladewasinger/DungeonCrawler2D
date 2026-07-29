// Floating damage-number pool: spawns a pixel-font Text per hit, colored by kind
// (accent palette per VISUAL_DIRECTION), rises and fades, then recycles.
import type Phaser from "phaser";
import type { HealthFeedback } from "../../ui/presentation/healthFeedback.js";
import { uiTextStyle } from "../../ui/foundation/font.js";
import { HUD_SCALE } from "../../ui/foundation/hudScale.js";
import { COMBAT_TEXT_DEPTH } from "../combat/combatLayer.js";
import { damageNumberPose, isExpired } from "./damageNumberMotion.js";

const FONT_SIZE_PX = 18 * HUD_SCALE;

interface FloatingNumber {
  readonly text: Phaser.GameObjects.Text;
  readonly startX: number;
  readonly startY: number;
  readonly spawnMs: number;
}

export interface DamageNumberInput {
  readonly x: number;
  readonly y: number;
  readonly feedback: HealthFeedback;
  readonly nowMs: number;
}

export class DamageNumberPool {
  private readonly active: FloatingNumber[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  /** Spawns one authoritative signed health change at a screen position. */
  spawn({ x: screenX, y: screenY, feedback, nowMs }: DamageNumberInput): void {
    const text = this.scene.add
      .text(screenX, screenY, feedback.label, uiTextStyle(FONT_SIZE_PX, feedback.color, { scale: 1, weight: "emphasis" }))
      .setOrigin(0.5, 1)
      .setDepth(COMBAT_TEXT_DEPTH);
    this.active.push({ text, startX: screenX, startY: screenY, spawnMs: nowMs });
  }

  /** Advances every live number's rise/fade, recycling ones past their lifetime. */
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
