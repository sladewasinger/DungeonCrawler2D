/** Protects modal ownership from delayed hold-gesture actions. */
import { describe, expect, it } from "vitest";
import { createHoldState, holdCrossedThreshold, holdDown } from "./fistbump.js";
import { GIVE_UP_HOLD_MS, GiveUpGesture } from "./giveUp.js";
import { cancelHeldGestures } from "./modalGestures.js";
import { REVIVE_HOLD_MS, ReviveGesture } from "./revive.js";
import { INSTANT_RESPAWN_HOLD_MS, RespawnGesture } from "./respawn.js";

describe("modal gesture cancellation", () => {
  it("cancels every held modal gesture before its threshold", () => {
    const revive = new ReviveGesture();
    const giveUp = new GiveUpGesture();
    const respawn = new RespawnGesture();
    const fistbump = createHoldState();
    revive.begin("party-member", 0);
    giveUp.begin(true, 0);
    respawn.begin(true, 0);
    holdDown(fistbump, 0);

    cancelHeldGestures(100, revive, giveUp, respawn, fistbump);

    expect(revive.poll(REVIVE_HOLD_MS)).toBe(false);
    expect(giveUp.poll(true, GIVE_UP_HOLD_MS)).toBe(false);
    expect(respawn.poll(true, INSTANT_RESPAWN_HOLD_MS)).toBe(false);
    expect(holdCrossedThreshold(fistbump, GIVE_UP_HOLD_MS)).toBe(false);
  });
});
