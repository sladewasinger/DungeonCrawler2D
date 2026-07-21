// Audience-rating derivation (panel round 3b "Small" item, widened for round 4): the
// death line's rating must read as a reactive audience, not a fixed string. A pure,
// hand-derived mapping from this life's run stats (kills, floor depth, survival time)
// to a 2-9 rating — kept deterministic and Phaser/sim-free so it's unit-testable on its
// own. Round 4 (BookFan: "5 out of 10 on every numbered death") folds in finer
// survival-seconds granularity (six bands instead of three) plus a small per-death
// jitter the caller derives from the seeded sim Rng (deaths.ts), so
// similar-but-not-identical scrub deaths land on different numbers —
// ASSUMPTION #382 (docs/ASSUMPTIONS.md), superseding #369's point values.
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
 * Six survival bands, monotonically rising: an instant death (<5s) is an embarrassing
 * whiff the audience punishes hardest; each band past it claws credit back, so a 20s
 * scrub death and a 50s one no longer read as the same run (round 4's spread widening).
 */
function survivalAdjustment(survivalSeconds: number): number {
  if (survivalSeconds < 5) return -3;
  if (survivalSeconds < 10) return -2;
  if (survivalSeconds < 15) return -1;
  if (survivalSeconds < 40) return 0;
  if (survivalSeconds < 120) return 1;
  return 2;
}

/**
 * Derives this life's audience rating, 2-9 inclusive. `jitter` is the per-death wobble
 * (deaths.ts draws it from the seeded sim Rng) — clamped here to [-1, 1] so no caller
 * can turn it into a real modifier. `rating <= 3` and `rating >= 8` are the "extremes"
 * the death line's rating sentence amplifies with extra deadpan flavor — see lines.ts.
 */
export function ratingForRun(stats: RunStats, jitter = 0): number {
  const wobble = Math.max(-1, Math.min(1, Math.round(jitter)));
  const raw =
    BASE_RATING +
    killsBonus(stats.killsThisLife) +
    floorBonus(stats.floor) +
    survivalAdjustment(stats.survivalSeconds) +
    wobble;
  return Math.min(MAX_RATING, Math.max(MIN_RATING, raw));
}
