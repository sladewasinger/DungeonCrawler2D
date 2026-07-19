// Headless tests: touch MoveInput derivation, merge-with-keyboard precedence, and facing memory.
import { describe, expect, it } from "vitest";
import { pressButton, releaseButton } from "./buttons.js";
import { beginStick, moveStick } from "./joystick.js";
import { mergeMoveInputs, touchMoveInput, updateLastFacing } from "./moveInput.js";
import { createTouchInputState } from "./state.js";

describe("touchMoveInput", () => {
  it("is neutral, jump false, with no stick and no buttons held", () => {
    expect(touchMoveInput(createTouchInputState())).toEqual({ moveX: 0, moveY: 0, jump: false });
  });

  it("reflects the live stick drag and the jump button's held state", () => {
    const state = createTouchInputState();
    beginStick(state, 1, 0, 0);
    moveStick(state, 1, 40, 0);
    pressButton(state, "jump", 2);
    expect(touchMoveInput(state)).toEqual({ moveX: 1, moveY: 0, jump: true });
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
    const merged = mergeMoveInputs({ moveX: -1, moveY: -1, jump: false }, { moveX: 1, moveY: 0, jump: false });
    expect(merged).toEqual({ moveX: 1, moveY: -1, jump: false });
  });

  it("falls back to keyboard on axes the touch stick leaves neutral", () => {
    const merged = mergeMoveInputs({ moveX: 1, moveY: 1, jump: false }, { moveX: 0, moveY: 0, jump: false });
    expect(merged).toEqual({ moveX: 1, moveY: 1, jump: false });
  });

  it("jump is true if either source holds it", () => {
    expect(mergeMoveInputs({ moveX: 0, moveY: 0, jump: true }, { moveX: 0, moveY: 0, jump: false }).jump).toBe(true);
    expect(mergeMoveInputs({ moveX: 0, moveY: 0, jump: false }, { moveX: 0, moveY: 0, jump: true }).jump).toBe(true);
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
