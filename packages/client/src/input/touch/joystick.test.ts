// Headless tests for the joystick's vector->direction/magnitude mapping (deadzone, face
// band, walk ramp, run threshold) and stick lifecycle.
import { describe, expect, it } from "vitest";
import { beginStick, endStick, moveStick, stickDragVector, stickIsRunning, stickMoveVector, vectorToStickDirection } from "./joystick.js";
import { createTouchInputState } from "./state.js";

describe("vectorToStickDirection", () => {
  it("is neutral at the origin", () => {
    expect(vectorToStickDirection(0, 0, 40)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("stays neutral inside the 12% deadzone", () => {
    expect(vectorToStickDirection(4, 0, 40)).toEqual({ moveX: 0, moveY: 0 }); // 10% — under
    expect(vectorToStickDirection(0, -4, 40)).toEqual({ moveX: 0, moveY: 0 });
  });

  it("engages just past the deadzone radius", () => {
    expect(vectorToStickDirection(5, 0, 40)).toEqual({ moveX: 1, moveY: 0 }); // 12.5% — over
  });

  it("maps the four cardinal directions", () => {
    expect(vectorToStickDirection(40, 0, 40)).toEqual({ moveX: 1, moveY: 0 }); // right
    expect(vectorToStickDirection(-40, 0, 40)).toEqual({ moveX: -1, moveY: 0 }); // left
    expect(vectorToStickDirection(0, 40, 40)).toEqual({ moveX: 0, moveY: 1 }); // down (screen y grows downward)
    expect(vectorToStickDirection(0, -40, 40)).toEqual({ moveX: 0, moveY: -1 }); // up
  });

  it("maps the four diagonal sectors", () => {
    expect(vectorToStickDirection(30, 30, 40)).toEqual({ moveX: 1, moveY: 1 }); // down-right
    expect(vectorToStickDirection(-30, 30, 40)).toEqual({ moveX: -1, moveY: 1 }); // down-left
    expect(vectorToStickDirection(-30, -30, 40)).toEqual({ moveX: -1, moveY: -1 }); // up-left
    expect(vectorToStickDirection(30, -30, 40)).toEqual({ moveX: 1, moveY: -1 }); // up-right
  });

  it("keeps sector boundaries symmetric around each of the 8 directions", () => {
    // Just inside the right sector's upper boundary (22.4° above horizontal).
    const angle = (22.4 * Math.PI) / 180;
    const dx = Math.cos(angle) * 40;
    const dy = -Math.sin(angle) * 40;
    expect(vectorToStickDirection(dx, dy, 40)).toEqual({ moveX: 1, moveY: 0 });
  });
});

describe("stickMoveVector — wave-9 deadzone/face-band/walk-ramp bands", () => {
  it("11% deflection: below the deadzone — no direction, no movement", () => {
    const result = stickMoveVector(4.4, 0, 40);
    expect(result.direction).toEqual({ moveX: 0, moveY: 0 });
    expect(result.moveX).toBe(0);
    expect(result.moveY).toBe(0);
  });

  it("15% deflection: face band — direction is live, movement stays zero", () => {
    const result = stickMoveVector(6, 0, 40);
    expect(result.direction).toEqual({ moveX: 1, moveY: 0 });
    expect(result.moveX).toBe(0);
    expect(result.moveY).toBe(0);
  });

  it("21% deflection: just past the ramp start — a soft walk creep near 0.35-0.36", () => {
    const result = stickMoveVector(8.4, 0, 40);
    expect(result.moveX).toBeCloseTo(0.358125, 5);
  });

  it("60% deflection: mid-ramp, roughly two-thirds speed", () => {
    const result = stickMoveVector(24, 0, 40);
    expect(result.moveX).toBeCloseTo(0.675, 5);
  });

  it("100% deflection: full walk-ramp speed", () => {
    const result = stickMoveVector(40, 0, 40);
    expect(result.moveX).toBeCloseTo(1, 5);
  });

  it("dragged past the ring still caps at full speed", () => {
    const result = stickMoveVector(60, 0, 40);
    expect(result.moveX).toBeCloseTo(1, 5);
  });

  it("diagonal drags walk at the same ramped speed as cardinal ones for the same deflection", () => {
    const cardinal = stickMoveVector(24, 0, 40);
    const diagonal = stickMoveVector(24 / Math.SQRT2, 24 / Math.SQRT2, 40);
    const diagonalSpeed = Math.hypot(diagonal.moveX, diagonal.moveY);
    expect(diagonalSpeed).toBeCloseTo(cardinal.moveX, 5);
  });
});

describe("stickIsRunning", () => {
  it("stays false below the 95% run-deflection threshold", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 37, 0); // 92.5%
    expect(stickIsRunning(state)).toBe(false);
  });

  it("flips true once the drag reaches full deflection", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0); // 100%
    expect(stickIsRunning(state)).toBe(true);
  });
});

describe("stick lifecycle", () => {
  it("begins a stick at the touch point (the floating-joystick summon)", () => {
    const state = createTouchInputState();
    beginStick(state, 7, 100, 200);
    expect(state.stick).toEqual({ pointerId: 7, originX: 100, originY: 200, curX: 100, curY: 200 });
  });

  it("dragging updates the live drag vector relative to the origin", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    expect(stickDragVector(state)).toEqual({ dx: 40, dy: 0 });
  });

  it("ignores a move from a pointer that isn't the active stick's", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 2, 40, 0);
    expect(stickDragVector(state)).toEqual({ dx: 0, dy: 0 });
  });

  it("release resets the stick and its drag vector to neutral", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    endStick(state, 1);
    expect(state.stick).toBeNull();
    expect(stickDragVector(state)).toBeNull();
  });

  it("a stray release from a non-owning pointer doesn't clear an active stick", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    endStick(state, 99);
    expect(state.stick).not.toBeNull();
  });
});
