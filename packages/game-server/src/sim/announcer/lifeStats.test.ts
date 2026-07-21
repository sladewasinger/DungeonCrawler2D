import { describe, expect, it } from "vitest";
import { recordKill } from "./killCounts.js";
import { ensureLifeTracked, takeLifeStats } from "./lifeStats.js";
import type { PlayerSlot } from "../state.js";

/** Unit tests for the per-life kill/duration bookkeeping (panel round 3b, "Small" item). */

function makeSlot(id: string): PlayerSlot {
  // Minimal shape — this module only ever uses the slot as a WeakMap key (via
  // killCounts.ts's own WeakMap too), same fixture pattern as announcer.test.ts.
  return { entity: { id, name: id } } as unknown as PlayerSlot;
}

describe("ensureLifeTracked", () => {
  it("is a no-op on a slot that's already tracked (doesn't reset an in-progress life)", () => {
    const slot = makeSlot("p1");
    ensureLifeTracked(slot, 100);
    recordKill(slot);
    ensureLifeTracked(slot, 500); // must NOT overwrite the tick-100 start
    const stats = takeLifeStats(slot, 600);
    expect(stats.survivalTicks).toBe(500); // 600 - 100, not 600 - 500
    expect(stats.killsThisLife).toBe(1);
  });
});

describe("takeLifeStats", () => {
  it("reports 0 kills and 0 survival for a slot with no prior tracking, dying the instant it's seen", () => {
    const slot = makeSlot("p2");
    const stats = takeLifeStats(slot, 42);
    expect(stats).toEqual({ killsThisLife: 0, survivalTicks: 0 });
  });

  it("counts only kills recorded since this life started, not the session-cumulative tally", () => {
    const slot = makeSlot("p3");
    ensureLifeTracked(slot, 0);
    recordKill(slot);
    recordKill(slot);
    const firstLife = takeLifeStats(slot, 100);
    expect(firstLife).toEqual({ killsThisLife: 2, survivalTicks: 100 });

    // A kill in the NEXT life must not carry over the first life's tally.
    recordKill(slot);
    const secondLife = takeLifeStats(slot, 150);
    expect(secondLife).toEqual({ killsThisLife: 1, survivalTicks: 50 });
  });

  it("never reports negative survival ticks (defensive floor, even if called out of order)", () => {
    const slot = makeSlot("p4");
    ensureLifeTracked(slot, 1000);
    const stats = takeLifeStats(slot, 500); // "before" the tracked start
    expect(stats.survivalTicks).toBe(0);
  });
});
