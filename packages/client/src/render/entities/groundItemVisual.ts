// Phaser glue for ground-item bob/glint (motion math lives in groundItemMotion.ts,
// pure and unit-tested there).
import type Phaser from "phaser";
import { bobOffsetPx, glintStrength } from "./groundItemMotion.js";

/** Applies this frame's bob offset and glint tint to a ground-item sprite anchored at (baseX, baseY). */
export function applyGroundItemMotion(
  sprite: Phaser.GameObjects.Sprite,
  baseX: number,
  baseY: number,
  elapsedMs: number,
): void {
  sprite.setPosition(baseX, baseY + bobOffsetPx(elapsedMs));
  const glint = glintStrength(elapsedMs);
  const channelValue = Math.round(215 + glint * 40);
  sprite.setTint((channelValue << 16) | (channelValue << 8) | channelValue);
}
