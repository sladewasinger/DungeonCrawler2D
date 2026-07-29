/** Covers first-person movement's world-space server bridge. */
import { describe, expect, it } from "vitest";
import { advanceInputClock, firstPersonMoveInput } from "./firstPersonNetworking.js";

describe("firstPersonNetworking", () => {
  it("maps view-relative forward motion into engine world axes", () => {
    expect(firstPersonMoveInput({ forward: 1, right: 0, jump: false, yaw: 0 })).toMatchObject({ moveX: 0, moveY: -1 });
    expect(firstPersonMoveInput({ forward: 1, right: 0, jump: false, yaw: -Math.PI / 2 })).toMatchObject({ moveX: 1, moveY: 0 });
  });

  it("preserves shallow camera angles without snapping into a diagonal", () => {
    const input = firstPersonMoveInput({ forward: 1, right: 0, jump: false, yaw: 0.2 });
    expect(input.moveX).toBeCloseTo(-Math.sin(0.2), 5);
    expect(input.moveY).toBeCloseTo(-Math.cos(0.2), 5);
    expect(input.faceX).toBeCloseTo(-Math.sin(0.2), 5);
    expect(input.faceY).toBeCloseTo(-Math.cos(0.2), 5);
  });

  it("emits server input at the fixed simulation rate", () => {
    const result = advanceInputClock(0.12, 0);
    expect(result.ticks).toBe(2);
    expect(result.pending).toBeCloseTo(0.02);
  });
});
