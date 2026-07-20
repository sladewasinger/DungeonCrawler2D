// Floor blood-decal fade curve: pure so it's unit-testable apart from the Image
// object it eventually drives — mirrors damageNumberMotion.ts's split. 10s fade
// per ASSUMPTIONS.md #29, so a long fight doesn't leave decals reading as permanent.

/** User playtest 2026-07-20: "blood should stay on the floor longer" — 10s -> 45s. */
export const DECAL_LIFETIME_MS = 45_000;

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
