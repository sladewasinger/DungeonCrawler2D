// Floating damage-number motion: rises and fades over a fixed lifetime — pure so the
// curve is unit-testable apart from the Text object it eventually drives.
export const DAMAGE_NUMBER_LIFETIME_MS = 700;
const RISE_PX = 22;

export function isExpired(elapsedMs: number): boolean {
  return elapsedMs >= DAMAGE_NUMBER_LIFETIME_MS;
}

/** Vertical offset (px, negative = up) and alpha for elapsed ms since spawn. */
export function damageNumberPose(elapsedMs: number): { offsetY: number; alpha: number } {
  const t = Math.min(1, Math.max(0, elapsedMs / DAMAGE_NUMBER_LIFETIME_MS));
  const eased = 1 - (1 - t) * (1 - t);
  return { offsetY: -eased * RISE_PX, alpha: 1 - t };
}
