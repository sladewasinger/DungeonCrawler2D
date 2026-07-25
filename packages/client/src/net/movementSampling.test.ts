/** Verifies prediction stays at simulation cadence while unchanged wire intents coalesce. */
import type { ClientInput, MoveInput } from "@dc2d/engine";
import { describe, expect, it, vi } from "vitest";
import type { Connection } from "./connection.js";
import { MovementCadence } from "./movementCadence.js";
import { sampleMovement } from "./movementSampling.js";

const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

describe("sampleMovement", () => {
  it("predicts every fixed tick but sends only changed control states", () => {
    let predictedTick = 100;
    let sequence = 0;
    const predict = vi.fn(() => ++predictedTick);
    const nextInputIdentity = vi.fn((projectedServerTick: number) => ({
      seq: ++sequence,
      projectedServerTick,
    }));
    const send = vi.fn();
    const connection = {
      world: {},
      body: {},
      canAct: true,
      prediction: { predict, nextInputIdentity },
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
    expect(inputs.map(({ seq }) => seq)).toEqual([1, 2, 3, 4, 5]);
    expect(inputs.map(({ projectedServerTick }) => projectedServerTick))
      .toEqual([101, 121, 122, 123, 124]);
    expect(inputs.at(-1)).toMatchObject({ moveX: 1, faceY: -1, jump: true, run: true });
  });
});
