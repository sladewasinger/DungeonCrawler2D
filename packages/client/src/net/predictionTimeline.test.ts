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
import { PREDICTION_HISTORY_LIMIT, Prediction } from "./prediction.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const SPAWN_X = -6;
const SPAWN_Y = -13;

function bodiesMatch(left: BodyState, right: BodyState): boolean {
  return Math.abs(left.x - right.x) < 1e-9 &&
    Math.abs(left.y - right.y) < 1e-9 &&
    Math.abs(left.z - right.z) < 1e-9;
}

describe("Prediction input timeline", () => {
  it("preserves unsimulated ticks instead of falsely acknowledging a faster client", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, client, -1, 100);

    for (let tick = 101; tick <= 700; tick++) {
      prediction.predict(world, client, WALK);
      if (tick % 10 === 0) prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
      const authoritative = cloneBody(server);
      prediction.reconcile(world, authoritative, tick, tick);
      Object.assign(client, authoritative);
    }

    expect(prediction.pendingStepCount).toBe(60);
    expect(prediction.projectedTick).toBe(760);
    expect(prediction.allocatedStepRecordCount).toBeLessThanOrEqual(PREDICTION_HISTORY_LIMIT);
  });

  it("keeps every predicted step newer than the server's simulated input cursor", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, client, -1, 100);
    prediction.predict(world, client, WALK);
    prediction.predict(world, client, WALK);
    prediction.nextInputIdentity();

    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    stepBody(world, authoritative, WALK, TICK_DT);
    const expected = cloneBody(authoritative);
    stepBody(world, expected, WALK, TICK_DT);
    prediction.reconcile(world, authoritative, 101, 103);

    expect(bodiesMatch(authoritative, expected)).toBe(true);
    expect(prediction.pendingStepCount).toBe(1);
    expect(prediction.projectedTick).toBe(102);
  });

  it("tracks fresh server ticks while idle before the input timeline starts", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const body = createBody(SPAWN_X, SPAWN_Y, 5);

    prediction.reconcile(world, body, -1, 100);
    prediction.reconcile(world, body, -1, 500);
    const identity = prediction.predict(world, body, WALK);

    expect(identity.projectedServerTick).toBe(501);
  });

  it("does not discard a pending first input before the server anchors its timeline", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, client, -1, 100);
    prediction.predict(world, client, WALK);
    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);

    prediction.reconcile(world, authoritative, -1, 103);

    expect(bodiesMatch(authoritative, client)).toBe(true);
    expect(prediction.pendingStepCount).toBe(1);
    expect(prediction.projectedTick).toBe(101);
  });
});
