/** Verifies prediction and movement delivery share the authoritative simulation cadence. */
import type { ClientInput, MoveInput } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import type { Connection } from "../connection/connection.js";
import { MovementCadence } from "./movementCadence.js";
import { sampleMovement } from "./movementSampling.js";

const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

describe("sampleMovement", () => {
  it("predicts and sends every fixed tick while preserving immediate changes", () => {
    let predictedTick = 100;
    let sequence = 0;
    const predict = vi.fn(() => ({
      seq: ++sequence,
      projectedServerTick: ++predictedTick,
    }));
    const send = vi.fn();
    const connection = {
      world: {},
      body: {},
      canAct: true,
      prediction: { predict },
      movementCadence: new MovementCadence(),
      send,
    } as unknown as Connection;

    for (let tick = 0; tick < 20; tick++) sampleMovement(connection, IDLE);
    sampleMovement(connection, { ...IDLE, moveX: 1 });
    sampleMovement(connection, { ...IDLE, moveX: 1, faceY: -1 });
    sampleMovement(connection, { ...IDLE, moveX: 1, faceY: -1, jump: true });
    sampleMovement(connection, {
      ...IDLE,
      moveX: 1,
      faceY: -1,
      jump: true,
      run: true,
    });

    expect(predict).toHaveBeenCalledTimes(24);
    const inputs = send.mock.calls.map(([message]) => message as ClientInput);
    expect(inputs.map(({ seq }) => seq)).toEqual(
      Array.from({ length: 24 }, (_, index) => index + 1),
    );
    expect(inputs.map(({ projectedServerTick }) => projectedServerTick))
      .toEqual(Array.from({ length: 24 }, (_, index) => index + 101));
    expect(inputs.at(-1)).toMatchObject({ moveX: 1, faceY: -1, jump: true, run: true });
  });
});
