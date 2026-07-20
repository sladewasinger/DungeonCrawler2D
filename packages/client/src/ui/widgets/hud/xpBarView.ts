// Pure XP-bar progress math: the wire only carries cumulative totals (self.xp,
// self.level, self.xpForNext — protocol 14, ASSUMPTION #90), so the widget derives
// "how far through the current level" itself. Split out so the ratio math is
// unit-testable apart from the Phaser bar it eventually drives.
import { xpForLevel } from "@dc2d/engine";

export interface XpBarData {
  readonly xp: number;
  readonly level: number;
  readonly xpForNext: number;
}

/** Fraction (0..1) of the current level's own xp span already earned. */
export function xpProgressRatio(data: XpBarData): number {
  const levelStart = xpForLevel(data.level);
  const levelEnd = data.xp + data.xpForNext;
  const span = levelEnd - levelStart;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (data.xp - levelStart) / span));
}
