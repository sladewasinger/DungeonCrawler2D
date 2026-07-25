// Floor blood-decal fade curve: pure so it's unit-testable apart from the Image
// object it eventually drives — mirrors damageNumberMotion.ts's split. The bounded
// lifetime keeps long fights from leaving decals reading as permanent.

/** Blood remains readable during a fight but always disappears within GAME-3's
 * thirty-second combat-readability bound. */
export const DECAL_LIFETIME_MS = 30_000;

/** Decal alpha for elapsed ms since spawn: holds near `baseAlpha` briefly (a fresh
 * splatter should read clearly), then fades linearly out over the remaining lifetime. */
export function decalAlpha(elapsedMs: number, baseAlpha: number): number {
  const holdMs = DECAL_LIFETIME_MS * 0.2;
  if (elapsedMs <= holdMs) return baseAlpha;
  if (elapsedMs >= DECAL_LIFETIME_MS) return 0;
  const fadeT = (elapsedMs - holdMs) / (DECAL_LIFETIME_MS - holdMs);
  return baseAlpha * (1 - fadeT);
}

export function isDecalExpired(elapsedMs: number): boolean {
  return elapsedMs >= DECAL_LIFETIME_MS;
}
