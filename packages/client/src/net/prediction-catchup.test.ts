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
import { PredictionCorrection } from "./predictionCorrection.js";

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const RUN: MoveInput = { ...WALK, run: true };
const STOP: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };
const SPAWN_X = -6;
const SPAWN_Y = -13;

function closeBody(left: BodyState, right: BodyState): boolean {
  return Math.abs(left.x - right.x) < 1e-9 &&
    Math.abs(left.y - right.y) < 1e-9 &&
    Math.abs(left.z - right.z) < 1e-9;
}

function findEastWallRunup(world: World): { x: number; y: number; z: number } {
  for (let tileY = -30; tileY <= 30; tileY++) {
    for (let tileX = -30; tileX <= 30; tileX++) {
      if (!world.isWalkable(tileX - 1, tileY) ||
        !world.isWalkable(tileX, tileY) ||
        world.isWalkable(tileX + 1, tileY)) continue;
      const x = tileX - 0.5;
      const y = tileY + 0.5;
      const z = world.groundAt(x, y);
      if (world.groundAt(tileX + 0.5, y) === z) return { x, y, z };
    }
  }
  throw new Error("seed fixture has no east-facing wall runup");
}

describe("Prediction catch-up reconciliation", () => {
  it("converges a slightly faster client to authoritative time over five minutes", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, client, -1, 100);
    let maxLead = 0;

    for (let tick = 101; tick <= 6_100; tick++) {
      let latest = prediction.predict(world, client, WALK);
      if (tick % 100 === 0) latest = prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
      const authoritative = cloneBody(server);
      prediction.reconcile(world, authoritative, latest.seq, tick);
      maxLead = Math.max(maxLead, (prediction.projectedTick ?? tick) - tick);
      expect(closeBody(authoritative, server)).toBe(true);
      Object.assign(client, authoritative);
    }

    expect(maxLead).toBe(0);
    expect(prediction.pendingStepCount).toBe(0);
    expect(prediction.projectedTick).toBe(6_100);
    expect(prediction.allocatedStepRecordCount).toBe(2);
  });

  it("converges an acknowledged catch-up sprint to server truth", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const start = findEastWallRunup(world);
    const client = createBody(start.x, start.y, start.z);
    const server = createBody(start.x, start.y, start.z);
    prediction.reconcile(world, client, -1, 40);

    prediction.predict(world, client, RUN);
    const latest = prediction.predict(world, client, RUN);
    stepBody(world, server, RUN, TICK_DT);
    expect(client.x).toBeGreaterThan(server.x);
    const reconciled = cloneBody(server);
    prediction.reconcile(world, reconciled, latest.seq, 41);

    expect(closeBody(reconciled, server)).toBe(true);
    expect(prediction.pendingStepCount).toBe(0);
    expect(prediction.projectedTick).toBe(41);
  });

  it("does not replay movement superseded by an acknowledged stop edge", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, client, -1, 40);

    prediction.predict(world, client, RUN);
    prediction.predict(world, client, RUN);
    const stop = prediction.nextInputIdentity();
    stepBody(world, server, STOP, TICK_DT);
    const reconciled = cloneBody(server);
    prediction.reconcile(world, reconciled, stop.seq, 41);

    expect(closeBody(reconciled, server)).toBe(true);
    expect(prediction.pendingStepCount).toBe(0);
    expect(prediction.projectedTick).toBe(41);
  });

  it("does not leave positional debt to smooth backward after release", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const correction = new PredictionCorrection();
    const ground = world.groundAt(SPAWN_X, SPAWN_Y);
    const client = createBody(SPAWN_X, SPAWN_Y, ground);
    const server = createBody(SPAWN_X, SPAWN_Y, ground);
    prediction.reconcile(world, client, -1, 40);

    for (let tick = 41; tick <= 45; tick++) {
      let latest = prediction.predict(world, client, RUN);
      if (tick === 41) latest = prediction.predict(world, client, RUN);
      stepBody(world, server, RUN, TICK_DT);
      const authoritative = cloneBody(server);
      prediction.reconcile(world, authoritative, latest.seq, tick);
      Object.assign(client, authoritative);
    }

    const beforeRelease = cloneBody(client);
    const stop = prediction.nextInputIdentity();
    stepBody(world, server, STOP, TICK_DT);
    const stopped = cloneBody(server);
    prediction.reconcile(world, stopped, stop.seq, 46);
    correction.record(beforeRelease, stopped);

    expect(correction.lastError).toBe(0);
    expect(closeBody(stopped, server)).toBe(true);
  });
});
