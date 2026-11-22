import { describe, expect, it } from "vitest";
import { stepJumpArc } from "./jumpPhysics.js";

describe("stepJumpArc", () => {
  it("stays grounded when idle and launches cleanly into rise, peak, fall, and landing", () => {
    const idle = stepJumpArc({ jumpZ: 0, jumpVz: 0 }, false, 0.05);
    expect(idle).toEqual({ jumpZ: 0, jumpVz: 0 });

    let state = stepJumpArc(idle, true, 0.05);
    expect(state.jumpZ).toBeGreaterThan(0);
    expect(state.jumpVz).toBeGreaterThan(0);

    let peakZ = state.jumpZ;
    let sawFall = false;
    for (let i = 0; i < 20; i++) {
      state = stepJumpArc(state, false, 0.05);
      peakZ = Math.max(peakZ, state.jumpZ);
      if (state.jumpVz < 0 && state.jumpZ > 0) sawFall = true;
    }

    expect(peakZ).toBeGreaterThan(0.4);
    expect(sawFall).toBe(true);
    expect(state).toEqual({ jumpZ: 0, jumpVz: 0 });
  });
});
