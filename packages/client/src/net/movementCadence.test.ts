/** Verifies movement intents send on changes and otherwise collapse to a timeout-safe heartbeat. */
import { describe, expect, it } from "vitest";
import { encodeMessage, type ClientInput, type MoveInput } from "@dc2d/engine";
import { INPUT_HEARTBEAT_TICKS, MovementCadence } from "./movementCadence.js";
import { wireByteLength } from "./wireSize.js";

const IDLE: MoveInput = { moveX: 0, moveY: 0, jump: false, run: false };

describe("MovementCadence", () => {
  it("reduces one second of unchanged 20 Hz input to an initial send and two heartbeats", () => {
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

    expect(sends.map(({ seq }) => seq)).toEqual([0, INPUT_HEARTBEAT_TICKS]);
    expect(adaptiveBytes).toBeLessThan(legacyBytes * 0.15);
  });

  it("sends movement, aim, jump, and run changes immediately", () => {
    const cadence = new MovementCadence();
    expect(cadence.shouldSend(IDLE)).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1 })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1 })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1, jump: true })).toBe(true);
    expect(cadence.shouldSend({ ...IDLE, moveX: 1, faceY: -1, jump: true, run: true })).toBe(true);
  });

  it("sends immediately after reconnect reset", () => {
    const cadence = new MovementCadence();
    cadence.shouldSend(IDLE);
    cadence.reset();
    expect(cadence.shouldSend(IDLE)).toBe(true);
  });
});
