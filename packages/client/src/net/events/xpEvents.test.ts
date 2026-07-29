// Headless tests for deriving xpGained/levelUp visual events from consecutive self snapshots.
import { describe, expect, it } from "vitest";
import { xpGainEvents } from "./xpEvents.js";

describe("xpGainEvents", () => {
  it("emits nothing when xp and level are unchanged", () => {
    expect(xpGainEvents({ xp: 40, level: 1 }, { xp: 40, level: 1 })).toEqual([]);
  });

  it("emits an xpGained event sized to the delta, no level-up", () => {
    expect(xpGainEvents({ xp: 40, level: 1 }, { xp: 45, level: 1 })).toEqual([{ t: "xpGained", amount: 5 }]);
  });

  it("emits both xpGained and levelUp when a kill's xp crosses a level threshold", () => {
    expect(xpGainEvents({ xp: 95, level: 1 }, { xp: 105, level: 2 })).toEqual([
      { t: "xpGained", amount: 10 },
      { t: "levelUp", level: 2 },
    ]);
  });

  it("never emits on a decrease (xp never drops, but a stale/replayed snapshot must not fabricate a gain)", () => {
    expect(xpGainEvents({ xp: 50, level: 1 }, { xp: 40, level: 1 })).toEqual([]);
  });
});
