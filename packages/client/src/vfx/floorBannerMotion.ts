// Floor-banner timing curve: a quick pop-in, a hold, then a 3s-total fade — pure so the
// curve is unit-testable apart from the Phaser objects it eventually drives (mirrors
// levelUpFlourishMotion.ts's split).

export const FLOOR_BANNER_LIFETIME_MS = 3000;
const POP_MS = 180;
const HOLD_MS = 1600;

export function isFloorBannerExpired(elapsedMs: number): boolean {
  return elapsedMs >= FLOOR_BANNER_LIFETIME_MS;
}

/** Banner alpha: fades in over the pop, holds fully visible, fades out to the end. */
export function floorBannerAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= FLOOR_BANNER_LIFETIME_MS) return 0;
  if (elapsedMs < POP_MS) return elapsedMs / POP_MS;
  const holdEnd = POP_MS + HOLD_MS;
  if (elapsedMs < holdEnd) return 1;
  return 1 - (elapsedMs - holdEnd) / (FLOOR_BANNER_LIFETIME_MS - holdEnd);
}

/** "FLOOR N" title scale: a small overshoot-and-settle pop, matching levelUpFlourish's feel. */
export function floorBannerScale(elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  if (elapsedMs >= POP_MS) return 1;
  const t = elapsedMs / POP_MS;
  return 1 + Math.sin(t * Math.PI) * 0.25 * (1 - t);
}
