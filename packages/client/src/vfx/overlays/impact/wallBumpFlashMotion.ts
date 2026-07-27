// Pure fade curve for the wall-bump edge flash (panel round 3b item 4) — kept
// Phaser-free so the curve is unit-testable apart from any Graphics object.

export const WALL_BUMP_FLASH_MS = 140;
/** "Faint" per the spec — well under a full-bright flash. */
export const WALL_BUMP_FLASH_PEAK_ALPHA = 0.5;

/** WALL_BUMP_FLASH_PEAK_ALPHA at spawn, linearly fading to 0 by WALL_BUMP_FLASH_MS. */
export function wallBumpFlashAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= WALL_BUMP_FLASH_MS) return 0;
  return WALL_BUMP_FLASH_PEAK_ALPHA * (1 - elapsedMs / WALL_BUMP_FLASH_MS);
}
