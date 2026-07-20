// Floor blood-decal fade curve: pure so it's unit-testable apart from the Image
// object it eventually drives — mirrors damageNumberMotion.ts's split. 10s fade
// per ASSUMPTIONS.md #29, so a long fight doesn't leave decals reading as permanent.

/** User 2026-07-20 round 2: "indefinitely, or for at least like an hour" — 1 hour.
 * The 96-slot pool round-robins long before this in heavy fights, which is the
 * real bound; the timer only cleans up after quiet sessions. */
export const DECAL_LIFETIME_MS = 3_600_000;

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
