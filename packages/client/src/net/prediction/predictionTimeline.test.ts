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
import { Prediction } from "./prediction.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const SPAWN_X = -6;
const SPAWN_Y = -13;

function predict(prediction: Prediction, world: World, body: BodyState): void {
  prediction.predict({ world, body, input: WALK });
}

function reconcile(prediction: Prediction, request: { world: World; body: BodyState; tick: number; serverTick: number }): void {
  prediction.reconcile({ ...request, lastSimulatedProjectedTick: request.tick, authoritativeServerTick: request.serverTick });
}

function bodiesMatch(left: BodyState, right: BodyState): boolean {
  return Math.abs(left.x - right.x) < 1e-9 &&
    Math.abs(left.y - right.y) < 1e-9 &&
    Math.abs(left.z - right.z) < 1e-9;
}

describe("Prediction input timeline", () => {
  it("keeps every predicted step newer than the server's simulated input cursor", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    reconcile(prediction, { world, body: client, tick: -1, serverTick: 100 });
    predict(prediction, world, client);
    predict(prediction, world, client);
    prediction.nextInputIdentity();

    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    stepBody(world, authoritative, WALK, TICK_DT);
    const expected = cloneBody(authoritative);
    stepBody(world, expected, WALK, TICK_DT);
    reconcile(prediction, { world, body: authoritative, tick: 101, serverTick: 103 });

    expect(bodiesMatch(authoritative, expected)).toBe(true);
    expect(prediction.pendingStepCount).toBe(1);
    expect(prediction.projectedTick).toBe(102);
  });

  it("tracks fresh server ticks while idle before the input timeline starts", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const body = createBody(SPAWN_X, SPAWN_Y, 5);

    reconcile(prediction, { world, body, tick: -1, serverTick: 100 });
    reconcile(prediction, { world, body, tick: -1, serverTick: 500 });
    const identity = prediction.predict({ world, body, input: WALK });

    expect(identity.projectedServerTick).toBe(501);
  });

  it("does not discard a pending first input before the server anchors its timeline", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    reconcile(prediction, { world, body: client, tick: -1, serverTick: 100 });
    predict(prediction, world, client);
    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);

    reconcile(prediction, { world, body: authoritative, tick: -1, serverTick: 103 });

    expect(bodiesMatch(authoritative, client)).toBe(true);
    expect(prediction.pendingStepCount).toBe(1);
    expect(prediction.projectedTick).toBe(101);
  });
});
