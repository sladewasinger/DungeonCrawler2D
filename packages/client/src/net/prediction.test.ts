import { describe, expect, it } from "vitest";
import {
  LEVEL,
  TICK_DT,
  World,
  applyKnockback,
  cloneBody,
  createBody,
  stepBody,
  stepPlayerResources,
  type BodyState,
  type MoveInput,
} from "@dc2d/engine";
import { PREDICTION_HISTORY_LIMIT, Prediction } from "./prediction.js";

/**
 * Proves the client-side prediction/reconciliation loop: running the
 * same stepBody the server runs keeps client and server in lockstep,
 * a misprediction is detectable as drift, and adopting the next
 * authoritative snapshot (reconcile) converges the client straight
 * back onto the server's trajectory.
 */

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const RUN: MoveInput = { moveX: 1, moveY: 0, jump: false, run: true };

// Seed 7's origin chunk is a solid TILE.Wall mass (a landmark's footprint) —
// since walls block horizontal movement outright (types.ts's SOLID_TILES),
// spawning there leaves a body permanently stuck and unable to diverge
// under knockback. This coordinate is verified open floor nearby.
const SPAWN_X = -6;
const SPAWN_Y = -13;

function closeBody(a: BodyState, b: BodyState, eps = 1e-9): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
}

function findEastWallApproach(world: World): { x: number; y: number; z: number } {
  for (let tileY = -30; tileY <= 30; tileY++) {
    for (let tileX = -30; tileX <= 30; tileX++) {
      if (!world.isWalkable(tileX, tileY) || world.isWalkable(tileX + 1, tileY)) continue;
      const x = tileX + 0.5;
      const y = tileY + 0.5;
      return { x, y, z: world.groundAt(x, y) };
    }
  }
  throw new Error("seed fixture has no east-facing wall approach");
}

describe("Prediction", () => {
  it("stays in lockstep with an equivalent server-side stepBody run", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
  });

  it("predicts held-run at the same RUN_SPEED_MULTIPLIER the server applies, staying in lockstep (Epic 7.12)", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict(world, client, RUN);
      stepBody(world, server, RUN, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
    // Running genuinely outpaces walking — not just "no drift".
    const walked = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 10; tick++) stepBody(world, walked, WALK, TICK_DT);
    expect(client.x).toBeGreaterThan(walked.x);
  });

  it("converges back to server truth after reconciling a misprediction", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    // Ticks 1-10: identical inputs, no divergence yet.
    for (let tick = 0; tick < 10; tick++) {
      prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(client, server)).toBe(true);

    // Client mispredicts a knockback the server never applied (e.g. a
    // hit-detection bug); server keeps stepping normally.
    applyKnockback(client, 1, 0, 5);
    for (let tick = 10; tick < 13; tick++) {
      prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(client, server)).toBe(false);

    // Correction arrives: adopt the authoritative body (as apply.ts
    // does), then reconcile — every input up to the last tick is
    // acked, so nothing replays and the client snaps onto the server.
    const corrected = cloneBody(server);
    prediction.reconcile(world, corrected, 13, 13);
    expect(closeBody(corrected, server)).toBe(true);

    // Both sides keep stepping identically from here — convergence holds.
    for (let tick = 13; tick < 16; tick++) {
      prediction.predict(world, corrected, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(corrected, server)).toBe(true);
  });

  it("settles at a stable wall contact through prediction and repeated reconciliation", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const start = findEastWallApproach(world);
    const client = createBody(start.x, start.y, start.z);
    const server = createBody(start.x, start.y, start.z);
    let contactX: number | null = null;

    for (let tick = 1; tick <= 60; tick++) {
      const predicted = prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
      const reconciled = cloneBody(server);
      prediction.reconcile(world, reconciled, predicted.seq, tick);
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
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 5; tick++) prediction.predict(world, client, WALK);

    // Reconciling onto a fresh body from tick-3's authoritative state
    // should reproduce exactly the client's own tick-5 position: only
    // ticks 4 and 5 are newer than server tick 3 and get replayed.
    const authoritative = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 3; tick++) stepBody(world, authoritative, WALK, TICK_DT);
    prediction.reconcile(world, authoritative, 3, 3);

    expect(closeBody(authoritative, client)).toBe(true);
  });

  it("replays the same stamina-limited sprint policy as the server", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);
    const clientResources = {
      stamina: 1,
      maxStamina: 100,
      blocking: false,
    };
    const serverResources = { ...clientResources };

    for (let tick = 0; tick < 5; tick++) {
      prediction.predict(world, client, RUN, clientResources, true);
      const effective = stepPlayerResources(
        serverResources,
        RUN,
        true,
        TICK_DT,
      ).input;
      stepBody(world, server, effective, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
    expect(clientResources.stamina).toBe(serverResources.stamina);
  });

  it("reset drops all pending inputs so reconcile replays nothing", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.predict(world, client, WALK);
    prediction.predict(world, client, WALK);

    prediction.reset();
    const body = createBody(1, 2, 5);
    const before = cloneBody(body);
    prediction.reconcile(world, body, 0, 0);

    expect(closeBody(body, before)).toBe(true);
    expect(prediction.allocatedStepRecordCount).toBe(2);

    prediction.predict(world, body, WALK);

    expect(prediction.allocatedStepRecordCount).toBe(2);
  });

  it("evicts only the oldest input when history exceeds its bounded limit", () => {
    expect(PREDICTION_HISTORY_LIMIT).toBe(64);
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const inputs: MoveInput[] = Array.from({ length: PREDICTION_HISTORY_LIMIT + 1 }, (_, index) =>
      index % 2 === 0 ? WALK : { ...WALK, moveX: -1 });
    for (const input of inputs) prediction.predict(world, client, input);

    const replayed = createBody(SPAWN_X, SPAWN_Y, 5);
    prediction.reconcile(world, replayed, 0, 0);
    const retainedExpected = createBody(SPAWN_X, SPAWN_Y, 5);
    for (const input of inputs.slice(1)) stepBody(world, retainedExpected, input, TICK_DT);
    const unbounded = createBody(SPAWN_X, SPAWN_Y, 5);
    for (const input of inputs) stepBody(world, unbounded, input, TICK_DT);

    expect(closeBody(replayed, retainedExpected)).toBe(true);
    expect(closeBody(replayed, unbounded)).toBe(false);
  });
});
