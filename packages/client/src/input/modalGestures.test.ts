/** Protects modal ownership from delayed hold-gesture actions. */
import { describe, expect, it } from "vitest";
import { createHoldState, holdCrossedThreshold, holdDown } from "./fistbump.js";
import { GIVE_UP_HOLD_MS, GiveUpGesture } from "./giveUp.js";
import { cancelHeldGestures } from "./modalGestures.js";
import { REVIVE_HOLD_MS, ReviveGesture } from "./revive.js";

describe("modal gesture cancellation", () => {
  it("cancels revive, give-up, and fistbump holds before their thresholds", () => {
    const revive = new ReviveGesture();
    const giveUp = new GiveUpGesture();
    const fistbump = createHoldState();
    revive.begin("party-member", 0);
    giveUp.begin(true, 0);
    holdDown(fistbump, 0);

    cancelHeldGestures(100, revive, giveUp, fistbump);

    expect(revive.poll(REVIVE_HOLD_MS)).toBe(false);
    expect(giveUp.poll(true, GIVE_UP_HOLD_MS)).toBe(false);
    expect(holdCrossedThreshold(fistbump, GIVE_UP_HOLD_MS)).toBe(false);
  });
});
