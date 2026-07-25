import {
  LEVEL,
  TICK_DT,
  World,
  cloneBody,
  createBody,
  stepBody,
  type BodyState,
  type MoveInput,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PredictionCorrection } from "../../net/predictionCorrection.js";
import { projectSelfRenderPose } from "./selfInterpolation.js";

const SPAWN_X = -6;
const SPAWN_Y = -13;

function renderPose(
  world: World,
  body: BodyState,
  input: MoveInput,
  accumulatorMs: number,
  previous: BodyState,
) {
  return projectSelfRenderPose(
    world, body, input, accumulatorMs,
    { stamina: 100, maxStamina: 100, blocking: false },
    false, new PredictionCorrection(), 0, previous,
  );
}

describe("partial-tick control changes", () => {
  it.each([5, 25, 49])(
    "does not jump backward when sprint is released at %dms",
    (accumulatorMs) => {
      const world = new World(7, 0, LEVEL.Sandbox);
      const ground = world.groundAt(SPAWN_X, SPAWN_Y);
      const body = createBody(SPAWN_X, SPAWN_Y, ground);
      const previous = cloneBody(body);
      stepBody(
        world,
        body,
        { moveX: 1, moveY: 0, jump: false, run: true },
        TICK_DT,
      );
      const runPose = renderPose(
        world, body, { moveX: 1, moveY: 0, jump: false, run: true },
        accumulatorMs, previous,
      );
      const stoppedPose = renderPose(
        world, body, { moveX: 0, moveY: 0, jump: false, run: false },
        accumulatorMs, previous,
      );
      const reversedPose = renderPose(
        world, body, { moveX: -1, moveY: 0, jump: false, run: true },
        accumulatorMs, previous,
      );

      expect(stoppedPose.x).toBe(runPose.x);
      expect(reversedPose.x).toBe(runPose.x);
    },
  );
});
