// Boss-death celebration timing curve: a red screen flash plus a "<NAME> FALLS"
// splash — pure curve split out mirroring levelUpFlourishMotion.ts.

export const BOSS_DOWN_LIFETIME_MS = 2200;
const FLASH_FADE_MS = 350;
const TEXT_POP_MS = 200;
const TEXT_HOLD_MS = 1300;

export function isBossDownExpired(elapsedMs: number): boolean {
  return elapsedMs >= BOSS_DOWN_LIFETIME_MS;
}

/** Red screen-flash alpha: bright on the pop, fully faded by FLASH_FADE_MS. */
export function bossDownFlashAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= FLASH_FADE_MS) return 0;
  return 1 - elapsedMs / FLASH_FADE_MS;
}

/** "<NAME> FALLS" text alpha: fades in over the pop, holds, then fades to the end. */
export function bossDownTextAlpha(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= BOSS_DOWN_LIFETIME_MS) return 0;
  if (elapsedMs < TEXT_POP_MS) return elapsedMs / TEXT_POP_MS;
  const holdEnd = TEXT_POP_MS + TEXT_HOLD_MS;
  if (elapsedMs < holdEnd) return 1;
  return 1 - (elapsedMs - holdEnd) / (BOSS_DOWN_LIFETIME_MS - holdEnd);
}
