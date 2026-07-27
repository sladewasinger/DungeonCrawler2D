import { TICK_DT, createBody, stepBody, stepPlayerResources, type MoveInput } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { PREDICTION_HISTORY_LIMIT, Prediction } from "./prediction.js";
import { closeBody, sandboxWorld, SPAWN_X, SPAWN_Y } from "./predictionTestSupport.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const RUN: MoveInput = { ...WALK, run: true };

describe("Prediction lifecycle", () => {
  it("replays the same stamina-limited sprint policy as the server", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);
    const clientResources = { stamina: 1, maxStamina: 100, blocking: false };
    const serverResources = { ...clientResources };
    for (let tick = 0; tick < 5; tick++) {
      prediction.predict({ world, body: client, input: RUN, resources: clientResources, canBlock: true });
      const effective = stepPlayerResources({ state: serverResources, input: RUN, canBlock: true, dt: TICK_DT }).input;
      stepBody(world, server, effective, TICK_DT);
    }
    expect(closeBody(client, server)).toBe(true);
    expect(clientResources.stamina).toBe(serverResources.stamina);
  });

  it("reset drops all pending inputs so reconcile replays nothing", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.predict({ world, body: client, input: WALK });
    prediction.predict({ world, body: client, input: WALK });
    prediction.reset();
    const body = createBody(1, 2, 5);
    const before = { ...body };
    prediction.reconcile({ world, body, lastSimulatedProjectedTick: 0, authoritativeServerTick: 0 });
    expect(closeBody(body, before)).toBe(true);
    expect(prediction.allocatedStepRecordCount).toBe(2);
    prediction.predict({ world, body, input: WALK });
    expect(prediction.allocatedStepRecordCount).toBe(2);
  });

  it("evicts only the oldest input when history exceeds its bounded limit", () => {
    expect(PREDICTION_HISTORY_LIMIT).toBe(64);
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const inputs: MoveInput[] = Array.from({ length: PREDICTION_HISTORY_LIMIT + 1 }, (_, index) => index % 2 === 0 ? WALK : { ...WALK, moveX: -1 });
    for (const input of inputs) prediction.predict({ world, body: client, input });
    const replayed = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile({ world, body: replayed, lastSimulatedProjectedTick: 0, authoritativeServerTick: 0 });
    const retainedExpected = createBody(SPAWN_X, SPAWN_Y, 5);
    for (const input of inputs.slice(1)) stepBody(world, retainedExpected, input, TICK_DT);
    const unbounded = createBody(SPAWN_X, SPAWN_Y, 5);
    for (const input of inputs) stepBody(world, unbounded, input, TICK_DT);
    expect(closeBody(replayed, retainedExpected)).toBe(true);
    expect(closeBody(replayed, unbounded)).toBe(false);
  });
});
