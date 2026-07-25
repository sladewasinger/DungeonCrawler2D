/** Verifies movement intents send on changes and otherwise collapse to a timeout-safe heartbeat. */
import { describe, expect, it } from "vitest";
import { encodeMessage, type ClientInput, type MoveInput } from "@dc2d/engine";
import { MovementCadence } from "./movementCadence.js";
import { wireByteLength } from "./wireSize.js";

const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

describe("MovementCadence", () => {
  it("sends every fixed prediction tick so authoritative input cannot fall behind", () => {
    const cadence = new MovementCadence();
    const inputs = Array.from({ length: 20 }, (_, seq): ClientInput => ({
      type: "input",
      seq,
      projectedServerTick: seq,
      ...IDLE,
      run: IDLE.run ?? false,
    }));
    const sends = inputs.filter((entry) => cadence.shouldSend(entry));
    const legacyBytes = inputs.reduce((total, entry) =>
      total + wireByteLength(encodeMessage(entry)), 0);
    const adaptiveBytes = sends.reduce((total, entry) =>
      total + wireByteLength(encodeMessage(entry)), 0);

    expect(sends.map(({ seq }) => seq)).toEqual(inputs.map(({ seq }) => seq));
    expect(adaptiveBytes).toBe(legacyBytes);
  });

  it("sends movement, aim, jump, run, and block changes immediately", () => {
    const cadence = new MovementCadence();
    expect(cadence.shouldSend(IDLE)).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1 })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1 })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1, jump: true })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1, jump: true, run: true })).toBe(true);
    expect(cadence.shouldSend({
      ...IDLE,
      moveX: 1,
      faceY: -1,
      jump: true,
      run: false,
      block: true,
    })).toBe(true);
  });

  it("sends immediately after reconnect reset", () => {
    const cadence = new MovementCadence();
    cadence.shouldSend(IDLE);
    cadence.reset();
    expect(cadence.shouldSend(IDLE)).toBe(true);
  });
});
