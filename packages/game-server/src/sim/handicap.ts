/**
 * Player handicap grants. The name check is deliberately isolated here so a
 * future admin panel can replace it with a persisted grant without touching
 * combat code.
 */

export interface HandicapGrant {
  /** Multiplier applied to hostile health damage (0.5 = half damage). */
  readonly damageTakenMultiplier: number;
  /** Multiplier applied to damage dealt by this player. */
  readonly damageGivenMultiplier: number;
}

export const DEFAULT_HANDICAP: HandicapGrant = Object.freeze({
  damageTakenMultiplier: 0.1,
  damageGivenMultiplier: 3,
});

const NAME_GRANTS = ["josiah", "ellie"] as const;

/** Temporary playtest grant; admin-granted players use the same result. */
export function handicapForPlayer(
  name: string,
  adminGranted = false,
): HandicapGrant | undefined {
  const normalized = name.trim().toLowerCase();
  if (adminGranted || NAME_GRANTS.some((marker) => normalized.includes(marker))) {
    return DEFAULT_HANDICAP;
  }
  return undefined;
}
