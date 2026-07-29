import { describe, expect, it } from "vitest";
import { ratingForRun } from "./rating.js";

describe("ratingForRun", () => {
  it("gives an ordinary floor-one run a middle rating", () => {
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 30 })).toBe(5);
  });

  it("gives an immediate death the lower bound", () => {
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 3 })).toBe(2);
  });

  it("gives a strong long run the upper bound", () => {
    expect(ratingForRun({ killsThisLife: 10, floor: 5, survivalSeconds: 200 })).toBe(9);
  });

  it("improves when a run combines kills, depth, and survival", () => {
    const ordinary = ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 30 });
    const stronger = ratingForRun({ killsThisLife: 2, floor: 3, survivalSeconds: 130 });
    expect(stronger).toBeGreaterThan(ordinary);
  });

  it("keeps jitter bounded and inside the rating scale", () => {
    const stats = { killsThisLife: 0, floor: 1, survivalSeconds: 20 };
    expect(ratingForRun(stats, 5)).toBe(6);
    expect(ratingForRun(stats, -5)).toBe(4);
    expect(ratingForRun({ killsThisLife: 0, floor: 1, survivalSeconds: 3 }, -1)).toBe(2);
    expect(ratingForRun({ killsThisLife: 10, floor: 5, survivalSeconds: 200 }, 1)).toBe(9);
  });
});
