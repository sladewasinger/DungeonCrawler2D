// Hand-derived tests for the wall-bump throttle/edge-trigger state machine
// (panel round 3b item 4). SUSTAIN_MS=150, THROTTLE_MS=400 are traced by hand below.
import { describe, expect, it } from "vitest";
import { createWallBumpState, stepWallBump } from "./wallBump.js";

describe("stepWallBump", () => {
  it("never triggers while the player isn't holding any move intent", () => {
    const state = createWallBumpState();
    // deltaDist 0 would otherwise read as "blocked", but moving=false must win.
    expect(stepWallBump(state, false, 0, 0)).toBe(false);
    expect(stepWallBump(state, false, 0, 1000)).toBe(false);
  });

  it("does not trigger, and clears tracking, on a step that actually moves", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0); // starts a blocked streak
    expect(stepWallBump(state, true, 0.1, 10)).toBe(false); // 0.1 tiles clears STILL_EPSILON
    expect(state.blockedSinceMs).toBeNull();
  });

  it("does not trigger before the 150ms sustain threshold", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0); // blocked streak starts at t=0
    expect(stepWallBump(state, true, 0, 149)).toBe(false);
  });

  it("triggers exactly at the 150ms sustain threshold (inclusive)", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0);
    expect(stepWallBump(state, true, 0, 150)).toBe(true);
  });

  it("throttles further triggers within 400ms of the last cue, even while still blocked", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0);
    expect(stepWallBump(state, true, 0, 150)).toBe(true); // first cue at t=150
    expect(stepWallBump(state, true, 0, 549)).toBe(false); // 399ms since the cue
  });

  it("re-triggers once 400ms have passed since the last cue, still blocked continuously", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0);
    stepWallBump(state, true, 0, 150); // cue #1 at t=150
    expect(stepWallBump(state, true, 0, 550)).toBe(true); // exactly 400ms later
  });

  it("releasing move intent clears the sustain timer, requiring a fresh 150ms after re-blocking", () => {
    const state = createWallBumpState();
    stepWallBump(state, true, 0, 0);
    stepWallBump(state, true, 0, 150); // cue #1 at t=150
    stepWallBump(state, false, 0, 200); // released — sustain timer clears
    expect(state.blockedSinceMs).toBeNull();
    stepWallBump(state, true, 0, 210); // re-blocked, fresh streak starts at t=210
    expect(stepWallBump(state, true, 0, 359)).toBe(false); // only 149ms into the new streak
    // At t=360 the new streak has sustained 150ms, but only 210ms have passed since the
    // t=150 cue — THROTTLE_MS is a flat time-since-last-cue check, not reset by a release,
    // so this stays silent rather than strobing on a quick release/re-press.
    expect(stepWallBump(state, true, 0, 360)).toBe(false);
  });
});
