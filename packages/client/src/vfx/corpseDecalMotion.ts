// Kill-moment corpse/bone decal fade curve — mirrors bloodDecalMotion.ts's split
// (pure, unit-testable apart from the Shape it eventually drives) but "brief" per
// the wave-7 kill-moment brief: a corpse marks the kill, it isn't a permanent decal.

export const CORPSE_DECAL_LIFETIME_MS = 15_000;

/** Holds near `baseAlpha` briefly, then fades linearly to 0 over the remaining lifetime. */
export function corpseDecalAlpha(elapsedMs: number, baseAlpha: number): number {
  const holdMs = CORPSE_DECAL_LIFETIME_MS * 0.3;
  if (elapsedMs <= holdMs) return baseAlpha;
  if (elapsedMs >= CORPSE_DECAL_LIFETIME_MS) return 0;
  const fadeT = (elapsedMs - holdMs) / (CORPSE_DECAL_LIFETIME_MS - holdMs);
  return baseAlpha * (1 - fadeT);
}

export function isCorpseDecalExpired(elapsedMs: number): boolean {
  return elapsedMs >= CORPSE_DECAL_LIFETIME_MS;
}
