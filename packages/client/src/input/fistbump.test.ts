import { describe, expect, it } from "vitest";
import {
  FISTBUMP_HOLD_MS,
  createHoldState,
  holdCrossedThreshold,
  holdDown,
  holdProgress,
  holdUp,
} from "./fistbump.js";

describe("hold-vs-tap F discrimination", () => {
  it("a quick release is a tap (party invite path), never a fistbump", () => {
    const state = createHoldState();
    holdDown(state, 1000);
    expect(holdCrossedThreshold(state, 1200)).toBe(false);
    expect(holdUp(state, 1200)).toBe("tap");
  });

  it("crossing the threshold fires exactly once, and the release is not a tap", () => {
    const state = createHoldState();
    holdDown(state, 1000);
    expect(holdCrossedThreshold(state, 1000 + FISTBUMP_HOLD_MS)).toBe(true);
    expect(holdCrossedThreshold(state, 1000 + FISTBUMP_HOLD_MS + 50)).toBe(false);
    expect(holdUp(state, 1600)).toBe("held");
  });

  it("progress ramps 0..1 while held and resets after fire", () => {
    const state = createHoldState();
    expect(holdProgress(state, 500)).toBe(0);
    holdDown(state, 1000);
    expect(holdProgress(state, 1000)).toBe(0);
    expect(holdProgress(state, 1200)).toBeCloseTo(200 / FISTBUMP_HOLD_MS);
    expect(holdProgress(state, 5000)).toBe(1);
    holdCrossedThreshold(state, 1000 + FISTBUMP_HOLD_MS);
    expect(holdProgress(state, 1500)).toBe(0);
  });

  it("keyboard auto-repeat down events don't restart the hold timer", () => {
    const state = createHoldState();
    holdDown(state, 1000);
    holdDown(state, 1300); // auto-repeat
    expect(holdCrossedThreshold(state, 1000 + FISTBUMP_HOLD_MS)).toBe(true);
  });

  it("a long hold that never fired (no target in range) still isn't a tap on release", () => {
    const state = createHoldState();
    holdDown(state, 1000);
    // No holdCrossedThreshold polling happened past the window (e.g. no valid target).
    expect(holdUp(state, 1000 + FISTBUMP_HOLD_MS + 200)).toBe("held");
  });

  it("a spurious keyup with no tracked press is idle", () => {
    const state = createHoldState();
    expect(holdUp(state, 1000)).toBe("idle");
  });
});
