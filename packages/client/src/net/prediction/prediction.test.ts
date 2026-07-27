import { describe, expect, it } from "vitest";
import {
  TICK_DT,
  applyKnockback,
  cloneBody,
  createBody,
  stepBody,
  type MoveInput,
} from "@dc2d/engine";
import { Prediction } from "./prediction.js";
import { closeBody, sandboxWorld, SPAWN_X, SPAWN_Y } from "./predictionTestSupport.js";

/**
 * Proves the client-side prediction/reconciliation loop: running the
 * same stepBody the server runs keeps client and server in lockstep,
 * a misprediction is detectable as drift, and adopting the next
 * authoritative snapshot (reconcile) converges the client straight
 * back onto the server's trajectory.
 */

const WALK: MoveInput = { moveX: 1, moveY: 0, jump: false };
const RUN: MoveInput = { moveX: 1, moveY: 0, jump: false, run: true };

// This coordinate is verified open floor nearby. The collision fixture below
// finds a finite-height boundary rather than relying on a removed Wall tile.

describe("Prediction", () => {
  it("stays in lockstep with an equivalent server-side stepBody run", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
  });

  it("predicts held-run at the same RUN_SPEED_MULTIPLIER the server applies, staying in lockstep (Epic 7.12)", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: RUN });
      stepBody(world, server, RUN, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
    // Running genuinely outpaces walking — not just "no drift".
    const walked = createBody(SPAWN_X, SPAWN_Y, 5);
    for (let tick = 0; tick < 10; tick++) stepBody(world, walked, WALK, TICK_DT);
    expect(client.x).toBeGreaterThan(walked.x);
  });

  it("converges back to server truth after reconciling a misprediction", () => {
    const world = sandboxWorld();
    const prediction = new Prediction();
    const client = createBody(SPAWN_X, SPAWN_Y, 5);
    const server = createBody(SPAWN_X, SPAWN_Y, 5);

    // Ticks 1-10: identical inputs, no divergence yet.
    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(client, server)).toBe(true);

    // Client mispredicts a knockback the server never applied (e.g. a
    // hit-detection bug); server keeps stepping normally.
    applyKnockback(client, { dirX: 1, dirY: 0, force: 5 });
    for (let tick = 10; tick < 13; tick++) {
      prediction.predict({ world, body: client, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(client, server)).toBe(false);

    // Correction arrives: adopt the authoritative body (as apply.ts
    // does), then reconcile — every input up to the last tick is
    // acked, so nothing replays and the client snaps onto the server.
    const corrected = cloneBody(server);
    prediction.reconcile({ world, body: corrected, lastSimulatedProjectedTick: 13, authoritativeServerTick: 13 });
    expect(closeBody(corrected, server)).toBe(true);

    // Both sides keep stepping identically from here — convergence holds.
    for (let tick = 13; tick < 16; tick++) {
      prediction.predict({ world, body: corrected, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
    }
    expect(closeBody(corrected, server)).toBe(true);
  });

});
