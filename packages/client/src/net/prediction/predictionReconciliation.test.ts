import { TICK_DT, createBody, stepBody, type MoveInput } from "@dc2d/engine";
import { describe, expect, it } from "vitest";
import { Prediction } from "./prediction.js";
import { closeBody, findEastWallApproach, sandboxWorld, SPAWN_X, SPAWN_Y } from "./predictionTestSupport.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };

describe("Prediction reconciliation", () => {
  it("settles at a stable wall contact through prediction and reconciliation", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const start = findEastWallApproach(world);
    const client = createBody(start.x, start.y, start.z);
    const server = createBody(start.x, start.y, start.z);
    let contactX: number | null = null;
    for (let tick = 1; tick <= 60; tick++) {
      const predicted = prediction.predict({ world, body: client, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
      const reconciled = { ...server };
      prediction.reconcile({ world, body: reconciled, lastSimulatedProjectedTick: predicted.seq, authoritativeServerTick: tick });
      Object.assign(client, reconciled);
      contactX ??= client.x;
      expect(client.x).toBe(contactX);
      expect(client.y).toBe(start.y);
      expect(closeBody(client, server)).toBe(true);
    }
    expect(contactX).not.toBeNull();
    expect(contactX as number).toBeGreaterThan(start.x);
    expect(contactX as number).toBeLessThan(start.x + 0.5);
  });

  it("replays only inputs newer than the authoritative server tick", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 5; tick++) prediction.predict({ world, body: client, input: WALK });
    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 3; tick++) stepBody(world, authoritative, WALK, TICK_DT);
    prediction.reconcile({ world, body: authoritative, lastSimulatedProjectedTick: 3, authoritativeServerTick: 3 });
    expect(closeBody(authoritative, client)).toBe(true);
  });
});
