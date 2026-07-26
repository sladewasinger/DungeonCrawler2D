import { describe, expect, it } from "vitest";
import {
  BLOCK_SPEED_MULTIPLIER,
  MOVE_SPEED,
  TICK_DT,
} from "../core/constants.js";
import type { WorldView } from "../world/types.js";
import { createBody, stepBody } from "./movement/index.js";

const world: WorldView = {
  isWalkable: () => true,
  heightAt: () => 0,
  groundAt: () => 0,
  stairHeightAt: () => null,
};

const travel = (blocking: boolean): ReturnType<typeof createBody> => {
  const body = createBody(5.5, 5.5, 0);
  for (let tick = 0; tick < 20; tick++) {
    stepBody(world, body, {
      moveX: 1,
      moveY: 0,
      jump: false,
      block: blocking,
    }, TICK_DT);
  }
  return body;
};

describe("blocking movement", () => {
  it("walks at normal speed and blocks at exactly half speed", () => {
    expect(travel(false).x).toBeCloseTo(5.5 + MOVE_SPEED, 5);
    expect(travel(true).x).toBeCloseTo(
      5.5 + MOVE_SPEED * BLOCK_SPEED_MULTIPLIER,
      5,
    );
  });
});
