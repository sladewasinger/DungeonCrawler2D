import { describe, expect, it } from "vitest";
import {
  ADMIN_NOCLIP_SPEED,
  TICK_DT,
  createBody,
  stepBody,
  type MoveInput,
} from "@dc2d/engine";
import { Prediction } from "./prediction.js";
import { closeBody, finitePredictionBody, finitePredictionWorld } from "./predictionTestSupport.js";

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
    const world = finitePredictionWorld();
    const prediction = new Prediction();
    const client = finitePredictionBody(world);
    const server = finitePredictionBody(world);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: WALK });
      stepBody(world, server, WALK, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
  });

  it("predicts held-run at the same RUN_SPEED_MULTIPLIER the server applies, staying in lockstep (Epic 7.12)", () => {
    const world = finitePredictionWorld();
    const prediction = new Prediction();
    const client = finitePredictionBody(world);
    const server = finitePredictionBody(world);

    for (let tick = 0; tick < 10; tick++) {
      prediction.predict({ world, body: client, input: RUN });
      stepBody(world, server, RUN, TICK_DT);
    }

    expect(closeBody(client, server)).toBe(true);
    // Running genuinely outpaces walking — not just "no drift".
    const walked = finitePredictionBody(world);
    for (let tick = 0; tick < 10; tick++) stepBody(world, walked, WALK, TICK_DT);
    expect(client.x).toBeGreaterThan(walked.x);
  });

  it("mirrors the server finite-floor clamp during noclip prediction", () => {
    const world = finitePredictionWorld();
    const bounds = world.floorBounds;
    if (!bounds) throw new Error("missing finite floor bounds");
    const prediction = new Prediction();
    const body = createBody(bounds.maxX + 0.5, bounds.maxY + 0.5, 0);

    prediction.predict({
      world,
      body,
      input: { moveX: 1, moveY: 1, jump: false },
      movementSpeed: ADMIN_NOCLIP_SPEED,
      noclip: true,
    });

    expect(body.x).toBeLessThanOrEqual(bounds.maxX + 0.5);
    expect(body.y).toBeLessThanOrEqual(bounds.maxY + 0.5);
  });

  it("matches server movement from a generated descent port toward its stair", () => {
    const world = finitePredictionWorld();
    const floor = world.generatedFloor;
    const stair = floor?.downStairways[0];
    const port = stair?.ports[0];
    if (!floor || !stair || !port) throw new Error("finite prediction fixture is missing descent metadata");
    const x = port.x + 0.5;
    const y = port.y + 0.5;
    const client = createBody(x, y, world.groundAt(x, y));
    const server = createBody(x, y, world.groundAt(x, y));
    const input: MoveInput = {
      moveX: Math.sign(stair.position.x - port.x),
      moveY: Math.sign(stair.position.y - port.y),
      jump: false,
    };
    const prediction = new Prediction();
    prediction.predict({ world, body: client, input });
    stepBody(world, server, input, TICK_DT);

    expect(world.floorIdentity).toEqual(floor.identity);
    expect(world.stairHeightAt(stair.position.x + 0.5, stair.position.y + 0.5)).not.toBeNull();
    expect(closeBody(client, server)).toBe(true);
  });

});
