// Headless tests: touch MoveInput derivation across the wave-9 deadzone/face-band/walk-ramp
// bands, merge-with-keyboard precedence, and facing memory.
import { describe, expect, it } from "vitest";
import { pressButton, releaseButton } from "./buttons.js";
import { beginStick, moveStick } from "./joystick.js";
import { mergeMoveInputs, touchMoveInput, updateLastFacing } from "./moveInput.js";
import { createTouchInputState } from "./state.js";

describe("touchMoveInput", () => {
  it("is neutral, jump/run false, with no stick and no buttons held", () => {
    expect(touchMoveInput(createTouchInputState())).toEqual({ moveX: 0, moveY: 0, jump: false, run: false });
  });

  it("11% deflection (below the deadzone) stays fully neutral", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 4.4, 0);
    const input = touchMoveInput(state);
    expect(input.moveX).toBe(0);
    expect(input.moveY).toBe(0);
    expect(input.run).toBe(false);
  });

  it("15% deflection (face band) turns the character without moving it", () => {
    const state = createTouchInputState();
    state.lastFacing = { x: -1, y: 0 };
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 6, 0);
    const input = touchMoveInput(state);
    expect(input.moveX).toBe(0);
    expect(input.moveY).toBe(0);
    expect(state.lastFacing).toEqual({ x: 1, y: 0 });
  });

  it("21% deflection walks at a soft creep near 0.36", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 8.4, 0);
    expect(touchMoveInput(state).moveX).toBeCloseTo(0.358125, 5);
  });

  it("60% deflection walks near two-thirds speed", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 24, 0);
    expect(touchMoveInput(state).moveX).toBeCloseTo(0.675, 5);
  });

  it("100% deflection hits full speed and also sets run", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    const input = touchMoveInput(state);
    expect(input.moveX).toBeCloseTo(1, 5);
    expect(input.run).toBe(true);
  });

  it("reflects the jump button's held state alongside the stick", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    pressButton(state, "jump", 2);
    expect(touchMoveInput(state)).toEqual({ moveX: 1, moveY: 0, jump: true, run: true });
  });

  it("jump clears once its pointer releases", () => {
    const state = createTouchInputState();
    pressButton(state, "jump", 2);
    releaseButton(state, "jump", 2);
    expect(touchMoveInput(state).jump).toBe(false);
  });
});

describe("mergeMoveInputs", () => {
  it("touch wins per-axis when it's non-neutral", () => {
    const merged = mergeMoveInputs(
      { moveX: -1, moveY: -1, jump: false, run: false },
      { moveX: 1, moveY: 0, jump: false, run: false },
    );
    expect(merged).toEqual({ moveX: 1, moveY: -1, jump: false, run: false });
  });

  it("falls back to keyboard on axes the touch stick leaves neutral", () => {
    const merged = mergeMoveInputs(
      { moveX: 1, moveY: 1, jump: false, run: false },
      { moveX: 0, moveY: 0, jump: false, run: false },
    );
    expect(merged).toEqual({ moveX: 1, moveY: 1, jump: false, run: false });
  });

  it("touch's ramped (fractional) magnitude still wins over keyboard's full-magnitude axis", () => {
    const merged = mergeMoveInputs(
      { moveX: 1, moveY: 0, jump: false, run: false },
      { moveX: 0.36, moveY: 0, jump: false, run: false },
    );
    expect(merged.moveX).toBeCloseTo(0.36, 5);
  });

  it("jump is true if either source holds it", () => {
    expect(
      mergeMoveInputs({ moveX: 0, moveY: 0, jump: true, run: false }, { moveX: 0, moveY: 0, jump: false, run: false })
        .jump,
    ).toBe(true);
    expect(
      mergeMoveInputs({ moveX: 0, moveY: 0, jump: false, run: false }, { moveX: 0, moveY: 0, jump: true, run: false })
        .jump,
    ).toBe(true);
  });

  it("run is true if either source holds it", () => {
    expect(
      mergeMoveInputs({ moveX: 0, moveY: 0, jump: false, run: true }, { moveX: 0, moveY: 0, jump: false, run: false })
        .run,
    ).toBe(true);
    expect(
      mergeMoveInputs({ moveX: 0, moveY: 0, jump: false, run: false }, { moveX: 0, moveY: 0, jump: false, run: true })
        .run,
    ).toBe(true);
  });
});

describe("updateLastFacing", () => {
  it("ignores a neutral move, keeping the previous facing", () => {
    const state = createTouchInputState();
    updateLastFacing(state, 1, 0);
    updateLastFacing(state, 0, 0);
    expect(state.lastFacing).toEqual({ x: 1, y: 0 });
  });

  it("updates to the latest non-zero direction", () => {
    const state = createTouchInputState();
    updateLastFacing(state, 1, 0);
    updateLastFacing(state, 0, -1);
    expect(state.lastFacing).toEqual({ x: 0, y: -1 });
  });
});
