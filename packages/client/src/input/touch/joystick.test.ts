// Headless tests for the joystick's vector->8-way mapping (deadzone, sectors) and stick lifecycle.
import { describe, expect, it } from "vitest";
import { beginStick, endStick, moveStick, stickMoveAxes, vectorToMoveAxes } from "./joystick.js";
import { createTouchInputState } from "./state.js";

describe("vectorToMoveAxes", () => {
  it("is neutral at the origin", () => {
    expect(vectorToMoveAxes(0, 0, 40)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("stays neutral inside the ~25% deadzone", () => {
    expect(vectorToMoveAxes(9, 0, 40)).toEqual({ moveX: 0, moveY: 0 });
    expect(vectorToMoveAxes(0, -9, 40)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("engages just past the deadzone radius", () => {
    expect(vectorToMoveAxes(11, 0, 40)).toEqual({ moveX: 1, moveY: 0 });
  });

  it("maps the four cardinal directions", () => {
    expect(vectorToMoveAxes(40, 0, 40)).toEqual({ moveX: 1, moveY: 0 }); // right
    expect(vectorToMoveAxes(-40, 0, 40)).toEqual({ moveX: -1, moveY: 0 }); // left
    expect(vectorToMoveAxes(0, 40, 40)).toEqual({ moveX: 0, moveY: 1 }); // down (screen y grows downward)
    expect(vectorToMoveAxes(0, -40, 40)).toEqual({ moveX: 0, moveY: -1 }); // up
  });

  it("maps the four diagonal sectors", () => {
    expect(vectorToMoveAxes(30, 30, 40)).toEqual({ moveX: 1, moveY: 1 }); // down-right
    expect(vectorToMoveAxes(-30, 30, 40)).toEqual({ moveX: -1, moveY: 1 }); // down-left
    expect(vectorToMoveAxes(-30, -30, 40)).toEqual({ moveX: -1, moveY: -1 }); // up-left
    expect(vectorToMoveAxes(30, -30, 40)).toEqual({ moveX: 1, moveY: -1 }); // up-right
  });

  it("keeps sector boundaries symmetric around each of the 8 directions", () => {
    // Just inside the right sector's upper boundary (22.4° above horizontal).
    const angle = (22.4 * Math.PI) / 180;
    const dx = Math.cos(angle) * 40;
    const dy = -Math.sin(angle) * 40;
    expect(vectorToMoveAxes(dx, dy, 40)).toEqual({ moveX: 1, moveY: 0 });
  });
});

describe("stick lifecycle", () => {
  it("begins a stick at the touch point (the floating-joystick summon)", () => {
    const state = createTouchInputState();
    beginStick(state, 7, 100, 200);
    expect(state.stick).toEqual({ pointerId: 7, originX: 100, originY: 200, curX: 100, curY: 200 });
  });

  it("dragging updates the live axes relative to the origin", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    expect(stickMoveAxes(state)).toEqual({ moveX: 1, moveY: 0 });
  });

  it("ignores a move from a pointer that isn't the active stick's", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 2, 40, 0);
    expect(stickMoveAxes(state)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("release resets the stick and its axes to neutral", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    endStick(state, 1);
    expect(state.stick).toBeNull();
    expect(stickMoveAxes(state)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("a stray release from a non-owning pointer doesn't clear an active stick", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    endStick(state, 99);
    expect(state.stick).not.toBeNull();
  });
});
