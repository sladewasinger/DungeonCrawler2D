// Headless tests for the hold-E revive gesture's pure hold-state machine.
import { describe, expect, it } from "vitest";
import {
  REVIVE_HOLD_MS,
  beginRevive,
  createReviveHoldState,
  endRevive,
  resolveReviveHoldView,
  reviveCrossedThreshold,
} from "./revive.js";

describe("revive hold gesture", () => {
  it("is idle with no view and never crosses threshold before a hold begins", () => {
    const state = createReviveHoldState();
    expect(resolveReviveHoldView(state, 0)).toBeNull();
    expect(reviveCrossedThreshold(state, 1000)).toBe(false);
  });

  it("tracks progress toward REVIVE_HOLD_MS and fires exactly once at the threshold", () => {
    const state = createReviveHoldState();
    beginRevive(state, "p2", 0);
    expect(resolveReviveHoldView(state, REVIVE_HOLD_MS / 2)).toEqual({ targetId: "p2", progress: 0.5 });
    expect(reviveCrossedThreshold(state, REVIVE_HOLD_MS / 2)).toBe(false);

    expect(reviveCrossedThreshold(state, REVIVE_HOLD_MS)).toBe(true);
    expect(reviveCrossedThreshold(state, REVIVE_HOLD_MS + 50)).toBe(false); // fires once only
  });

  it("releasing early cancels the hold — no threshold fire, no ring", () => {
    const state = createReviveHoldState();
    beginRevive(state, "p2", 0);
    endRevive(state, 100);
    expect(resolveReviveHoldView(state, 100)).toBeNull();
    expect(reviveCrossedThreshold(state, REVIVE_HOLD_MS)).toBe(false);
  });

  it("endRevive on an already-idle state is a harmless no-op", () => {
    const state = createReviveHoldState();
    endRevive(state, 0);
    expect(resolveReviveHoldView(state, 0)).toBeNull();
  });
});
