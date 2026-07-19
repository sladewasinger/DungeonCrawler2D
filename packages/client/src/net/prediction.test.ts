import { describe, expect, it } from "vitest";
import {
  LEVEL,
  TICK_DT,
  World,
  applyKnockback,
  cloneBody,
  createBody,
  stepBody,
  type BodyState,
  type MoveInput,
} from "@dc2d/engine";
import { Prediction } from "./prediction.js";

/**
 * Proves the client-side prediction/reconciliation loop: running the
 * same stepBody the server runs keeps client and server in lockstep,
 * a misprediction is detectable as drift, and adopting the next
 * authoritative snapshot (reconcile) converges the client straight
 * back onto the server's trajectory.
 */

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };

function closeBody(a: BodyState, b: BodyState, eps = 1e-9): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.z - b.z) < eps;
}

describe("Prediction", () => {
  it("stays in lockstep with an equivalent server-side stepBody run", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(0, 0, 5);
    const server = createBody(0, 0, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict(world, client, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
  });

  it("converges back to server truth after reconciling a misprediction", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(0, 0, 5);
    const server = createBody(0, 0, 5);

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
    prediction.reconcile(world, corrected, 13);
    expect(closeBody(corrected, server)).toBe(true);

    // Both sides keep stepping identically from here — convergence holds.
    for (let tick = 13; tick < 16; tick++) {
      prediction.predict(world, corrected, WALK);
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(corrected, server)).toBe(true);
  });

  it("replays only inputs newer than the acked sequence", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(0, 0, 5);

    for (let tick = 0; tick < 5; tick++) prediction.predict(world, client, WALK);

    // Reconciling onto a fresh body from tick-3's authoritative state
    // should reproduce exactly the client's own tick-5 position: only
    // ticks 4 and 5 were unacked and get replayed.
    const authoritative = createBody(0, 0, 5);
    for (let tick = 0; tick < 3; tick++) stepBody(world, authoritative, WALK, TICK_DT);
    prediction.reconcile(world, authoritative, 3);

    expect(closeBody(authoritative, client)).toBe(true);
  });

  it("reset drops all pending inputs so reconcile replays nothing", () => {
    const world = new World(7, 0, LEVEL.Sandbox);
    const prediction = new Prediction();
    const client = createBody(0, 0, 5);
    prediction.predict(world, client, WALK);
    prediction.predict(world, client, WALK);

    prediction.reset();
    const body = createBody(1, 2, 5);
    const before = cloneBody(body);
    prediction.reconcile(world, body, 0);

    expect(closeBody(body, before)).toBe(true);
  });
});
