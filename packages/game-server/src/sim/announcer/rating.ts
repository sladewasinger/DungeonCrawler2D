// Audience-rating derivation (panel round 3b, "Small" item): the death line's "the
// audience rates it a 6 out of 10" never varied, so the panel could tell it was a fixed
// string rather than a reactive audience. A pure, hand-derived mapping from this life's
// run stats (kills, floor depth, survival time) to a 2-9 rating — kept deterministic and
// Phaser/sim-free so it's unit-testable on its own, same split as meleeWedgeGeometry.ts
// on the client side of this lane.
export interface RunStats {
  readonly killsThisLife: number;
  readonly floor: number;
  readonly survivalSeconds: number;
}

const MIN_RATING = 2;
const MAX_RATING = 9;
const BASE_RATING = 5;

/** Ranked blockers reward, not required — one point per two kills, capped so a farming
 * run doesn't just max the scale on kills alone. */
function killsBonus(killsThisLife: number): number {
  return Math.min(3, Math.floor(killsThisLife / 2));
}

/** Floor 1 gets no bonus (the common case); each floor past it is worth a point, capped. */
function floorBonus(floor: number): number {
  return Math.min(2, Math.max(0, floor - 1));
}

/**
 * A death within the first few seconds of a life reads as an embarrassing whiff, not a
 * real run — the audience is harshest here; a properly long life earns a little credit
 * back. Everything in between is judged on kills/floor alone.
 */
function survivalAdjustment(survivalSeconds: number): number {
  if (survivalSeconds < 5) return -3;
  if (survivalSeconds < 15) return -1;
  if (survivalSeconds >= 120) return 1;
  return 0;
}

/**
 * Derives this life's audience rating, 2-9 inclusive. `rating <= 3` and `rating >= 8`
 * are the "extremes" the DEATH_LINES rating line amplifies with extra deadpan flavor —
 * see lines.ts.
 */
export function ratingForRun(stats: RunStats): number {
  const raw =
    BASE_RATING + killsBonus(stats.killsThisLife) + floorBonus(stats.floor) + survivalAdjustment(stats.survivalSeconds);
  return Math.min(MAX_RATING, Math.max(MIN_RATING, raw));
}
