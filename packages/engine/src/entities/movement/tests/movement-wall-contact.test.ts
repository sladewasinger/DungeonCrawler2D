import { describe, expect, it } from "vitest";
import { TICK_DT } from "../../../core/constants.js";
import type { WorldView } from "../../../world/core/types.js";
import { BODY_RADIUS, createBody, stepBody } from "../../../index.js";

const WALL_X = 8;
const WORLD: WorldView = {
  isWalkable: (tileX) => tileX !== WALL_X,
  heightAt: () => 0,
  groundAt: () => 0,
  stairHeightAt: () => null,
};
const SPRINT = { moveX: 1, moveY: 0, jump: false, run: true };

describe("wall contact", () => {
  it("sweeps sprint steps to one stable contact from nearby prediction phases", () => {
    const behind = createBody(7.3, 5.5, 0);
    const ahead = createBody(7.45, 5.5, 0);

    stepBody(WORLD, behind, SPRINT, TICK_DT);
    const aheadResult = stepBody(WORLD, ahead, SPRINT, TICK_DT);
    const behindResult = stepBody(WORLD, behind, SPRINT, TICK_DT);

    expect(behindResult.blockedX).toBe(true);
    expect(aheadResult.blockedX).toBe(true);
    expect(behind.x).toBeCloseTo(WALL_X - BODY_RADIUS, 4);
    expect(ahead.x).toBeCloseTo(behind.x, 4);
    for (let tick = 0; tick < 20; tick++) {
      stepBody(WORLD, behind, SPRINT, TICK_DT);
      stepBody(WORLD, ahead, SPRINT, TICK_DT);
    }
    expect(Math.abs(ahead.x - behind.x)).toBeLessThan(0.00001);
  });
});
