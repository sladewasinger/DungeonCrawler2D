// Level-up flourish timing curve: a quick full-screen flash plus a "LEVEL N" splash
// that pops in, holds, then fades — pure so the curve is unit-testable apart from
// the Phaser objects it eventually drives (mirrors damageNumberMotion.ts's split).

export const LEVEL_UP_LIFETIME_MS = 1600;
const FLASH_FADE_MS = 220;
const TEXT_POP_MS = 160;
const TEXT_HOLD_MS = 900;

export function isLevelUpExpired(elapsedMs: number): boolean {
  return elapsedMs >= LEVEL_UP_LIFETIME_MS;
}

/** White screen-flash alpha: bright on the pop, fully faded by FLASH_FADE_MS. */
export function levelUpFlashAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= FLASH_FADE_MS) return 0;
  return 1 - elapsedMs / FLASH_FADE_MS;
}

/** "LEVEL N" text scale: overshoots past 1 on the pop-in, settles, holds, then the
 * caller cross-fades it out via levelUpTextAlpha — scale itself never drops. */
export function levelUpTextScale(elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= TEXT_POP_MS) return 1;
  const t = elapsedMs / TEXT_POP_MS;
  // Overshoot-and-settle: peaks above 1 partway through the pop, eases back to 1.
  return 1 + Math.sin(t * Math.PI) * 0.35 * (1 - t);
}

/** "LEVEL N" text alpha: fades in over the pop, holds fully visible, fades out to the end. */
export function levelUpTextAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= LEVEL_UP_LIFETIME_MS) return 0;
  if (elapsedMs < TEXT_POP_MS) return elapsedMs / TEXT_POP_MS;
  const holdEnd = TEXT_POP_MS + TEXT_HOLD_MS;
  if (elapsedMs < holdEnd) return 1;
  return 1 - (elapsedMs - holdEnd) / (LEVEL_UP_LIFETIME_MS - holdEnd);
}
