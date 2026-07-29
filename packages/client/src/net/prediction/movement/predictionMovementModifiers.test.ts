import {
  MOVE_SPEED,
  TICK_DT,
  createBody,
  stepBody,
  type MoveInput,
} from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { Prediction } from "../prediction.js";
import {
  closeBody,
  sandboxWorld,
  SPAWN_X,
  SPAWN_Y,
} from "../predictionTestSupport.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const SLOWED_SPEED = MOVE_SPEED * 0.6;
const WET_AND_OILED_SPEED = MOVE_SPEED * 0.85 * 0.6;

describe("movement modifier prediction parity", () => {
  it.each([
    ["slowed", SLOWED_SPEED],
    ["wet and oiled", WET_AND_OILED_SPEED],
  ])("keeps %s prediction in lockstep with authoritative movement", (_, speed) => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: WALK, movementSpeed: speed });
      stepBody(world, server, WALK, TICK_DT, { speed });
    }

    expect(closeBody(client, server)).toBe(true);
  });

  it("replays pending input using the latest authoritative modifier", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const speculative = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 3; tick++) {
      prediction.predict({ world, body: speculative, input: WALK });
    }

    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    stepBody(world, authoritative, WALK, TICK_DT, { speed: SLOWED_SPEED });
    const expected = { ...authoritative };
    for (let tick = 0; tick < 2; tick++) {
      stepBody(world, expected, WALK, TICK_DT, { speed: SLOWED_SPEED });
    }

    prediction.reconcile({
      world,
      body: authoritative,
      lastSimulatedProjectedTick: 1,
      authoritativeServerTick: 1,
      movementSpeed: SLOWED_SPEED,
    });

    expect(closeBody(authoritative, expected)).toBe(true);
  });

});
