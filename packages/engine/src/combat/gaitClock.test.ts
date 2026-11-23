import { describe, expect, it } from "vitest";
import {
  RUN_CYCLE_TILES, WALK_CYCLE_TILES, advanceGaitClock, createGaitClock, gaitFrameIndex,
} from "./gaitClock.js";

describe("gaitClock", () => {
  it("fires two footsteps on contact frames 1 and 4 over one full walk cycle", () => {
    const clock = createGaitClock();
    advanceGaitClock(clock, { x: 0, y: 0, moving: false, sprinting: false, airborne: false });
    const stepFrames: number[] = [];
    const subSteps = 22;
    const dx = WALK_CYCLE_TILES / subSteps;
    for (let i = 1; i <= subSteps; i++) {
      const res = advanceGaitClock(clock, { x: i * dx, y: 0, moving: true, sprinting: false, airborne: false });
      if (res.stepTriggered) stepFrames.push(gaitFrameIndex(res.phase, 6));
    }
    expect(stepFrames).toEqual([1, 4]);
  });

  it("scales stride cycle length for sprinting and suppresses phantom steps", () => {
    const clock = createGaitClock();
    advanceGaitClock(clock, { x: 0, y: 0, moving: false, sprinting: true, airborne: false });
    const stepFrames: number[] = [];
    const subSteps = 31;
    const dx = RUN_CYCLE_TILES / subSteps;
    for (let i = 1; i <= subSteps; i++) {
      const res = advanceGaitClock(clock, { x: i * dx, y: 0, moving: true, sprinting: true, airborne: false });
      if (res.stepTriggered) stepFrames.push(gaitFrameIndex(res.phase, 6));
    }
    expect(stepFrames).toEqual([1, 4]);

    const wallPush = advanceGaitClock(clock, { x: RUN_CYCLE_TILES, y: 0, moving: true, sprinting: false, airborne: false });
    expect(wallPush.stepTriggered).toBe(false);

    const jump = advanceGaitClock(clock, { x: RUN_CYCLE_TILES + 1, y: 0, moving: true, sprinting: false, airborne: true });
    expect(jump.stepTriggered).toBe(false);

    const teleport = advanceGaitClock(clock, { x: 50, y: 50, moving: true, sprinting: false, airborne: false });
    expect(teleport.stepTriggered).toBe(false);
  });
});
