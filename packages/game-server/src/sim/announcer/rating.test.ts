import { describe, expect, it } from "vitest";
import { ratingForRun } from "./rating.js";

/**
 * Hand-derived expectations for the audience-rating mapping (panel round 3b, "Small"
 * item) — each expected value is computed by hand from the rules in rating.ts's doc
 * comments (base 5, +1 per 2 kills capped at +3, +1 per floor past 1 capped at +2, a
 * survival-time adjustment, clamped to [2, 9]), never by re-running the implementation.
 */
describe("ratingForRun", () => {
  it("is the base 5 for an unremarkable floor-1 run with no kills", () => {
    // 5 + 0 (kills) + 0 (floor) + 0 (30s, no adjustment) = 5
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 30 })).toBe(5);
  });

  it("a single kill doesn't move the needle (bonus is 1 per TWO kills)", () => {
    // floor(1/2) = 0, same as zero kills
    expect(ratingForRun({ killsThisLife: 1, floor: 1, survivalSeconds: 30 })).toBe(5);
  });

  it("two kills earns +1", () => {
    // 5 + floor(2/2)=1 + 0 + 0 = 6
    expect(ratingForRun({ killsThisLife: 2, floor: 1, survivalSeconds: 30 })).toBe(6);
  });

  it("kills bonus caps at +3 well before a farming-tier kill count", () => {
    // floor(12/2) = 6, capped to 3 -> 5 + 3 + 0 + 0 = 8
    expect(ratingForRun({ killsThisLife: 12, floor: 1, survivalSeconds: 30 })).toBe(8);
  });

  it("floor depth is worth +1 per floor past 1", () => {
    // floor 3 -> (3-1)=2 -> 5 + 0 + 2 + 0 = 7
    expect(ratingForRun({ killsThisLife: 0, floor: 3, survivalSeconds: 30 })).toBe(7);
  });

  it("floor bonus caps at +2 even on floor 5 (the boss floor)", () => {
    // (5-1)=4, capped to 2 -> 5 + 0 + 2 + 0 = 7, same as floor 3
    expect(ratingForRun({ killsThisLife: 0, floor: 5, survivalSeconds: 30 })).toBe(7);
  });

  it("a death inside 5 seconds is the harshest penalty, hitting the floor of the scale", () => {
    // 5 + 0 + 0 - 3 = 2 (the mapping's MIN_RATING, reached exactly, no clamping needed)
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 3 })).toBe(2);
  });

  it("a death between 5 and 10 seconds eases to -2 (round-4 band split)", () => {
    // 5 + 0 + 0 - 2 = 3
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 8 })).toBe(3);
  });

  it("a death between 10 and 15 seconds eases further to -1", () => {
    // 5 + 0 + 0 - 1 = 4
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 12 })).toBe(4);
  });

  it("15 seconds exactly no longer counts as a fast death", () => {
    // 5 + 0 + 0 + 0 = 5 (the <15 branch is exclusive of 15)
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 15 })).toBe(5);
  });

  it("a life past 40 seconds starts earning longevity credit (round-4 band split)", () => {
    // 5 + 0 + 0 + 1 = 6
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 50 })).toBe(6);
  });

  it("a life past 2 minutes earns the full longevity bonus", () => {
    // 5 + 0 + 0 + 2 = 7
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 120 })).toBe(7);
  });

  it("a stacked best-case run clamps at the mapping's top of scale", () => {
    // 5 + min(3, floor(10/2)=5)=3 + min(2, 5-1=4)=2 + 2 (200s) = 12, clamped to 9
    expect(ratingForRun({ killsThisLife: 10, floor: 5, survivalSeconds: 200 })).toBe(9);
  });

  it("never returns outside [2, 9] even for a pathological negative survival time", () => {
    const rating = ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: -50 });
    expect(rating).toBeGreaterThanOrEqual(2);
    expect(rating).toBeLessThanOrEqual(9);
  });
});

describe("ratingForRun spread (panel round 4: similar scrub deaths must differ)", () => {
  it("6 hand-built run profiles produce at least 4 distinct ratings, jitter held at 0", () => {
    // Each expected value hand-derived from the band table in rating.ts:
    const profiles: Array<[{ killsThisLife: number; floor: number; survivalSeconds: number }, number]> = [
      [{ killsThisLife: 0, floor: 1, survivalSeconds: 3 }, 2], // 5 - 3 = 2 (instant whiff)
      [{ killsThisLife: 0, floor: 1, survivalSeconds: 8 }, 3], // 5 - 2 = 3
      [{ killsThisLife: 0, floor: 1, survivalSeconds: 12 }, 4], // 5 - 1 = 4
      [{ killsThisLife: 0, floor: 1, survivalSeconds: 20 }, 5], // 5 + 0 = 5
      [{ killsThisLife: 1, floor: 1, survivalSeconds: 50 }, 6], // 5 + 0 (1 kill) + 1 = 6
      [{ killsThisLife: 2, floor: 1, survivalSeconds: 130 }, 8], // 5 + 1 + 2 = 8
    ];
    const seen = new Set<number>();
    for (const [stats, expected] of profiles) {
      const rating = ratingForRun(stats, 0);
      expect(rating, JSON.stringify(stats)).toBe(expected);
      seen.add(rating);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it("jitter shifts the rating by exactly its value, one point either way", () => {
    // Base case: 20s scrub death = 5. With jitter -1 -> 4, +1 -> 6.
    const stats = { killsThisLife: 0, floor: 1, survivalSeconds: 20 };
    expect(ratingForRun(stats, -1)).toBe(4);
    expect(ratingForRun(stats, 0)).toBe(5);
    expect(ratingForRun(stats, 1)).toBe(6);
  });

  it("jitter is clamped to [-1, 1] and cannot become a real modifier", () => {
    const stats = { killsThisLife: 0, floor: 1, survivalSeconds: 20 };
    expect(ratingForRun(stats, 5)).toBe(6); // clamped to +1
    expect(ratingForRun(stats, -5)).toBe(4); // clamped to -1
  });

  it("jitter never pushes past the scale's ends", () => {
    // 3s whiff is already at MIN 2: 5 - 3 - 1 = 1 -> clamped to 2.
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 3 }, -1)).toBe(2);
    // Stacked run at MAX 9: 12 + 1 = 13 -> clamped to 9.
    expect(ratingForRun({ killsThisLife: 10, floor: 5, survivalSeconds: 200 }, 1)).toBe(9);
  });
});
